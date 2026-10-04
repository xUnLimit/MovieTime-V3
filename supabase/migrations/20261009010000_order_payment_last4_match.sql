-- "Ya pague": el cliente da los ultimos 4 digitos del codigo de confirmacion de Yappy y el servidor lo cruza con
-- el correo (yappy_payments). Solo una coincidencia unica por monto pendiente + 4 digitos + ventana confirma, y
-- lo hace por el mismo camino atomico e idempotente de 'pago CODIGO' (mt_reconcile_order). Lo demas pasa a revision.
-- Forward-only y aditiva: no cambia firmas existentes; mt_list_orders solo agrega la clave reviewCandidate.

-- Marca el pedido como "por revisar" y deja el pago candidato cruzado para la persona que lo confirma en Cobros.
CREATE FUNCTION private.mt_flag_order_review(p_order uuid, p_last4 text, p_missing numeric, p_outcome text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.pedidos%ROWTYPE; cfg public.pedido_pago_ajustes%ROWTYPE; reason text;
BEGIN
 SELECT * INTO p FROM public.pedidos WHERE id=p_order;
 SELECT * INTO cfg FROM public.pedido_pago_ajustes WHERE id='global';
 reason:=CASE p_outcome
   WHEN 'intentos_excedidos' THEN 'El cliente agotó los intentos con los últimos 4 dígitos'
   WHEN 'fuera_de_ventana' THEN 'Pago fuera de la ventana del pedido'
   WHEN 'monto_menor' THEN 'Pago menor al monto pendiente'
   WHEN 'monto_mayor' THEN 'Pago mayor al monto pendiente'
   WHEN 'codigo_usado' THEN 'El pago ya fue asignado a otro pedido'
   ELSE 'Sin coincidencia única con los últimos 4 dígitos' END;
 UPDATE public.pedidos SET estado='pago_en_revision',notas='El cliente indicó que ya pagó. ' || reason
   WHERE id=p.id AND estado IN ('borrador','esperando_pago') AND delivery_state='pendiente';
 UPDATE public.yappy_payments y SET requiere_revision=true,revision_pedido_id=p.id,revision_motivo=CASE
     WHEN y.paid_at<p.created_at-make_interval(mins=>cfg.margen_minutos)
       OR y.paid_at>p.created_at+make_interval(hours=>cfg.ventana_horas) THEN 'Pago fuera de la ventana del pedido'
     WHEN y.amount<p_missing THEN 'Pago menor al monto pendiente'
     WHEN y.amount>p_missing THEN 'Pago mayor al monto pendiente'
     ELSE 'Coincide en monto; confirmar manualmente' END
   WHERE y.id IN (
     SELECT c.id FROM public.yappy_payments c JOIN public.yappy_mail_messages m ON m.id=c.mail_message_id
     WHERE m.dmarc_pass AND m.status='extraido' AND c.match_status NOT IN ('registrado','descartado')
       AND NOT EXISTS (SELECT 1 FROM public.pedido_pagos pp WHERE pp.yappy_payment_id=c.id)
       AND c.currency=p.moneda AND (c.revision_pedido_id IS NULL OR c.revision_pedido_id=p.id)
       AND c.paid_at>=p.created_at-make_interval(mins=>cfg.margen_minutos) AND c.paid_at<=p.created_at+interval '30 days'
       AND ((p_last4 IS NOT NULL AND right(c.confirmation_code,4)=p_last4)
         OR (c.amount=p_missing AND c.paid_at<=p.created_at+make_interval(hours=>cfg.ventana_horas)))
     ORDER BY c.paid_at DESC LIMIT 5);
END;
$$;
REVOKE ALL ON FUNCTION private.mt_flag_order_review(uuid,text,numeric,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mt_match_order_payment(p_order_id uuid,p_last4 text,p_wa_id text,p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; p public.pedidos%ROWTYPE; cfg public.pedido_pago_ajustes%ROWTYPE; op text;
 received numeric; missing numeric; exact_count integer; last4_count integer; payment public.yappy_payments%ROWTYPE;
 outcome text; attempts_order integer; attempts_wa integer; state text;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 IF p_last4 IS NOT NULL AND p_last4 !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'pedido_invalid_receipt'; END IF;
 op:='last4:' || p_order_id::text || ':' || coalesce(p_last4,'-');
 existing:=private.mt_intent(op,p_idempotency_key,p_wa_id);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR p.contact_id IS DISTINCT FROM p_wa_id THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 IF p.estado IN ('cancelado','expirado') THEN RAISE EXCEPTION 'pedido_cancelled'; END IF;
 SELECT * INTO cfg FROM public.pedido_pago_ajustes WHERE id='global';
 SELECT coalesce(sum(monto),0)-p.refunded_amount-p.excess_settled_amount INTO received FROM public.pedido_pagos WHERE pedido_id=p.id;
 missing:=p.total-received;
 IF missing<=0 THEN
   INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(p_wa_id),op,p_idempotency_key,p.id,now());
   RETURN p.id::text;
 END IF;
 SELECT count(*) FILTER (WHERE pedido_id=p.id),count(*) INTO attempts_order,attempts_wa FROM public.intentos_comprobante
   WHERE wa_id=p_wa_id AND codigo LIKE '****%' AND created_at>now()-interval '1 hour';
 IF attempts_order>=cfg.max_intentos OR attempts_wa>=cfg.max_intentos THEN outcome:='intentos_excedidos';
 ELSIF p_last4 IS NULL THEN outcome:='no_encontrado';
 ELSE
   SELECT count(*) FILTER (WHERE y.amount=missing AND y.paid_at>=p.created_at-make_interval(mins=>cfg.margen_minutos)
       AND y.paid_at<=p.created_at+make_interval(hours=>cfg.ventana_horas)),count(*)
     INTO exact_count,last4_count
     FROM public.yappy_payments y JOIN public.yappy_mail_messages m ON m.id=y.mail_message_id
     WHERE m.dmarc_pass AND m.status='extraido' AND y.match_status NOT IN ('registrado','descartado')
       AND NOT EXISTS (SELECT 1 FROM public.pedido_pagos pp WHERE pp.yappy_payment_id=y.id)
       AND y.currency=p.moneda AND right(y.confirmation_code,4)=p_last4
       AND y.paid_at>=p.created_at-make_interval(mins=>cfg.margen_minutos) AND y.paid_at<=p.created_at+interval '30 days';
   IF exact_count=1 THEN
     SELECT y.* INTO payment FROM public.yappy_payments y JOIN public.yappy_mail_messages m ON m.id=y.mail_message_id
       WHERE m.dmarc_pass AND m.status='extraido' AND y.match_status NOT IN ('registrado','descartado')
         AND NOT EXISTS (SELECT 1 FROM public.pedido_pagos pp WHERE pp.yappy_payment_id=y.id)
         AND y.currency=p.moneda AND right(y.confirmation_code,4)=p_last4 AND y.amount=missing
         AND y.paid_at>=p.created_at-make_interval(mins=>cfg.margen_minutos)
         AND y.paid_at<=p.created_at+make_interval(hours=>cfg.ventana_horas);
     -- Mismo camino atomico e idempotente que 'pago CODIGO'; la llave derivada evita chocar con esta operacion.
     PERFORM public.mt_reconcile_order(p.id,payment.confirmation_code,p_wa_id,md5(p_idempotency_key::text || ':reconcile')::uuid);
     SELECT payment_state INTO state FROM public.pedidos WHERE id=p.id;
     outcome:=CASE WHEN state IN ('cubierto','exceso') THEN 'confirmado' ELSE 'codigo_usado' END;
   ELSIF exact_count=0 AND last4_count=1 THEN
     SELECT y.* INTO payment FROM public.yappy_payments y JOIN public.yappy_mail_messages m ON m.id=y.mail_message_id
       WHERE m.dmarc_pass AND m.status='extraido' AND y.match_status NOT IN ('registrado','descartado')
         AND NOT EXISTS (SELECT 1 FROM public.pedido_pagos pp WHERE pp.yappy_payment_id=y.id)
         AND y.currency=p.moneda AND right(y.confirmation_code,4)=p_last4
         AND y.paid_at>=p.created_at-make_interval(mins=>cfg.margen_minutos) AND y.paid_at<=p.created_at+interval '30 days';
     outcome:=CASE WHEN payment.paid_at>p.created_at+make_interval(hours=>cfg.ventana_horas) THEN 'fuera_de_ventana'
       WHEN payment.amount<missing THEN 'monto_menor' WHEN payment.amount>missing THEN 'monto_mayor' ELSE 'no_encontrado' END;
   ELSE outcome:='no_encontrado'; END IF;
 END IF;
 IF outcome<>'confirmado' THEN PERFORM private.mt_flag_order_review(p.id,p_last4,missing,outcome); END IF;
 -- reintento=true: no cuenta contra el limite de 'pago CODIGO'; este flujo se limita por el prefijo '****'.
 INSERT INTO public.intentos_comprobante(pedido_id,wa_id,codigo,resultado,pendiente,idempotency_key,respuesta,reintento)
   VALUES(p.id,p_wa_id,'****' || coalesce(p_last4,'----'),outcome,false,p_idempotency_key,
     jsonb_build_object('pedidoId',p.id,'resultado',outcome,'via','ultimos4'),true) ON CONFLICT(idempotency_key) DO NOTHING;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(p_wa_id),op,p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_match_order_payment(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_match_order_payment(uuid,text,text,uuid) TO service_role;

-- La proyeccion del panel agrega el pago candidato ya cruzado; el bot sigue usando mt_read_order sin ese dato.
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
   FROM (SELECT id,created_at,total FROM public.pedidos ORDER BY created_at DESC LIMIT 200) p),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_list_orders() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mt_list_orders() TO authenticated;
NOTIFY pgrst, 'reload schema';
