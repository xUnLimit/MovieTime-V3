-- Server-priced purchases and renewals, multiple trusted receipts, pending excess ledger.
CREATE TABLE public.pedido_excedentes (
  pedido_id uuid PRIMARY KEY REFERENCES public.pedidos(id),
  monto numeric(12,2) NOT NULL CHECK (monto>0 AND monto<>'NaN'::numeric),
  moneda text NOT NULL REFERENCES public.currencies(code),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','credito','reembolsado')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_excedentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_excedentes FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.pedido_excedentes TO authenticated;
CREATE POLICY pedido_excedentes_read ON public.pedido_excedentes FOR SELECT TO authenticated
  USING ((SELECT public.is_authenticated()));
ALTER TABLE public.intentos_comprobante ADD COLUMN retry_attempts integer NOT NULL DEFAULT 0 CHECK (retry_attempts>=0);
ALTER TABLE public.intentos_comprobante ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION public.mt_public_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('planId',p.id,'planNombre',p.nombre,'categoriaId',c.id,
   'categoriaNombre',c.nombre,'precio',p.precio,'moneda',coalesce(cp.moneda,cc.moneda,a.moneda),'cicloPago',p.ciclo_pago,
   'perfilesLibres',coalesce(stock.libres,0)) ORDER BY coalesce(cp.orden,cc.orden,p.orden,0),c.nombre,p.nombre)
 FROM public.planes p JOIN public.categorias c ON c.id=p.categoria_id AND c.activo
 JOIN public.planes_tipos pt ON pt.id=p.plan_tipo_id AND pt.activo
 CROSS JOIN public.catalogo_ajustes a
 LEFT JOIN public.catalogo_config cc ON cc.categoria_id=c.id AND cc.plan_id IS NULL
 LEFT JOIN public.catalogo_config cp ON cp.plan_id=p.id
 LEFT JOIN LATERAL (SELECT sum(greatest(s.perfiles_disponibles-s.perfiles_ocupados-
   (SELECT count(*) FROM public.reservas_perfil WHERE servicio_id=s.id AND cerrada_at IS NULL AND expira_at>statement_timestamp()),0)) libres
   FROM public.servicios s WHERE s.categoria_id=c.id AND s.plan_tipo_id=p.plan_tipo_id
     AND s.activo AND NOT s.en_reposo AND s.cortado_at IS NULL AND s.archivado_at IS NULL
   ) stock ON true
 WHERE p.activo AND coalesce(cp.visible_en_bot,cc.visible_en_bot,true)),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_public_catalog() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_public_catalog() TO service_role;

CREATE FUNCTION public.mt_create_commerce_order(p_wa_id text,p_ids text[],p_kind text,p_idempotency_key uuid,p_expected_total numeric) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result uuid; existing uuid; sale public.ventas%ROWTYPE; period public.venta_periodos%ROWTYPE;
 plan public.planes%ROWTYPE; service public.servicios%ROWTYPE; third_id text; entity_id text;
 item uuid; profile integer; selected_service text; type_name text; ttl integer; max_holds integer:=2; purchases_enabled boolean:=false; contact public.whatsapp_contacts%ROWTYPE;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 existing:=private.mt_intent('commerce-' || p_kind,p_idempotency_key,p_wa_id);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 IF p_kind='compra' THEN
   IF to_regclass('public.mt_automation_settings') IS NOT NULL THEN
     SELECT coalesce((settings->>'purchasesEnabled')::boolean,false) INTO purchases_enabled
       FROM public.mt_automation_settings WHERE id;
   END IF;
   IF NOT coalesce(purchases_enabled,false) THEN RAISE EXCEPTION 'pedido_purchases_paused'; END IF;
 END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('compra','renovacion') OR p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 10
   OR p_expected_total IS NULL OR p_expected_total<0 OR p_expected_total='NaN'::numeric
   OR array_position(p_ids,NULL) IS NOT NULL OR EXISTS (SELECT 1 FROM unnest(p_ids) x WHERE x !~ '^[0-9a-fA-F-]{36}$')
   OR (p_kind='renovacion' AND cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x))
   THEN RAISE EXCEPTION 'pedido_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('contact:' || p_wa_id,0));
 SELECT * INTO contact FROM public.whatsapp_contacts WHERE wa_id=p_wa_id FOR UPDATE;
 IF NOT FOUND OR contact.estado='bloqueado' THEN RAISE EXCEPTION 'pedido_invalid_contact'; END IF;
 IF (SELECT count(*) FROM public.terceros WHERE wa_id=p_wa_id AND active)>1
   THEN RAISE EXCEPTION 'pedido_identity_ambiguous'; END IF;
 SELECT id INTO third_id FROM public.terceros WHERE wa_id=p_wa_id AND active;
 IF p_kind='renovacion' AND third_id IS NULL THEN RAISE EXCEPTION 'pedido_invalid_customer'; END IF;
 IF to_regclass('public.mt_automation_settings') IS NOT NULL THEN
   SELECT coalesce((settings->>'maxReservations')::integer,2) INTO max_holds FROM public.mt_automation_settings WHERE id;
 END IF;
 IF (SELECT count(*) FROM public.pedidos WHERE contact_id=p_wa_id AND estado IN ('esperando_pago','borrador')
   AND expira_at>clock_timestamp()) >= coalesce(max_holds,2) THEN RAISE EXCEPTION 'pedido_reservation_limit'; END IF;
 SELECT reserva_ttl_minutos INTO ttl FROM public.catalogo_ajustes WHERE id='global';
 INSERT INTO public.pedidos(tercero_id,contact_id,canal,moneda,exchange_rate,expira_at,estado,created_by,actor_service)
   VALUES(third_id,p_wa_id,'whatsapp','USD',1,now()+make_interval(mins=>ttl),'esperando_pago',NULL,'whatsapp-commerce') RETURNING id INTO result;
 -- Lock eligible accounts once, in stable order, including purchases of the same last profile.
 PERFORM s.id FROM public.servicios s WHERE (p_kind='compra' AND EXISTS (
   SELECT 1 FROM public.planes pl WHERE pl.id=ANY(p_ids) AND pl.categoria_id=s.categoria_id AND pl.plan_tipo_id=s.plan_tipo_id))
   OR (p_kind='renovacion' AND s.id IN (SELECT servicio_id FROM public.ventas WHERE id=ANY(p_ids))) ORDER BY s.id FOR UPDATE;
 UPDATE public.reservas_perfil SET cerrada_at=clock_timestamp() WHERE cerrada_at IS NULL AND expira_at<=clock_timestamp()
   AND servicio_id IN (SELECT s.id FROM public.servicios s WHERE (p_kind='compra' AND EXISTS (
     SELECT 1 FROM public.planes pl WHERE pl.id=ANY(p_ids) AND pl.categoria_id=s.categoria_id AND pl.plan_tipo_id=s.plan_tipo_id))
     OR (p_kind='renovacion' AND s.id IN (SELECT servicio_id FROM public.ventas WHERE id=ANY(p_ids))));
 FOREACH entity_id IN ARRAY p_ids LOOP
   profile:=NULL;
   IF p_kind='compra' THEN
     SELECT * INTO plan FROM public.planes WHERE id=entity_id AND activo;
     IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.mt_public_catalog()) c
       WHERE c->>'planId'=entity_id AND c->>'moneda'='USD') THEN RAISE EXCEPTION 'pedido_invalid_plan'; END IF;
     SELECT s.id,n INTO selected_service,profile FROM public.servicios s,
       LATERAL generate_series(1,s.perfiles_disponibles) n
       WHERE s.categoria_id=plan.categoria_id AND s.plan_tipo_id=plan.plan_tipo_id
         AND s.activo AND NOT s.en_reposo AND s.cortado_at IS NULL AND s.archivado_at IS NULL
         AND s.perfiles_disponibles-s.perfiles_ocupados>(SELECT count(*) FROM public.reservas_perfil
           WHERE servicio_id=s.id AND cerrada_at IS NULL)
         AND NOT EXISTS (SELECT 1 FROM public.ventas WHERE servicio_id=s.id AND perfil_numero=n AND estado='activo' AND archivado_at IS NULL)
         AND NOT EXISTS (SELECT 1 FROM public.reservas_perfil WHERE servicio_id=s.id AND perfil_numero=n AND cerrada_at IS NULL)
       ORDER BY s.id,n LIMIT 1;
     IF NOT FOUND THEN RAISE EXCEPTION 'pedido_no_stock'; END IF;
     SELECT * INTO service FROM public.servicios WHERE id=selected_service;
     SELECT nombre INTO type_name FROM public.planes_tipos WHERE id=plan.plan_tipo_id;
     INSERT INTO public.pedido_items(pedido_id,tipo,plan_id,categoria_id,servicio_id,perfil_numero,ciclo_pago,
       precio,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot)
       VALUES(result,'nueva',plan.id,plan.categoria_id,service.id,profile,plan.ciclo_pago,plan.precio,plan.precio,plan.nombre,type_name)
       RETURNING id INTO item;
     INSERT INTO public.reservas_perfil(servicio_id,perfil_numero,owner_ref,expira_at,pedido_id,item_id)
       VALUES(service.id,profile,'pedido:' || item::text,now()+make_interval(mins=>ttl),result,item);
   ELSE
     SELECT * INTO sale FROM public.ventas WHERE id=entity_id AND cliente_id=third_id AND estado='activo'
       AND archivado_at IS NULL AND cortada_at IS NULL;
     IF NOT FOUND THEN RAISE EXCEPTION 'pedido_invalid_sale'; END IF;
     SELECT * INTO period FROM public.venta_periodos WHERE venta_id=sale.id ORDER BY numero_periodo DESC LIMIT 1;
     IF NOT FOUND OR period.moneda_original<>'USD' THEN RAISE EXCEPTION 'pedido_currency_mismatch'; END IF;
     INSERT INTO public.pedido_items(pedido_id,tipo,venta_id,plan_id,categoria_id,servicio_id,perfil_numero,ciclo_pago,
       precio,descuento,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot)
       VALUES(result,'renovacion',sale.id,period.plan_id,sale.categoria_id,sale.servicio_id,sale.perfil_numero,period.ciclo_pago,
         period.precio_original,period.descuento,round(period.precio_original*(1-period.descuento/100),2),
         period.plan_nombre_snapshot,period.plan_tipo_nombre_snapshot);
   END IF;
 END LOOP;
 UPDATE public.pedidos SET total=(SELECT sum(total) FROM public.pedido_items WHERE pedido_id=result) WHERE id=result;
 IF (SELECT total FROM public.pedidos WHERE id=result)<>p_expected_total THEN RAISE EXCEPTION 'pedido_quote_changed'; END IF;
 PERFORM private.mt_order_event('pedido.confirmado',result);
 IF p_expected_total=0 THEN
   UPDATE public.pedidos SET estado='pagado',payment_state='cubierto' WHERE id=result;
   PERFORM private.mt_order_event('pedido.pagado',result);
   PERFORM private.mt_apply_order(result);
 END IF;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(p_wa_id),'commerce-' || p_kind,p_idempotency_key,result,now());
 RETURN result::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_create_commerce_order(text,text[],text,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_create_commerce_order(text,text[],text,uuid,numeric) TO service_role;

CREATE FUNCTION public.mt_get_commerce_order(p_wa_id text,p_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' OR NOT EXISTS (
   SELECT 1 FROM public.pedidos WHERE id=p_order_id AND contact_id=p_wa_id)
   THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 RETURN private.mt_read_order(p_order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_get_commerce_order(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_get_commerce_order(text,uuid) TO service_role;

CREATE FUNCTION public.mt_reconcile_order(p_order_id uuid,p_code text,p_wa_id text,p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; p public.pedidos%ROWTYPE; payment public.yappy_payments%ROWTYPE;
 received numeric; outcome text; cfg public.pedido_pago_ajustes%ROWTYPE;
BEGIN
 existing:=private.mt_intent('receipt:' || p_order_id::text || ':' || upper(p_code),p_idempotency_key,p_wa_id);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9-]{4,64}$' THEN RAISE EXCEPTION 'pedido_invalid_receipt'; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR (NOT public.is_authenticated() AND p.contact_id IS DISTINCT FROM p_wa_id)
   THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 IF p.estado='cancelado' THEN RAISE EXCEPTION 'pedido_cancelled'; END IF;
 SELECT * INTO cfg FROM public.pedido_pago_ajustes WHERE id='global';
 IF coalesce(current_setting('movietime.receipt_retry',true),'')<>'true' AND
   (SELECT count(*) FROM public.intentos_comprobante WHERE pedido_id=p.id AND created_at>now()-interval '1 hour'
   AND NOT reintento)>=cfg.max_intentos THEN RAISE EXCEPTION 'pedido_receipt_limit'; END IF;
 SELECT y.* INTO payment FROM public.yappy_payments y JOIN public.yappy_mail_messages m ON m.id=y.mail_message_id
   WHERE upper(y.confirmation_code)=upper(p_code) AND m.dmarc_pass AND m.status='extraido' FOR UPDATE OF y;
 IF NOT FOUND THEN outcome:='no_encontrado';
 ELSIF EXISTS (SELECT 1 FROM public.pedido_pagos WHERE yappy_payment_id=payment.id) OR payment.match_status IN ('registrado','descartado') THEN
   IF EXISTS (SELECT 1 FROM public.pedido_pagos WHERE yappy_payment_id=payment.id AND pedido_id=p.id) THEN
     outcome:='confirmado';
   ELSE outcome:='codigo_usado'; END IF;
 ELSIF payment.currency<>p.moneda OR payment.paid_at < p.created_at-make_interval(mins=>cfg.margen_minutos)
   OR payment.paid_at>p.created_at+make_interval(hours=>cfg.ventana_horas) THEN outcome:='fuera_de_ventana';
 ELSE
   INSERT INTO public.pedido_pagos(pedido_id,source,yappy_payment_id,monto) VALUES(p.id,'yappy',payment.id,payment.amount);
   SELECT sum(monto)-p.refunded_amount-p.excess_settled_amount INTO received FROM public.pedido_pagos WHERE pedido_id=p.id;
   outcome:=CASE WHEN received<p.total THEN 'monto_menor' WHEN received>p.total THEN 'monto_mayor' ELSE 'confirmado' END;
   UPDATE public.pedidos SET payment_state=CASE WHEN received<p.total THEN 'parcial' WHEN received>p.total THEN 'exceso' ELSE 'cubierto' END,
     estado=CASE WHEN received>=p.total AND p.delivery_state='pendiente' THEN 'pagado'
       WHEN p.delivery_state<>'pendiente' THEN p.estado ELSE 'esperando_pago' END WHERE id=p.id;
   IF received>=p.total THEN PERFORM private.mt_order_event('pedido.pagado',p.id); END IF;
   UPDATE public.yappy_payments SET match_status='registrado',resolved_at=now(),resolved_by=auth.uid(),
     revision_pedido_id=p.id,requiere_revision=received>p.total,
     revision_motivo=CASE WHEN received>p.total THEN 'Sobrepago pendiente de resolución' END WHERE id=payment.id;
   IF received>p.total THEN
     INSERT INTO public.pedido_excedentes(pedido_id,monto,moneda) VALUES(p.id,received-p.total,p.moneda)
       ON CONFLICT(pedido_id) DO UPDATE SET monto=EXCLUDED.monto,estado='pendiente',updated_at=now();
   END IF;
   IF received>=p.total THEN
     BEGIN
       PERFORM private.mt_apply_order(p.id); -- Subtransaction: all allocations or none; receipt survives failure.
     EXCEPTION WHEN OTHERS THEN
       UPDATE public.pedidos SET estado='pagado',notas='Pago registrado. Asignación pendiente de revisión.' WHERE id=p.id;
     END;
   END IF;
 END IF;
 IF coalesce(current_setting('movietime.receipt_retry',true),'')<>'true' OR outcome<>'no_encontrado' THEN
   INSERT INTO public.intentos_comprobante(pedido_id,wa_id,codigo,resultado,pendiente,idempotency_key,respuesta,reintento)
     VALUES(p.id,p_wa_id,upper(p_code),outcome,outcome='no_encontrado',p_idempotency_key,
       jsonb_build_object('pedidoId',p.id,'resultado',outcome),coalesce(current_setting('movietime.receipt_retry',true),'')='true')
     ON CONFLICT(idempotency_key) DO NOTHING;
 END IF;
 IF outcome<>'no_encontrado' THEN
   UPDATE public.intentos_comprobante SET pendiente=false WHERE pedido_id=p.id AND codigo=upper(p_code);
 END IF;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(p_wa_id),'receipt:' || p_order_id::text || ':' || upper(p_code),p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_reconcile_order(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_reconcile_order(uuid,text,text,uuid) TO authenticated,service_role;

CREATE FUNCTION public.mt_order_command(p_order_id uuid,p_action text,p_idempotency_key uuid,p_wa_id text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; p public.pedidos%ROWTYPE;
BEGIN
 existing:=private.mt_intent('command:' || p_order_id::text || ':' || p_action,p_idempotency_key,p_wa_id);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR (NOT public.is_authenticated() AND p.contact_id IS DISTINCT FROM p_wa_id)
   THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 IF p_action='retry' THEN
   PERFORM private.mt_apply_order(p.id);
 ELSIF p_action='cancel' THEN
   IF EXISTS (SELECT 1 FROM public.pedido_pagos WHERE pedido_id=p.id) OR p.delivery_state<>'pendiente'
     THEN RAISE EXCEPTION 'pedido_funded_cannot_cancel'; END IF;
   UPDATE public.pedidos SET estado='cancelado' WHERE id=p.id;
   UPDATE public.pedido_items SET estado='cancelado' WHERE pedido_id=p.id;
   UPDATE public.reservas_perfil SET cerrada_at=clock_timestamp() WHERE pedido_id=p.id AND cerrada_at IS NULL;
 ELSE RAISE EXCEPTION 'pedido_invalid_command'; END IF;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(p_wa_id),'command:' || p_order_id::text || ':' || p_action,p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_order_command(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mt_order_command(uuid,text,uuid,text) TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';

CREATE FUNCTION public.mt_customer_sales(p_wa_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE customer text;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' OR p_wa_id !~ '^507[0-9]{8}$'
   THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.terceros WHERE wa_id=p_wa_id AND active)<>1
   THEN RETURN '[]'::jsonb; END IF;
 SELECT id INTO customer FROM public.terceros WHERE wa_id=p_wa_id AND active;
 IF EXISTS (SELECT 1 FROM public.whatsapp_contacts WHERE wa_id=p_wa_id AND estado='bloqueado')
   THEN RETURN '[]'::jsonb; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('ventaId',v.id,'nombre',coalesce(c.nombre,s.nombre),
   'precio',round(p.precio_original*(1-p.descuento/100),2),'moneda',p.moneda_original,
   'cicloPago',p.ciclo_pago,'fechaVencimiento',p.fecha_fin) ORDER BY p.fecha_fin,v.id)
   FROM public.ventas v JOIN public.servicios s ON s.id=v.servicio_id
   JOIN public.categorias c ON c.id=v.categoria_id
   JOIN LATERAL (SELECT * FROM public.venta_periodos WHERE venta_id=v.id ORDER BY numero_periodo DESC LIMIT 1) p ON true
   WHERE v.cliente_id=customer AND v.estado='activo' AND v.archivado_at IS NULL AND v.cortada_at IS NULL
     AND s.activo AND NOT s.en_reposo AND s.archivado_at IS NULL AND s.cortado_at IS NULL),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_customer_sales(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_customer_sales(text) TO service_role;

CREATE FUNCTION public.mt_retry_receipts(p_limit integer DEFAULT 50) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE candidate public.intentos_comprobante%ROWTYPE; completed integer:=0; hours integer;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 SELECT ventana_horas INTO hours FROM public.pedido_pago_ajustes WHERE id='global';
 PERFORM set_config('movietime.receipt_retry','true',true);
 FOR candidate IN SELECT * FROM public.intentos_comprobante WHERE pendiente AND wa_id ~ '^507[0-9]{8}$'
   AND next_attempt_at<=now() ORDER BY created_at,id LIMIT least(greatest(p_limit,0),100) LOOP
   -- Same lock order as customer reconciliation: order before receipt-attempt rows.
   IF NOT EXISTS (SELECT 1 FROM public.pedidos WHERE id=candidate.pedido_id FOR UPDATE SKIP LOCKED)
     THEN CONTINUE; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.intentos_comprobante WHERE id=candidate.id AND pendiente
     AND next_attempt_at<=now() FOR UPDATE SKIP LOCKED) THEN CONTINUE; END IF;
   IF candidate.created_at+make_interval(hours=>hours)<=now() OR candidate.retry_attempts>=20 THEN
     UPDATE public.intentos_comprobante SET pendiente=false WHERE id=candidate.id;
     UPDATE public.pedidos SET estado='pago_en_revision',notas='El correo de pago no llegó dentro del plazo. Revisa el comprobante.'
       WHERE id=candidate.pedido_id AND delivery_state='pendiente';
   ELSE
     BEGIN
       PERFORM public.mt_reconcile_order(candidate.pedido_id,candidate.codigo,candidate.wa_id,gen_random_uuid());
     EXCEPTION WHEN OTHERS THEN
       UPDATE public.pedidos SET notas='Comprobante pendiente de revisión.' WHERE id=candidate.pedido_id;
     END;
     UPDATE public.intentos_comprobante SET retry_attempts=retry_attempts+1,
       next_attempt_at=now()+make_interval(secs=>least(3600,(30*power(2,least(retry_attempts,7)))::integer)) WHERE id=candidate.id;
   END IF;
   completed:=completed+1;
 END LOOP;
 PERFORM set_config('movietime.receipt_retry','false',true);
 RETURN completed;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_retry_receipts(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_retry_receipts(integer) TO service_role;

-- Trusted bank evidence is retained independently of customer/payer telephone equality.
CREATE OR REPLACE FUNCTION public.ingest_yappy_payment(p_uid_validity bigint, p_imap_uid bigint, p_internet_message_id text, p_received_at timestamp with time zone, p_subject text, p_dmarc_pass boolean, p_parser_version integer, p_confirmation_code text, p_amount numeric, p_payer_name_short text, p_payer_phone_last4 text, p_paid_at timestamp with time zone, p_reject_reason text DEFAULT NULL::text)
 RETURNS TABLE(outcome text, payment_id uuid, match_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_mail_id uuid; v_payment_id uuid; v_status text;
BEGIN
  IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_uid_validity <= 0 OR p_imap_uid <= 0 OR p_payer_phone_last4 !~ '^[0-9]{4}$'
    OR p_amount <= 0 OR p_confirmation_code IS NULL OR btrim(p_confirmation_code) = ''
  THEN RAISE EXCEPTION 'invalid payment input'; END IF;

  SELECT m.id INTO v_mail_id FROM public.yappy_mail_messages m
    WHERE m.uid_validity = p_uid_validity AND m.imap_uid = p_imap_uid;
  IF v_mail_id IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  INSERT INTO public.yappy_mail_messages(uid_validity, imap_uid, internet_message_id,
    received_at, from_address, subject, dmarc_pass, parser_version, status, failure_reason)
  VALUES (p_uid_validity, p_imap_uid, p_internet_message_id, p_received_at,
    'notificaciones@yappy.com.pa', p_subject, p_dmarc_pass, p_parser_version,
    CASE WHEN p_reject_reason IS NULL THEN 'extraido'
      WHEN p_reject_reason = 'dmarc_failed' THEN 'invalido' ELSE 'descartado' END, p_reject_reason)
  RETURNING id INTO v_mail_id;
  IF p_reject_reason IS NOT NULL THEN
    RETURN QUERY SELECT 'nuevo'::text, NULL::uuid,
      CASE WHEN p_reject_reason = 'dmarc_failed' THEN 'invalido' ELSE 'descartado' END::text;
    RETURN;
  END IF;
  INSERT INTO public.yappy_payments(confirmation_code, amount, payer_name_short,
    payer_phone_last4, paid_at, mail_message_id)
  VALUES (upper(btrim(p_confirmation_code)), p_amount, p_payer_name_short,
    p_payer_phone_last4, p_paid_at, v_mail_id)
  ON CONFLICT (confirmation_code) DO NOTHING RETURNING id INTO v_payment_id;
  IF v_payment_id IS NULL THEN
    UPDATE public.yappy_mail_messages SET status = 'duplicado',
      failure_reason = 'confirmation_code_exists' WHERE id = v_mail_id;
    RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  v_status := public.match_yappy_payment(v_payment_id);
  RETURN QUERY SELECT 'nuevo'::text, v_payment_id, v_status;
END;
$function$
;
