-- Acciones manuales del administrador sobre pedidos. Forward-only y aditiva: no cambia firmas ni columnas existentes.
--  * Eliminar: archivo lógico (deleted_at) de un pedido sin dinero ni servicios entregados; el historial se conserva.
--  * Registrar pago: ingreso manual (efectivo, transferencia...) con la misma cuenta que el cruce con Yappy.
--  * Marcar acceso entregado: pasa de «asignado» a «enviado» cuando el acceso se entregó fuera del bot.
-- Cada operación es idempotente (pedido_operaciones) y exige rol admin.
ALTER TABLE public.pedidos ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.pedidos ADD COLUMN deleted_by uuid REFERENCES public.usuarios(id);
ALTER TABLE public.pedido_pagos ADD COLUMN referencia text CHECK (referencia IS NULL OR length(btrim(referencia)) BETWEEN 1 AND 100);
ALTER TABLE public.pedido_pagos ADD COLUMN created_by uuid REFERENCES public.usuarios(id);

-- La lista del panel oculta los pedidos eliminados; el resto de la proyección no cambia.
CREATE OR REPLACE FUNCTION public.mt_list_orders() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_authenticated() THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(private.mt_read_order(p.id) || jsonb_build_object('reviewCandidate',(
     SELECT jsonb_build_object('code',y.confirmation_code,'amount',y.amount,'paidAt',y.paid_at,'reason',y.revision_motivo)
     FROM public.yappy_payments y WHERE y.revision_pedido_id=p.id AND y.requiere_revision
       AND y.match_status NOT IN ('registrado','descartado')
       AND NOT EXISTS (SELECT 1 FROM public.pedido_pagos pp WHERE pp.yappy_payment_id=y.id)
     ORDER BY (y.amount=p.total) DESC,y.paid_at DESC LIMIT 1)) ORDER BY p.created_at DESC)
   FROM (SELECT id,created_at,total FROM public.pedidos WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200) p),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_list_orders() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mt_list_orders() TO authenticated;

CREATE FUNCTION public.mt_delete_order(p_order_id uuid,p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; p public.pedidos%ROWTYPE;
BEGIN
 IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 existing:=private.mt_intent('delete:' || p_order_id::text,p_idempotency_key);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'pedido_not_found'; END IF;
 IF p.deleted_at IS NULL THEN
   -- Con dinero recibido o servicios asignados hay historial financiero: se cancela y devuelve antes, no se oculta.
   IF EXISTS (SELECT 1 FROM public.pedido_pagos WHERE pedido_id=p.id) OR p.delivery_state<>'pendiente'
     OR EXISTS (SELECT 1 FROM public.pedido_items WHERE pedido_id=p.id AND estado='aplicado')
     THEN RAISE EXCEPTION 'pedido_has_history'; END IF;
   UPDATE public.pedido_items SET estado='cancelado' WHERE pedido_id=p.id AND estado='pendiente';
   UPDATE public.reservas_perfil SET cerrada_at=clock_timestamp() WHERE pedido_id=p.id AND cerrada_at IS NULL;
   UPDATE public.pedidos SET estado='cancelado',deleted_at=now(),deleted_by=auth.uid() WHERE id=p.id;
 END IF;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(),'delete:' || p_order_id::text,p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_delete_order(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mt_delete_order(uuid,uuid) TO authenticated;

CREATE FUNCTION public.mt_register_order_payment(p_order_id uuid,p_amount numeric,p_reference text,p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; p public.pedidos%ROWTYPE; received numeric; ref text:=nullif(btrim(p_reference),'');
BEGIN
 IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 existing:=private.mt_intent('manual_payment:' || p_order_id::text,p_idempotency_key);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>=1000000 OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'pedido_invalid_amount'; END IF;
 IF ref IS NULL OR ref !~ '^[A-Za-z0-9 ._:/-]{3,100}$' THEN RAISE EXCEPTION 'pedido_invalid_reference'; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'pedido_not_found'; END IF;
 IF p.estado='cancelado' THEN RAISE EXCEPTION 'pedido_cancelled'; END IF;
 INSERT INTO public.pedido_pagos(pedido_id,source,yappy_payment_id,monto,referencia,created_by) VALUES(p.id,'manual',NULL,p_amount,ref,auth.uid());
 SELECT sum(monto)-p.refunded_amount-p.excess_settled_amount INTO received FROM public.pedido_pagos WHERE pedido_id=p.id;
 UPDATE public.pedidos SET payment_state=CASE WHEN received<p.total THEN 'parcial' WHEN received>p.total THEN 'exceso' ELSE 'cubierto' END,
   estado=CASE WHEN received>=p.total AND p.delivery_state='pendiente' THEN 'pagado'
     WHEN p.delivery_state<>'pendiente' THEN p.estado ELSE 'esperando_pago' END WHERE id=p.id;
 IF received>=p.total THEN PERFORM private.mt_order_event('pedido.pagado',p.id,p_idempotency_key::text); END IF;
 IF received>p.total THEN
   INSERT INTO public.pedido_excedentes(pedido_id,monto,moneda) VALUES(p.id,received-p.total,p.moneda)
     ON CONFLICT(pedido_id) DO UPDATE SET monto=EXCLUDED.monto,estado='pendiente',updated_at=now();
 END IF;
 IF received>=p.total THEN
   BEGIN
     PERFORM private.mt_apply_order(p.id); -- Subtransacción: todas las asignaciones o ninguna; el pago se conserva si falla.
   EXCEPTION WHEN OTHERS THEN
     UPDATE public.pedidos SET estado='pagado',notas='Pago registrado. Asignación pendiente de revisión.' WHERE id=p.id;
   END;
 END IF;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(),'manual_payment:' || p_order_id::text,p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_register_order_payment(uuid,numeric,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mt_register_order_payment(uuid,numeric,text,uuid) TO authenticated;

CREATE FUNCTION public.mt_mark_order_delivered(p_order_id uuid,p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; p public.pedidos%ROWTYPE;
BEGIN
 IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 existing:=private.mt_intent('manual_delivery:' || p_order_id::text,p_idempotency_key);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'pedido_not_found'; END IF;
 -- Solo se entrega lo ya asignado: sin servicios pendientes y con el cobro cubierto.
 IF p.estado IN ('cancelado','expirado') OR p.delivery_state<>'asignado' OR p.payment_state NOT IN ('cubierto','exceso')
   OR EXISTS (SELECT 1 FROM public.pedido_items WHERE pedido_id=p.id AND estado='pendiente')
   THEN RAISE EXCEPTION 'pedido_not_deliverable'; END IF;
 -- El acceso ya se entregó a mano: el envío automático pendiente se da por atendido para no repetirlo.
 UPDATE public.mt_order_deliveries SET status='accepted',accepted_at=now(),manual_actor=auth.uid(),lease_token=NULL,failure_code=NULL
   WHERE pedido_id=p.id AND status IN ('queued','leased','review');
 UPDATE public.pedidos SET delivery_state='enviado',estado='entregado' WHERE id=p.id;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(),'manual_delivery:' || p_order_id::text,p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_mark_order_delivered(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mt_mark_order_delivered(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
