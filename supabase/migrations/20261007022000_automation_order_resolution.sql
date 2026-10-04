-- Explicit administrator resolutions. Automatic reconciliation keeps all-or-none allocation.
CREATE TABLE public.pedido_resoluciones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pedido_id uuid NOT NULL REFERENCES public.pedidos(id),
 tipo text NOT NULL CHECK (tipo IN ('principal_reembolsado','terminos_aceptados','asignacion_parcial')),
 monto numeric(12,2) NOT NULL CHECK (monto>=0), moneda text NOT NULL REFERENCES public.currencies(code),
 reference text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by uuid NOT NULL REFERENCES public.usuarios(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pedido_resoluciones_pedido_idx ON public.pedido_resoluciones(pedido_id);
CREATE UNIQUE INDEX pedido_principal_reference_idx ON public.pedido_resoluciones(reference) WHERE tipo='principal_reembolsado';
ALTER TABLE public.pedido_resoluciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_resoluciones FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.pedido_resoluciones TO authenticated;
CREATE POLICY pedido_resoluciones_admin_read ON public.pedido_resoluciones FOR SELECT TO authenticated
 USING ((SELECT private.auth_role())='admin' AND (SELECT public.is_authenticated()));

CREATE FUNCTION private.mt_item_quote(p_item uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE i public.pedido_items%ROWTYPE; plan public.planes%ROWTYPE; period public.venta_periodos%ROWTYPE;
 price numeric; discount numeric; cycle public.ciclo_pago_enum;
BEGIN
 SELECT * INTO i FROM public.pedido_items WHERE id=p_item;
 IF i.tipo='nueva' THEN
   SELECT * INTO plan FROM public.planes WHERE id=i.plan_id AND activo;
   IF NOT FOUND THEN RAISE EXCEPTION 'pedido_invalid_plan'; END IF;
   IF EXISTS (SELECT 1 FROM public.pedidos WHERE id=i.pedido_id AND canal='whatsapp'
     AND moneda IS DISTINCT FROM private.mt_catalog_currency(i.plan_id))
     THEN RAISE EXCEPTION 'pedido_currency_mismatch'; END IF;
   price:=plan.precio; cycle:=plan.ciclo_pago; discount:=i.descuento;
 ELSE
   SELECT * INTO period FROM public.venta_periodos WHERE venta_id=i.venta_id ORDER BY numero_periodo DESC LIMIT 1;
   IF NOT FOUND THEN RAISE EXCEPTION 'pedido_invalid_sale'; END IF;
   IF period.moneda_original IS DISTINCT FROM (SELECT moneda FROM public.pedidos WHERE id=i.pedido_id)
     THEN RAISE EXCEPTION 'pedido_currency_mismatch'; END IF;
   price:=period.precio_original; discount:=period.descuento; cycle:=period.ciclo_pago;
 END IF;
 RETURN jsonb_build_object('id',i.id,'oldTotal',i.total,'newTotal',round(price*(1-discount/100),2),
   'precio',price,'descuento',discount,'cicloPago',cycle);
END;
$$;
REVOKE ALL ON FUNCTION private.mt_item_quote(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mt_order_resolution_quote(p_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.pedidos%ROWTYPE; items jsonb; total numeric;
BEGIN
 IF NOT public.is_authenticated() OR private.auth_role() IS DISTINCT FROM 'admin'
   THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id;
 IF NOT FOUND OR p.estado='cancelado' THEN RAISE EXCEPTION 'pedido_invalid_state'; END IF;
 SELECT coalesce(jsonb_agg(private.mt_item_quote(id) ORDER BY id),'[]'::jsonb) INTO items
   FROM public.pedido_items WHERE pedido_id=p.id AND estado='pendiente';
 SELECT coalesce(sum((q->>'newTotal')::numeric),0) INTO total FROM jsonb_array_elements(items) q;
 total:=total+coalesce((SELECT sum(i.total) FROM public.pedido_items i WHERE pedido_id=p.id AND estado='aplicado'),0);
 RETURN jsonb_build_object('items',items,'total',total,'difference',total-p.total);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_order_resolution_quote(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mt_order_resolution_quote(uuid) TO authenticated;

CREATE FUNCTION public.mt_resolve_order(p_order_id uuid,p_action text,p_expected_amount numeric,p_reference text,
 p_items uuid[],p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.pedidos%ROWTYPE; existing uuid; paid numeric; allocated numeric; remaining numeric;
 quote jsonb; q jsonb; ttl integer; old_total numeric;
BEGIN
 IF NOT public.is_authenticated() OR private.auth_role() IS DISTINCT FROM 'admin'
   THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 existing:=private.mt_intent('resolution:' || p_order_id::text || ':' || p_action,p_idempotency_key);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 IF p_action IS NULL OR p_action NOT IN ('refund','accept_quote','assign_items') OR p_expected_amount IS NULL
   OR p_expected_amount<0 OR p_expected_amount='NaN'::numeric THEN RAISE EXCEPTION 'pedido_invalid_resolution'; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR p.estado='cancelado' THEN RAISE EXCEPTION 'pedido_invalid_state'; END IF;
 IF p.contact_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('contact:' || p.contact_id,0)); END IF;
 PERFORM s.id FROM public.servicios s WHERE s.id IN (SELECT servicio_id FROM public.pedido_items WHERE pedido_id=p.id)
   ORDER BY s.id FOR UPDATE;
 SELECT coalesce(sum(monto),0) INTO paid FROM public.pedido_pagos WHERE pedido_id=p.id;
 SELECT coalesce(sum(total),0) INTO allocated FROM public.pedido_items WHERE pedido_id=p.id AND estado='aplicado';
 remaining:=greatest(least(paid-p.refunded_amount-p.excess_settled_amount,p.total)-allocated,0);
 IF p_action='refund' THEN
   IF p_expected_amount<>remaining OR remaining<=0 OR p_reference IS NULL
     OR p_reference !~ '^[A-Za-z0-9 ._:/-]{4,100}$' THEN RAISE EXCEPTION 'pedido_refund_changed'; END IF;
   INSERT INTO public.pedido_resoluciones(pedido_id,tipo,monto,moneda,reference,metadata,created_by)
     VALUES(p.id,'principal_reembolsado',remaining,p.moneda,btrim(p_reference),
       jsonb_build_object('previous_total',p.total,'allocated_amount',allocated),auth.uid());
   UPDATE public.pedido_items SET estado='cancelado' WHERE pedido_id=p.id AND estado='pendiente';
   UPDATE public.reservas_perfil SET cerrada_at=clock_timestamp() WHERE pedido_id=p.id AND cerrada_at IS NULL;
   UPDATE public.intentos_comprobante SET pendiente=false WHERE pedido_id=p.id;
   UPDATE public.pedidos SET refunded_amount=refunded_amount+remaining,total=allocated,
     estado=CASE WHEN allocated=0 THEN 'cancelado' ELSE 'entregado' END,
     payment_state=CASE WHEN allocated=0 THEN 'reembolsado' ELSE 'parcialmente_reembolsado' END,
     delivery_state=CASE WHEN allocated=0 THEN 'pendiente' ELSE 'asignado' END,
     notas='Devolución externa registrada con referencia financiera.' WHERE id=p.id;
 ELSIF p_action='accept_quote' THEN
   IF p.expira_at>clock_timestamp() OR NOT EXISTS (SELECT 1 FROM public.pedido_items WHERE pedido_id=p.id AND estado='pendiente')
     THEN RAISE EXCEPTION 'pedido_quote_not_expired'; END IF;
   PERFORM pl.id FROM public.planes pl WHERE pl.id IN (SELECT plan_id FROM public.pedido_items WHERE pedido_id=p.id AND estado='pendiente')
     ORDER BY pl.id FOR UPDATE;
   -- Renewal price/cycle must be read under the same sale lock as the financial RPC.
   PERFORM pg_advisory_xact_lock(hashtextextended(i.venta_id,0)) FROM public.pedido_items i
     WHERE i.pedido_id=p.id AND i.estado='pendiente' AND i.tipo='renovacion' ORDER BY i.venta_id;
   PERFORM v.id FROM public.ventas v WHERE v.id IN (SELECT venta_id FROM public.pedido_items
     WHERE pedido_id=p.id AND estado='pendiente' AND tipo='renovacion') ORDER BY v.id FOR UPDATE;
   quote:=public.mt_order_resolution_quote(p.id);
   IF (quote->>'total')::numeric<>p_expected_amount THEN RAISE EXCEPTION 'pedido_quote_changed'; END IF;
   old_total:=p.total;
   FOR q IN SELECT value FROM jsonb_array_elements(quote->'items') LOOP
     UPDATE public.pedido_items SET precio=(q->>'precio')::numeric,descuento=(q->>'descuento')::numeric,
       ciclo_pago=(q->>'cicloPago')::public.ciclo_pago_enum,total=(q->>'newTotal')::numeric WHERE id=(q->>'id')::uuid;
   END LOOP;
   SELECT reserva_ttl_minutos INTO ttl FROM public.catalogo_ajustes WHERE id='global';
   UPDATE public.pedidos SET total=p_expected_amount,expira_at=now()+make_interval(mins=>ttl),
     payment_state=CASE WHEN paid-p.refunded_amount-p.excess_settled_amount<p_expected_amount THEN 'parcial'
       WHEN paid-p.refunded_amount-p.excess_settled_amount>p_expected_amount THEN 'exceso' ELSE 'cubierto' END,
     estado=CASE WHEN paid-p.refunded_amount-p.excess_settled_amount<p_expected_amount THEN 'esperando_pago' ELSE 'pagado' END,
     notas='Condiciones actualizadas y aceptadas por el administrador.' WHERE id=p.id;
   IF paid-p.refunded_amount-p.excess_settled_amount>p_expected_amount THEN
     INSERT INTO public.pedido_excedentes(pedido_id,monto,moneda) VALUES(p.id,paid-p.refunded_amount-p.excess_settled_amount-p_expected_amount,p.moneda)
       ON CONFLICT(pedido_id) DO UPDATE SET monto=EXCLUDED.monto,estado='pendiente',updated_at=now();
   ELSE
     DELETE FROM public.pedido_excedentes WHERE pedido_id=p.id AND estado='pendiente';
   END IF;
   INSERT INTO public.pedido_resoluciones(pedido_id,tipo,monto,moneda,metadata,created_by)
     VALUES(p.id,'terminos_aceptados',p_expected_amount,p.moneda,jsonb_build_object('previous_total',old_total,'quote',quote),auth.uid());
 ELSE
   IF paid-p.refunded_amount-p.excess_settled_amount<p.total OR p.estado<>'pagado' OR p_items IS NULL
     OR cardinality(p_items) NOT BETWEEN 1 AND 100 OR array_position(p_items,NULL) IS NOT NULL
     OR cardinality(p_items)<>(SELECT count(DISTINCT x) FROM unnest(p_items) x)
     OR cardinality(p_items)<>(SELECT count(*) FROM public.pedido_items WHERE pedido_id=p.id AND id=ANY(p_items) AND estado='pendiente')
     OR p_expected_amount IS DISTINCT FROM (SELECT sum(total) FROM public.pedido_items WHERE pedido_id=p.id AND id=ANY(p_items))
     THEN RAISE EXCEPTION 'pedido_invalid_partial_assignment'; END IF;
   PERFORM private.mt_apply_order(p.id,p_items); -- The selected subset is still one transaction.
   INSERT INTO public.pedido_resoluciones(pedido_id,tipo,monto,moneda,metadata,created_by)
     VALUES(p.id,'asignacion_parcial',p_expected_amount,p.moneda,jsonb_build_object('item_ids',to_jsonb(p_items)),auth.uid());
 END IF;
 PERFORM private.mt_order_event('pedido.resuelto',p.id,p_idempotency_key::text);
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(),'resolution:' || p.id::text || ':' || p_action,p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_resolve_order(uuid,text,numeric,text,uuid[],uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mt_resolve_order(uuid,text,numeric,text,uuid[],uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
