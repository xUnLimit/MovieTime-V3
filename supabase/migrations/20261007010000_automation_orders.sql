-- Reactivate retained order tables with explicit service attribution and atomic carts.
-- Legacy application RPC signatures and historical migrations remain compatible.
ALTER TABLE public.pedidos ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.pedidos ADD COLUMN payment_state text NOT NULL DEFAULT 'pendiente'
  CHECK (payment_state IN ('pendiente','parcial','cubierto','exceso','reembolsado','parcialmente_reembolsado'));
ALTER TABLE public.pedidos ADD COLUMN delivery_state text NOT NULL DEFAULT 'pendiente'
  CHECK (delivery_state IN ('pendiente','parcial','asignado','enviado'));
ALTER TABLE public.pedidos ADD COLUMN actor_service text;
ALTER TABLE public.pedidos ADD COLUMN excess_settled_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (excess_settled_amount>=0);
ALTER TABLE public.pedidos ADD COLUMN refunded_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (refunded_amount>=0);
ALTER TABLE public.domain_events ADD COLUMN event_version integer NOT NULL DEFAULT 1 CHECK (event_version>0);
ALTER TABLE public.domain_events ADD COLUMN correlation_id uuid;
ALTER TABLE public.domain_events ADD COLUMN dedupe_key text;
CREATE UNIQUE INDEX domain_events_dedupe_idx ON public.domain_events(dedupe_key) WHERE dedupe_key IS NOT NULL;
ALTER TABLE public.reservas_perfil ADD COLUMN pedido_id uuid REFERENCES public.pedidos(id);
ALTER TABLE public.reservas_perfil ADD COLUMN item_id uuid REFERENCES public.pedido_items(id);
CREATE INDEX reservas_pedido_idx ON public.reservas_perfil(pedido_id);
CREATE INDEX reservas_item_idx ON public.reservas_perfil(item_id);

CREATE TABLE public.pedido_operaciones (
  actor_ref text NOT NULL,
  operation text NOT NULL,
  idempotency_key uuid NOT NULL,
  result_id uuid NOT NULL REFERENCES public.pedidos(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_ref, operation, idempotency_key)
);
ALTER TABLE public.pedido_operaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_operaciones FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY pedido_operaciones_read ON public.pedido_operaciones FOR SELECT TO authenticated
  USING ((SELECT public.is_authenticated()));
GRANT SELECT ON public.pedido_operaciones TO authenticated;

CREATE FUNCTION private.mt_order_event(p_type text,p_id uuid,p_suffix text DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 INSERT INTO public.domain_events(type,aggregate_type,aggregate_id,payload,event_version,correlation_id,dedupe_key)
 SELECT p_type,'pedido',p.id::text,jsonb_build_object('pedido_id',p.id,'total',p.total,'moneda',p.moneda,
   'estado',p.estado,'payment_state',p.payment_state,'delivery_state',p.delivery_state),1,
   nullif(current_setting('movietime.correlation_id',true),'')::uuid,p_type || ':' || p.id::text || ':' || coalesce(p_suffix,'complete')
 FROM public.pedidos p WHERE p.id=p_id ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
$$;
REVOKE ALL ON FUNCTION private.mt_order_event(text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

-- The service must be processing a funded order inside its transaction. No auth UID is forged.
CREATE FUNCTION private.mt_service_order_context() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT coalesce(auth.jwt()->>'role' = 'service_role' AND EXISTS (
   SELECT 1 FROM public.pedidos p WHERE p.id::text = current_setting('movietime.order_id', true)
     AND p.actor_service = 'whatsapp-commerce' AND p.estado = 'pagado'), false)
$$;
REVOKE ALL ON FUNCTION private.mt_service_order_context() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.mt_actor(p_wa text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF public.is_authenticated() THEN RETURN auth.uid()::text; END IF;
 IF auth.jwt()->>'role' = 'service_role' AND p_wa ~ '^507[0-9]{8}$'
   THEN RETURN 'whatsapp-commerce:' || p_wa; END IF;
 RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION private.mt_actor(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.mt_intent(p_op text, p_key uuid, p_wa text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE a text; result uuid;
BEGIN
 a := private.mt_actor(p_wa);
 IF p_key IS NULL THEN RAISE EXCEPTION 'pedido_key_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a || p_op || p_key::text, 0));
 PERFORM set_config('movietime.correlation_id',p_key::text,true);
 SELECT result_id INTO result FROM public.pedido_operaciones
   WHERE actor_ref = a AND operation = p_op AND idempotency_key = p_key;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION private.mt_intent(text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.mt_read_order(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT jsonb_build_object('id', p.id, 'terceroId', p.tercero_id, 'contactId', p.contact_id,
   'moneda', p.moneda, 'total', p.total, 'estado', p.estado,
   'paymentState', p.payment_state, 'deliveryState', p.delivery_state,
   'receivedAmount', paid.amount, 'missingAmount', greatest(p.total-paid.amount+p.refunded_amount+p.excess_settled_amount,0),
   'excessAmount', greatest(paid.amount-p.total-p.excess_settled_amount-p.refunded_amount,0), 'expiraAt', p.expira_at,
   'allocatedAmount', allocated.amount, 'refundedAmount', p.refunded_amount,
   'unallocatedAmount', greatest(least(paid.amount-p.refunded_amount-p.excess_settled_amount,p.total)-allocated.amount,0),
   'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id,'tipo',i.tipo,
     'servicioId',i.servicio_id,'ventaId',i.venta_id,'planNombre',i.plan_nombre_snapshot,
     'total',i.total,'estado',i.estado,'ventaIdResultante',i.venta_id_resultante) ORDER BY i.id)
     FROM public.pedido_items i WHERE i.pedido_id=p.id), '[]'::jsonb))
 FROM public.pedidos p CROSS JOIN LATERAL (
   SELECT coalesce(sum(monto),0) amount FROM public.pedido_pagos WHERE pedido_id=p.id) paid
 CROSS JOIN LATERAL (SELECT coalesce(sum(total),0) amount FROM public.pedido_items WHERE pedido_id=p.id AND estado='aplicado') allocated
 WHERE p.id=p_id
$$;
REVOKE ALL ON FUNCTION private.mt_read_order(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.mt_list_orders() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_authenticated() THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(private.mt_read_order(id) ORDER BY created_at DESC)
   FROM (SELECT id,created_at FROM public.pedidos ORDER BY created_at DESC LIMIT 200) p),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_list_orders() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mt_list_orders() TO authenticated;

-- Both panel and bot sales honor holds; checkout consumes its own hold under this lock.
CREATE FUNCTION private.mt_protect_hold() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.estado <> 'activo' OR NEW.archivado_at IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.estado='activo' AND OLD.archivado_at IS NULL
   AND OLD.servicio_id=NEW.servicio_id AND OLD.perfil_numero IS NOT DISTINCT FROM NEW.perfil_numero
   THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.servicios WHERE id=NEW.servicio_id FOR UPDATE;
 -- Older clients may assign an account without naming the profile. Preserve that contract,
 -- while counting its occupied slot and every live hold under the same account lock.
 IF (SELECT count(*) FROM public.ventas WHERE servicio_id=NEW.servicio_id AND estado='activo'
   AND archivado_at IS NULL AND id<>NEW.id) + (SELECT count(*) FROM public.reservas_perfil
   WHERE servicio_id=NEW.servicio_id AND cerrada_at IS NULL AND expira_at>clock_timestamp()) >=
   (SELECT perfiles_disponibles FROM public.servicios WHERE id=NEW.servicio_id)
   THEN RAISE EXCEPTION 'pedido_no_stock' USING ERRCODE='23514'; END IF;
 IF NEW.perfil_numero IS NULL THEN RETURN NEW; END IF;
 IF NEW.perfil_numero < 1 OR NEW.perfil_numero > (
   SELECT perfiles_disponibles FROM public.servicios WHERE id=NEW.servicio_id)
   OR EXISTS (SELECT 1 FROM public.reservas_perfil WHERE servicio_id=NEW.servicio_id
     AND perfil_numero=NEW.perfil_numero AND cerrada_at IS NULL AND expira_at > clock_timestamp())
   OR EXISTS (SELECT 1 FROM public.ventas WHERE servicio_id=NEW.servicio_id AND perfil_numero=NEW.perfil_numero
     AND estado='activo' AND archivado_at IS NULL AND id <> NEW.id)
 THEN RAISE EXCEPTION 'pedido_no_stock' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.mt_protect_hold() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER mt_protect_hold BEFORE INSERT OR UPDATE ON public.ventas
 FOR EACH ROW EXECUTE FUNCTION private.mt_protect_hold();

CREATE FUNCTION private.mt_catalog_currency(p_plan_id text) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(cp.moneda,cc.moneda,a.moneda) FROM public.planes p CROSS JOIN public.catalogo_ajustes a
 LEFT JOIN public.catalogo_config cp ON cp.plan_id=p.id AND cp.categoria_id=p.categoria_id
 LEFT JOIN public.catalogo_config cc ON cc.categoria_id=p.categoria_id AND cc.plan_id IS NULL
 WHERE p.id=p_plan_id AND a.id='global'
$$;
REVOKE ALL ON FUNCTION private.mt_catalog_currency(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.mt_apply_order(p_id uuid,p_selected uuid[] DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.pedidos%ROWTYPE; i public.pedido_items%ROWTYPE; s public.servicios%ROWTYPE;
 v public.ventas%ROWTYPE; period public.venta_periodos%ROWTYPE; profile integer; start_date date; end_date date; result text; count_people integer;
BEGIN
 SELECT * INTO p FROM public.pedidos WHERE id=p_id FOR UPDATE;
 IF p.delivery_state IN ('asignado','enviado') THEN RETURN; END IF;
 IF p.estado <> 'pagado' THEN RAISE EXCEPTION 'pedido_unfunded'; END IF;
 PERFORM set_config('movietime.order_id', p.id::text, true);
 IF p.contact_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('contact:' || p.contact_id,0)); END IF;
 -- Deterministic lock order for the complete batch, before any financial mutation.
 PERFORM s1.id FROM public.servicios s1 WHERE s1.id IN (
   SELECT servicio_id FROM public.pedido_items WHERE pedido_id=p.id) ORDER BY s1.id FOR UPDATE;
 IF p.tercero_id IS NULL THEN
   IF EXISTS (SELECT 1 FROM public.whatsapp_contacts WHERE wa_id=p.contact_id AND estado='bloqueado')
     THEN RAISE EXCEPTION 'pedido_blocked_contact'; END IF;
   SELECT count(*),min(id) INTO count_people,p.tercero_id FROM public.terceros WHERE wa_id=p.contact_id AND active;
   IF count_people > 1 THEN RAISE EXCEPTION 'pedido_identity_ambiguous'; END IF;
   IF count_people=0 THEN
     INSERT INTO public.terceros(nombre,apellido,tipo,telefono,created_by)
       VALUES(coalesce((SELECT nullif(nombre_perfil,'') FROM public.whatsapp_contacts WHERE wa_id=p.contact_id),'Cliente'),
         '', 'cliente', p.contact_id, auth.uid()) RETURNING id INTO p.tercero_id;
   END IF;
   UPDATE public.pedidos SET tercero_id=p.tercero_id WHERE id=p.id;
   UPDATE public.whatsapp_contacts SET tercero_id=p.tercero_id,estado='cliente' WHERE wa_id=p.contact_id;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.terceros WHERE id=p.tercero_id AND active)
   THEN RAISE EXCEPTION 'pedido_invalid_customer'; END IF;
 IF p.contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.terceros WHERE id=p.tercero_id AND wa_id=p.contact_id AND active)
   THEN RAISE EXCEPTION 'pedido_identity_changed'; END IF;
 FOR i IN SELECT * FROM public.pedido_items WHERE pedido_id=p.id AND estado='pendiente'
   AND (p_selected IS NULL OR id=ANY(p_selected)) ORDER BY servicio_id,id LOOP
   IF i.estado <> 'pendiente' THEN RAISE EXCEPTION 'pedido_invalid_item_state'; END IF;
   SELECT * INTO s FROM public.servicios WHERE id=i.servicio_id;
   IF NOT s.activo OR s.en_reposo OR s.cortado_at IS NOT NULL OR s.archivado_at IS NOT NULL
     THEN RAISE EXCEPTION 'pedido_service_unavailable'; END IF;
   profile := i.perfil_numero;
   IF i.tipo='renovacion' THEN
     PERFORM pg_advisory_xact_lock(hashtextextended(i.venta_id,0));
     SELECT * INTO v FROM public.ventas WHERE id=i.venta_id FOR UPDATE;
     IF v.cliente_id IS DISTINCT FROM p.tercero_id OR v.servicio_id<>s.id OR v.estado<>'activo'
       OR v.archivado_at IS NOT NULL OR v.cortada_at IS NOT NULL THEN RAISE EXCEPTION 'pedido_invalid_sale'; END IF;
     SELECT * INTO period FROM public.venta_periodos WHERE venta_id=v.id ORDER BY numero_periodo DESC LIMIT 1;
     IF p.expira_at <= clock_timestamp() AND (period.precio_original IS DISTINCT FROM i.precio
       OR period.descuento IS DISTINCT FROM i.descuento OR period.ciclo_pago IS DISTINCT FROM i.ciclo_pago
       OR period.moneda_original IS DISTINCT FROM p.moneda) THEN RAISE EXCEPTION 'pedido_terms_changed'; END IF;
     start_date:=period.fecha_fin;
     IF start_date IS NULL THEN RAISE EXCEPTION 'pedido_invalid_sale'; END IF;
   ELSE
     start_date := coalesce((i.panel_snapshot->>'fechaInicio')::date,current_date);
     -- Expired commercial terms must be accepted again; never silently reprice a paid order.
     IF p.expira_at <= clock_timestamp() AND EXISTS (
       SELECT 1 FROM public.planes WHERE id=i.plan_id AND (NOT activo OR precio<>i.precio OR ciclo_pago<>i.ciclo_pago))
       THEN RAISE EXCEPTION 'pedido_terms_changed'; END IF;
     IF p.expira_at <= clock_timestamp() AND p.canal='whatsapp'
       AND private.mt_catalog_currency(i.plan_id) IS DISTINCT FROM p.moneda
       THEN RAISE EXCEPTION 'pedido_terms_changed'; END IF;
     UPDATE public.reservas_perfil SET cerrada_at=clock_timestamp() WHERE item_id=i.id AND cerrada_at IS NULL;
     IF coalesce(i.panel_snapshot->>'estado','activo')='activo' THEN
       IF profile IS NULL THEN
         SELECT n INTO profile FROM generate_series(1,s.perfiles_disponibles) n WHERE NOT EXISTS (
           SELECT 1 FROM public.ventas WHERE servicio_id=s.id AND perfil_numero=n AND estado='activo' AND archivado_at IS NULL)
           AND NOT EXISTS (SELECT 1 FROM public.reservas_perfil WHERE servicio_id=s.id AND perfil_numero=n
             AND cerrada_at IS NULL AND expira_at>clock_timestamp()) ORDER BY n LIMIT 1;
       END IF;
       IF profile IS NULL OR profile>s.perfiles_disponibles OR s.perfiles_ocupados>=s.perfiles_disponibles
         THEN RAISE EXCEPTION 'pedido_no_stock'; END IF;
     END IF;
   END IF;
   end_date := coalesce((i.panel_snapshot->>'fechaFin')::date,(start_date + make_interval(months =>
     CASE i.ciclo_pago WHEN 'mensual' THEN 1 WHEN 'trimestral' THEN 3 WHEN 'semestral' THEN 6 ELSE 12 END))::date);
   IF i.tipo='nueva' THEN
     result := public.create_venta_with_initial_payment(p_cliente_id=>p.tercero_id,p_servicio_id=>s.id,
       p_categoria_id=>i.categoria_id,p_estado=>coalesce(i.panel_snapshot->>'estado','activo')::public.venta_estado_enum,
       p_perfil_numero=>profile,p_perfil_nombre=>i.panel_snapshot->>'perfilNombre',p_codigo=>i.panel_snapshot->>'codigo',
       p_notas=>i.panel_snapshot->>'notas',p_fecha_inicio=>start_date,p_fecha_fin=>end_date,p_ciclo_pago=>i.ciclo_pago,
       p_precio_original=>i.precio,p_descuento=>i.descuento,p_total_original=>i.total,p_moneda_original=>p.moneda,
       p_total_usd=>round(i.total/p.exchange_rate,4),p_exchange_rate=>p.exchange_rate,
       p_metodo_pago_id=>i.panel_snapshot->>'metodoPagoId',p_metodo_pago_nombre_snapshot=>coalesce(i.panel_snapshot->>'metodoPagoNombre','Yappy'),
       p_plan_id=>i.plan_id,p_plan_nombre_snapshot=>i.plan_nombre_snapshot,p_plan_tipo_nombre_snapshot=>i.plan_tipo_nombre_snapshot,
       p_created_by=>auth.uid(),p_idempotency_key=>NULL);
   ELSE
     PERFORM public.create_venta_payment(p_venta_id=>i.venta_id,p_fecha_inicio=>start_date,p_fecha_fin=>end_date,p_ciclo_pago=>i.ciclo_pago,
       p_precio_original=>i.precio,p_descuento=>i.descuento,p_total_original=>i.total,p_moneda_original=>p.moneda,
       p_total_usd=>round(i.total/p.exchange_rate,4),p_exchange_rate=>p.exchange_rate,p_metodo_pago_id=>NULL,
       p_metodo_pago_nombre_snapshot=>'Yappy',p_plan_id=>i.plan_id,p_plan_nombre_snapshot=>i.plan_nombre_snapshot,
       p_plan_tipo_nombre_snapshot=>i.plan_tipo_nombre_snapshot,p_created_by=>auth.uid(),p_idempotency_key=>NULL);
     result := i.venta_id;
     UPDATE public.ventas SET respuesta_cliente=NULL,respuesta_cliente_at=NULL WHERE id=result;
   END IF;
   UPDATE public.pedido_items SET estado='aplicado',venta_id_resultante=result,perfil_numero=profile WHERE id=i.id;
 END LOOP;
 UPDATE public.pedidos SET delivery_state=CASE WHEN EXISTS (SELECT 1 FROM public.pedido_items WHERE pedido_id=p.id AND estado='pendiente')
   THEN 'parcial' ELSE 'asignado' END,estado=CASE WHEN EXISTS (SELECT 1 FROM public.pedido_items WHERE pedido_id=p.id AND estado='pendiente')
   THEN 'pagado' ELSE 'entregado' END,notas=NULL WHERE id=p.id;
 UPDATE public.intereses SET estado='convertido' WHERE contact_id=p.contact_id AND estado IN ('esperando','avisado')
   AND categoria_id IN (SELECT categoria_id FROM public.pedido_items WHERE pedido_id=p.id);
 PERFORM private.mt_order_event('pedido.asignado',p.id,CASE WHEN p_selected IS NOT NULL
   THEN current_setting('movietime.correlation_id',true) ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION private.mt_apply_order(uuid,uuid[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.mt_panel_checkout(p_groups jsonb,p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g jsonb; j jsonb; first_id uuid; order_id uuid; existing uuid; plan public.planes%ROWTYPE;
 s public.servicios%ROWTYPE; price numeric; discount numeric; item_total numeric; type_name text;
BEGIN
 existing := private.mt_intent('panel',p_idempotency_key);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 IF jsonb_typeof(p_groups) IS DISTINCT FROM 'array' OR jsonb_array_length(p_groups) NOT BETWEEN 1 AND 10
   THEN RAISE EXCEPTION 'pedido_invalid'; END IF;
 IF (SELECT count(DISTINCT x->>'clienteId') FROM jsonb_array_elements(p_groups) x)<>1
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_groups) x GROUP BY x->>'moneda' HAVING count(*)>1)
   THEN RAISE EXCEPTION 'pedido_invalid'; END IF;
 PERFORM s1.id FROM public.servicios s1 WHERE s1.id IN (SELECT item->>'servicioId' FROM jsonb_array_elements(p_groups) x,
   LATERAL jsonb_array_elements(x->'items') item) ORDER BY s1.id FOR UPDATE;
 FOR g IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
   IF NOT EXISTS (SELECT 1 FROM public.terceros WHERE id=g->>'clienteId' AND active)
     OR NOT EXISTS (SELECT 1 FROM public.currencies WHERE code=g->>'moneda' AND activo)
     OR jsonb_typeof(g->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(g->'items') NOT BETWEEN 1 AND 100
     OR (g->>'exchangeRate')::numeric <= 0 OR (g->>'exchangeRate')::numeric='NaN'::numeric
     OR (g->>'moneda'='USD' AND (g->>'exchangeRate')::numeric<>1) THEN RAISE EXCEPTION 'pedido_invalid'; END IF;
   INSERT INTO public.pedidos(tercero_id,canal,moneda,exchange_rate,expira_at,estado,payment_state)
     VALUES(g->>'clienteId','panel',g->>'moneda',(g->>'exchangeRate')::numeric,now()+interval '1 day','pagado','cubierto')
     RETURNING id INTO order_id;
   first_id := coalesce(first_id,order_id);
   UPDATE public.pedidos SET panel_batch_id=first_id WHERE id=order_id;
   FOR j IN SELECT value FROM jsonb_array_elements(g->'items') LOOP
     SELECT * INTO plan FROM public.planes WHERE id=j->>'planId' AND activo;
     IF NOT FOUND THEN RAISE EXCEPTION 'pedido_invalid_plan'; END IF;
     SELECT * INTO s FROM public.servicios WHERE id=j->>'servicioId';
     IF NOT FOUND OR s.categoria_id<>plan.categoria_id OR s.plan_tipo_id IS DISTINCT FROM plan.plan_tipo_id
       OR j->>'cicloPago' IS DISTINCT FROM plan.ciclo_pago::text OR j->>'estado' NOT IN ('activo','inactivo')
       OR (j->>'fechaFin')::date < (j->>'fechaInicio')::date THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
     price := (j->>'precio')::numeric; discount := (j->>'descuento')::numeric;
     IF price IS NULL OR price<0 OR price='NaN'::numeric OR price<>round(price,2)
       OR discount IS NULL OR discount NOT BETWEEN 0 AND 100 OR discount='NaN'::numeric
       THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
     -- Operators may negotiate price; only authenticated panel checkout admits overrides.
     item_total := round(price*(1-discount/100),2);
     SELECT nombre INTO type_name FROM public.planes_tipos WHERE id=plan.plan_tipo_id;
     INSERT INTO public.pedido_items(pedido_id,tipo,plan_id,categoria_id,servicio_id,perfil_numero,ciclo_pago,
       precio,descuento,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot,panel_snapshot)
       VALUES(order_id,'nueva',plan.id,plan.categoria_id,s.id,(j->>'perfilNumero')::integer,plan.ciclo_pago,
         price,discount,item_total,plan.nombre,coalesce(type_name,''),j);
   END LOOP;
   UPDATE public.pedidos SET total=(SELECT sum(total) FROM public.pedido_items WHERE pedido_id=order_id) WHERE id=order_id;
   PERFORM private.mt_order_event('pedido.confirmado',order_id);
   INSERT INTO public.pedido_pagos(pedido_id,source,monto) SELECT order_id,'manual',total FROM public.pedidos WHERE id=order_id AND total>0;
   PERFORM private.mt_order_event('pedido.pagado',order_id);
   PERFORM private.mt_apply_order(order_id); -- Any failed item rolls back the ENTIRE panel cart.
 END LOOP;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(),'panel',p_idempotency_key,first_id,now());
 RETURN first_id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_panel_checkout(jsonb,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mt_panel_checkout(jsonb,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

-- Reuse existing atomic financial RPC bodies; allow an explicit service order context.
CREATE OR REPLACE FUNCTION public.create_venta_payment(p_venta_id text, p_fecha_inicio date, p_fecha_fin date, p_ciclo_pago ciclo_pago_enum, p_precio_original numeric, p_descuento numeric, p_total_original numeric, p_moneda_original text, p_total_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_plan_id text DEFAULT NULL::text, p_plan_nombre_snapshot text DEFAULT NULL::text, p_plan_tipo_nombre_snapshot text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid(), p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_numero_periodo INTEGER;
  v_periodo_id TEXT;
  v_pago_id TEXT;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF NOT public.is_authenticated() AND NOT private.mt_service_order_context() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by IS DISTINCT FROM v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_venta_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_venta_id, 0));

  SELECT COALESCE(MAX(numero_periodo), 0) + 1
    INTO v_numero_periodo
  FROM venta_periodos
  WHERE venta_id = p_venta_id;

  INSERT INTO venta_periodos (
    venta_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_fin,
    ciclo_pago,
    plan_id,
    plan_nombre_snapshot,
    plan_tipo_nombre_snapshot,
    precio_original,
    descuento,
    total_original,
    moneda_original,
    total_usd,
    exchange_rate,
    created_by
  )
  VALUES (
    p_venta_id,
    v_numero_periodo,
    CASE WHEN v_numero_periodo = 1 THEN 'inicial'::periodo_tipo_enum ELSE 'renovacion'::periodo_tipo_enum END,
    p_fecha_inicio,
    p_fecha_fin,
    p_ciclo_pago,
    NULLIF(p_plan_id, ''),
    COALESCE(NULLIF(p_plan_nombre_snapshot, ''), ''),
    COALESCE(NULLIF(p_plan_tipo_nombre_snapshot, ''), ''),
    p_precio_original,
    COALESCE(p_descuento, 0),
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    v_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    p_venta_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    v_created_by
  )
  RETURNING id INTO v_pago_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_venta_payment', v_pago_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_pago_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.create_venta_with_initial_payment(p_cliente_id text, p_servicio_id text, p_categoria_id text, p_estado venta_estado_enum, p_perfil_numero integer, p_perfil_nombre text, p_codigo text, p_notas text, p_fecha_inicio date, p_fecha_fin date, p_ciclo_pago ciclo_pago_enum, p_precio_original numeric, p_descuento numeric, p_total_original numeric, p_moneda_original text, p_total_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_plan_id text DEFAULT NULL::text, p_plan_nombre_snapshot text DEFAULT NULL::text, p_plan_tipo_nombre_snapshot text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid(), p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_catalog'
AS $function$
DECLARE
  v_venta_id TEXT;
  v_periodo_id TEXT;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF v_created_by IS NULL AND NOT private.mt_service_order_context() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by IS DISTINCT FROM v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_venta_with_initial_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

  INSERT INTO ventas (
    cliente_id,
    servicio_id,
    categoria_id,
    estado,
    perfil_numero,
    perfil_nombre,
    codigo,
    notas,
    created_by
  )
  VALUES (
    NULLIF(p_cliente_id, ''),
    p_servicio_id,
    p_categoria_id,
    COALESCE(p_estado, 'activo'::venta_estado_enum),
    p_perfil_numero,
    NULLIF(p_perfil_nombre, ''),
    NULLIF(p_codigo, ''),
    NULLIF(p_notas, ''),
    v_created_by
  )
  RETURNING id INTO v_venta_id;

  INSERT INTO venta_periodos (
    venta_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_fin,
    ciclo_pago,
    plan_id,
    plan_nombre_snapshot,
    plan_tipo_nombre_snapshot,
    precio_original,
    descuento,
    total_original,
    moneda_original,
    total_usd,
    exchange_rate,
    created_by
  )
  VALUES (
    v_venta_id,
    1,
    'inicial'::periodo_tipo_enum,
    p_fecha_inicio,
    p_fecha_fin,
    p_ciclo_pago,
    NULLIF(p_plan_id, ''),
    COALESCE(NULLIF(p_plan_nombre_snapshot, ''), ''),
    COALESCE(NULLIF(p_plan_tipo_nombre_snapshot, ''), ''),
    p_precio_original,
    COALESCE(p_descuento, 0),
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    v_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    v_venta_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    v_created_by
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_venta_with_initial_payment', v_venta_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_venta_id;
END;
$function$
;

GRANT EXECUTE ON FUNCTION private.mt_service_order_context() TO authenticated;
-- The original initial-sale RPC is invoker: name resolution needs schema usage.
-- This grants no execute privilege on the private orchestration functions.
GRANT USAGE ON SCHEMA private TO authenticated;
