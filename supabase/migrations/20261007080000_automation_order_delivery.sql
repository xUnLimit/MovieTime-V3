-- Recoverable access delivery. No credentials are retained in the work ledger.
CREATE TABLE public.mt_order_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_item_id UUID NOT NULL UNIQUE REFERENCES public.pedido_items(id),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id),
  venta_id TEXT NOT NULL REFERENCES public.ventas(id),
  wa_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','leased','accepted','review')),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_token UUID,
  fence BIGINT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  manual_actor UUID REFERENCES public.usuarios(id),
  failure_code TEXT,
  outbound_id UUID REFERENCES public.whatsapp_outbound_messages(id),
  accepted_at TIMESTAMPTZ,
  CHECK (wa_id IS NULL OR wa_id ~ '^507[0-9]{8}$')
);
CREATE INDEX mt_order_deliveries_pending ON public.mt_order_deliveries(available_at) WHERE status IN ('queued','leased');
CREATE INDEX mt_order_deliveries_order ON public.mt_order_deliveries(pedido_id);
CREATE INDEX mt_order_deliveries_sale ON public.mt_order_deliveries(venta_id);
CREATE INDEX mt_order_deliveries_outbound ON public.mt_order_deliveries(outbound_id) WHERE outbound_id IS NOT NULL;
CREATE INDEX mt_order_deliveries_actor ON public.mt_order_deliveries(manual_actor) WHERE manual_actor IS NOT NULL;
ALTER TABLE public.mt_order_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_order_deliveries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.mt_order_deliveries TO authenticated;
CREATE POLICY mt_order_deliveries_admin_read ON public.mt_order_deliveries FOR SELECT TO authenticated
  USING ((SELECT private.auth_role())='admin');

CREATE FUNCTION private.mt_enqueue_order_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE wa TEXT;
BEGIN
  IF NEW.delivery_state NOT IN ('asignado','parcial') THEN RETURN NEW; END IF;
  SELECT coalesce(nullif(NEW.contact_id,''),t.wa_id) INTO wa FROM public.terceros t WHERE t.id=NEW.tercero_id;
  IF wa !~ '^507[0-9]{8}$' THEN wa:=NULL; END IF;
  IF wa IS NOT NULL THEN INSERT INTO public.whatsapp_conversation_state(wa_id) VALUES(wa) ON CONFLICT DO NOTHING; END IF;
  INSERT INTO public.mt_order_deliveries(pedido_item_id,pedido_id,venta_id,wa_id,status,failure_code)
    SELECT i.id,i.pedido_id,i.venta_id_resultante,wa,CASE WHEN wa IS NULL THEN 'review' ELSE 'queued' END,
      CASE WHEN wa IS NULL THEN 'CONTACT_UNAVAILABLE' END
    FROM public.pedido_items i WHERE i.pedido_id=NEW.id AND i.estado='aplicado' AND i.venta_id_resultante IS NOT NULL
    ON CONFLICT(pedido_item_id) DO NOTHING;
  -- A later partial resolution may cancel the remaining items after the delivered subset.
  IF EXISTS(SELECT 1 FROM public.pedido_items WHERE pedido_id=NEW.id AND estado='aplicado')
    AND NOT EXISTS(SELECT 1 FROM public.pedido_items i LEFT JOIN public.mt_order_deliveries d ON d.pedido_item_id=i.id
      WHERE i.pedido_id=NEW.id AND i.estado<>'cancelado' AND (i.estado<>'aplicado' OR d.status IS DISTINCT FROM 'accepted')) THEN
    UPDATE public.pedidos SET delivery_state='enviado' WHERE id=NEW.id AND delivery_state<>'enviado';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.mt_enqueue_order_delivery() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mt_enqueue_order_delivery AFTER UPDATE OF delivery_state ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION private.mt_enqueue_order_delivery();

CREATE FUNCTION public.mt_claim_order_delivery(p_order_id UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.whatsapp_conversation_state; d public.mt_order_deliveries; token UUID:=gen_random_uuid(); manual BOOLEAN;
BEGIN
  manual := (SELECT private.auth_role())='admin';
  IF NOT coalesce(manual,false) AND coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF NOT coalesce(manual,false) AND NOT EXISTS(SELECT 1 FROM public.config WHERE id='global' AND whatsapp_auto_enabled) THEN RETURN NULL; END IF;
  SELECT cs.* INTO c FROM public.whatsapp_conversation_state cs
    WHERE (manual OR cs.mode='bot') AND (cs.locked_until IS NULL OR cs.locked_until<now())
      AND EXISTS(SELECT 1 FROM public.mt_order_deliveries x WHERE x.wa_id=cs.wa_id AND x.status IN ('queued','leased')
        AND x.available_at<=now() AND (p_order_id IS NULL OR x.pedido_id=p_order_id))
    ORDER BY cs.updated_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO d FROM public.mt_order_deliveries WHERE wa_id=c.wa_id AND status IN ('queued','leased')
    AND available_at<=now() AND (p_order_id IS NULL OR pedido_id=p_order_id) ORDER BY available_at,id FOR UPDATE LIMIT 1;
  IF d.attempts>=5 THEN UPDATE public.mt_order_deliveries SET status='review',failure_code='RETRIES_EXHAUSTED' WHERE id=d.id; RETURN NULL; END IF;
  UPDATE public.whatsapp_conversation_state SET version=version+1,lease_token=token,locked_until=now()+interval '90 seconds',updated_at=now()
    WHERE wa_id=c.wa_id RETURNING * INTO c;
  UPDATE public.mt_order_deliveries SET status='leased',attempts=attempts+1,lease_token=token,fence=c.version,
    locked_until=c.locked_until,manual_actor=CASE WHEN manual THEN auth.uid() END WHERE id=d.id RETURNING * INTO d;
  RETURN jsonb_build_object('id',d.id,'itemId',d.pedido_item_id,'orderId',d.pedido_id,'saleId',d.venta_id,
    'waId',d.wa_id,'token',token,'fence',d.fence,'attempts',d.attempts);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_claim_order_delivery(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_claim_order_delivery(UUID) TO authenticated,service_role;

CREATE FUNCTION public.mt_order_delivery_access(p_id UUID,p_token UUID,p_fence BIGINT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result JSONB;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' AND coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('saleId',v.id,'serviceId',s.id,'waId',d.wa_id,'name',s.nombre,'email',s.correo,
    'profile',coalesce(v.perfil_nombre,''),'mode',coalesce(a.mode,'password'),'provider',coalesce(a.provider,'none'),
    'password',CASE WHEN a.mode='code' THEN NULL ELSE s.contrasena END,
    'pin',CASE WHEN a.mode='code' THEN NULL ELSE nullif(v.codigo,'') END,'expiresAt',v.ultima_fecha_fin)
    INTO result FROM public.mt_order_deliveries d
    JOIN public.whatsapp_conversation_state cs ON cs.wa_id=d.wa_id
    JOIN public.pedidos p ON p.id=d.pedido_id JOIN public.pedido_items i ON i.id=d.pedido_item_id
    JOIN public.v_ventas_full v ON v.id=d.venta_id JOIN public.servicios s ON s.id=v.servicio_id
    JOIN public.terceros t ON t.id=v.cliente_id LEFT JOIN public.mt_service_access a ON a.service_id=s.id
    WHERE d.id=p_id AND d.status='leased' AND d.lease_token=p_token AND d.fence=p_fence AND d.locked_until>now()
      AND cs.lease_token=p_token AND cs.version=p_fence AND cs.locked_until>now() AND (cs.mode='bot' OR d.manual_actor IS NOT NULL)
      AND p.delivery_state IN ('asignado','parcial') AND p.payment_state IN ('cubierto','exceso','parcialmente_reembolsado')
      AND i.venta_id_resultante=v.id AND p.tercero_id=v.cliente_id AND t.active AND t.wa_id=d.wa_id
      AND NOT EXISTS(SELECT 1 FROM public.terceros other WHERE other.active AND other.wa_id=d.wa_id AND other.id<>t.id)
      AND v.estado='activo' AND v.ultima_fecha_fin >= (now() AT TIME ZONE 'America/Panama')::date
      AND s.activo AND NOT s.en_reposo AND s.cortado_at IS NULL AND s.archivado_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM public.pagos_venta pg WHERE pg.venta_periodo_id=v.ultimo_periodo_id AND pg.estado='reembolsado');
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_order_delivery_access(UUID,UUID,BIGINT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_order_delivery_access(UUID,UUID,BIGINT) TO authenticated,service_role;

CREATE FUNCTION private.mt_delivery_reply_key(p_item_id UUID) RETURNS UUID
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT (substr(h,1,8)||'-'||substr(h,9,4)||'-5'||substr(h,14,3)||'-a'||substr(h,18,3)||'-'||substr(h,21,12))::uuid
    FROM (SELECT encode(extensions.digest('bot-reply:order-access:'||p_item_id::text,'sha256'),'hex') AS h) AS hashed;
$$;
REVOKE ALL ON FUNCTION private.mt_delivery_reply_key(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mt_finish_order_delivery(p_id UUID,p_token UUID,p_fence BIGINT,p_result TEXT,p_outbound_id UUID DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.whatsapp_conversation_state; d public.mt_order_deliveries;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' AND coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF p_result IS NULL OR p_result NOT IN ('accepted','retry','review','ineligible') THEN RAISE EXCEPTION 'invalid_delivery_result'; END IF;
  SELECT cs.* INTO c FROM public.whatsapp_conversation_state cs JOIN public.mt_order_deliveries x ON x.wa_id=cs.wa_id WHERE x.id=p_id FOR UPDATE OF cs;
  IF NOT FOUND OR c.version<>p_fence OR c.lease_token IS DISTINCT FROM p_token OR c.locked_until<=now() THEN RETURN FALSE; END IF;
  SELECT * INTO d FROM public.mt_order_deliveries WHERE id=p_id FOR UPDATE;
  IF d.status<>'leased' OR d.lease_token IS DISTINCT FROM p_token OR d.fence<>p_fence THEN RETURN FALSE; END IF;
  IF p_result='accepted' AND NOT EXISTS(SELECT 1 FROM public.whatsapp_outbound_messages WHERE id=p_outbound_id
      AND send_status='accepted' AND to_wa_id=d.wa_id AND idempotency_key=private.mt_delivery_reply_key(d.pedido_item_id))
    THEN RAISE EXCEPTION 'delivery_not_accepted'; END IF;
  UPDATE public.mt_order_deliveries SET status=CASE WHEN p_result='accepted' THEN 'accepted'
      WHEN p_result IN ('review','ineligible') OR attempts>=5 THEN 'review' ELSE 'queued' END,
    available_at=now()+make_interval(secs=>least(900,30*(2^least(attempts,5))::integer)),
    accepted_at=CASE WHEN p_result='accepted' THEN now() END,outbound_id=coalesce(p_outbound_id,outbound_id),
    failure_code=CASE WHEN p_result='review' THEN 'DELIVERY_UNCERTAIN' WHEN p_result='ineligible' THEN 'ACCESS_INELIGIBLE'
      WHEN p_result='retry' THEN 'DELIVERY_FAILED' END,lease_token=NULL,locked_until=NULL WHERE id=d.id;
  UPDATE public.whatsapp_conversation_state SET lease_token=NULL,locked_until=NULL,updated_at=now() WHERE wa_id=c.wa_id;
  IF p_result='accepted' AND NOT EXISTS(SELECT 1 FROM public.pedido_items i LEFT JOIN public.mt_order_deliveries x ON x.pedido_item_id=i.id
      WHERE i.pedido_id=d.pedido_id AND i.estado<>'cancelado' AND (i.estado<>'aplicado' OR x.status IS NULL OR x.status<>'accepted')) THEN
    UPDATE public.pedidos SET delivery_state='enviado' WHERE id=d.pedido_id AND delivery_state IN ('asignado','parcial');
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_finish_order_delivery(UUID,UUID,BIGINT,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_finish_order_delivery(UUID,UUID,BIGINT,TEXT,UUID) TO authenticated,service_role;

CREATE FUNCTION public.mt_retry_order_delivery(p_order_id UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.mt_order_deliveries WHERE pedido_id=p_order_id AND failure_code='DELIVERY_UNCERTAIN') THEN RETURN FALSE; END IF;
  UPDATE public.mt_order_deliveries SET status='queued',attempts=0,available_at=now(),failure_code=NULL
    WHERE pedido_id=p_order_id AND status='review' AND failure_code<>'CONTACT_UNAVAILABLE';
  RETURN EXISTS(SELECT 1 FROM public.mt_order_deliveries WHERE pedido_id=p_order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_retry_order_delivery(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_retry_order_delivery(UUID) TO authenticated;

CREATE FUNCTION public.mt_resolve_access_sale(p_wa_id TEXT,p_sale_id TEXT) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  RETURN (SELECT s.id FROM public.v_ventas_full v JOIN public.servicios s ON s.id=v.servicio_id JOIN public.terceros t ON t.id=v.cliente_id
    JOIN public.mt_service_access a ON a.service_id=s.id
    WHERE v.id=p_sale_id AND t.active AND t.wa_id=p_wa_id AND v.estado='activo'
      AND v.ultima_fecha_fin>=(now() AT TIME ZONE 'America/Panama')::date AND a.mode='code' AND a.provider='netflix'
      AND s.activo AND NOT s.en_reposo AND s.cortado_at IS NULL AND s.archivado_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM public.terceros other WHERE other.active AND other.wa_id=p_wa_id AND other.id<>t.id)
      AND NOT EXISTS(SELECT 1 FROM public.pagos_venta pg WHERE pg.venta_periodo_id=v.ultimo_periodo_id AND pg.estado='reembolsado'));
END;
$$;
REVOKE ALL ON FUNCTION public.mt_resolve_access_sale(TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_resolve_access_sale(TEXT,TEXT) TO service_role;
