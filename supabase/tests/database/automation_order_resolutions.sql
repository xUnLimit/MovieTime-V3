BEGIN;
SELECT no_plan();
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
 VALUES('00000000-0000-0000-0000-000000000000','d1111111-1111-4111-8111-111111111111','authenticated','authenticated','resolution-admin@example.test','',now());
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
 VALUES('00000000-0000-0000-0000-000000000000','f3333333-3333-4333-8333-333333333333','authenticated','authenticated','resolution-spare@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='f3333333-3333-4333-8333-333333333333';
UPDATE public.usuarios SET role='admin' WHERE id='d1111111-1111-4111-8111-111111111111';
INSERT INTO public.categorias(id,nombre,tipo) VALUES('d2222222-2222-4222-8222-222222222222','Resolution fixture','cliente');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES('d3333333-3333-4333-8333-333333333333','d2222222-2222-4222-8222-222222222222','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,ciclo_pago,precio)
 VALUES('d4444444-4444-4444-8444-444444444444','d2222222-2222-4222-8222-222222222222','d3333333-3333-4333-8333-333333333333','Resolution plan','mensual',10);
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
 SELECT id,'d2222222-2222-4222-8222-222222222222','d3333333-3333-4333-8333-333333333333','Resolution service','resolution@example.test','fixture-only',1
 FROM unnest(ARRAY['d5555555-5555-4555-8555-555555555555','d6666666-6666-4666-8666-666666666666','d7777777-7777-4777-8777-777777777777']) id;
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono)
 VALUES('d8888888-8888-4888-8888-888888888888','Resolution','Customer','cliente','50763333333');
SELECT set_config('request.jwt.claims','{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.pedidos(id,tercero_id,canal,moneda,total,estado,payment_state,expira_at,exchange_rate)
 VALUES('d9999999-9999-4999-8999-999999999999','d8888888-8888-4888-8888-888888888888','panel','USD',10,'esperando_pago','parcial',now()-interval '1 hour',1),
 ('e1111111-1111-4111-8111-111111111111','d8888888-8888-4888-8888-888888888888','panel','USD',10,'pagado','cubierto',now()-interval '1 hour',1),
 ('e2222222-2222-4222-8222-222222222222','d8888888-8888-4888-8888-888888888888','panel','USD',20,'pagado','cubierto',now()+interval '1 hour',1);
INSERT INTO public.pedido_items(id,pedido_id,tipo,plan_id,categoria_id,servicio_id,perfil_numero,ciclo_pago,precio,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot)
 VALUES('e3333333-3333-4333-8333-333333333333','d9999999-9999-4999-8999-999999999999','nueva','d4444444-4444-4444-8444-444444444444','d2222222-2222-4222-8222-222222222222','d5555555-5555-4555-8555-555555555555',1,'mensual',10,10,'Resolution plan','Individual'),
 ('e4444444-4444-4444-8444-444444444444','e1111111-1111-4111-8111-111111111111','nueva','d4444444-4444-4444-8444-444444444444','d2222222-2222-4222-8222-222222222222','d6666666-6666-4666-8666-666666666666',1,'mensual',10,10,'Resolution plan','Individual'),
 ('e5555555-5555-4555-8555-555555555555','e2222222-2222-4222-8222-222222222222','nueva','d4444444-4444-4444-8444-444444444444','d2222222-2222-4222-8222-222222222222','d7777777-7777-4777-8777-777777777777',1,'mensual',10,10,'Resolution plan','Individual'),
 ('e6666666-6666-4666-8666-666666666666','e2222222-2222-4222-8222-222222222222','nueva','d4444444-4444-4444-8444-444444444444','d2222222-2222-4222-8222-222222222222','d7777777-7777-4777-8777-777777777777',2,'mensual',10,10,'Resolution plan','Individual');
INSERT INTO public.pedido_pagos(pedido_id,source,monto) VALUES('d9999999-9999-4999-8999-999999999999','manual',4),
 ('e1111111-1111-4111-8111-111111111111','manual',10),('e2222222-2222-4222-8222-222222222222','manual',20);
UPDATE public.usuarios SET role='operador' WHERE id='d1111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT mt_order_resolution_quote('e1111111-1111-4111-8111-111111111111')$$,'42501','pedido_forbidden','operator cannot review private administrative resolution quotes');
SELECT throws_ok($$SELECT mt_resolve_order('d9999999-9999-4999-8999-999999999999','refund',4,'BANK-RESOLUTION',NULL,'e7777777-7777-4777-8777-777777777777')$$,'42501','pedido_forbidden','operator cannot record principal refunds');
RESET ROLE;
UPDATE public.usuarios SET role='admin' WHERE id='d1111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT ok(NOT has_function_privilege('service_role','public.mt_resolve_order(uuid,text,numeric,text,uuid[],uuid)','EXECUTE'),'service cannot approve manual financial resolutions');
SELECT throws_ok($$SELECT mt_resolve_order('d9999999-9999-4999-8999-999999999999','refund',5,'BANK-RESOLUTION',NULL,'e7777777-7777-4777-8777-777777777777')$$,'P0001','pedido_refund_changed','stale principal amount cannot be refunded');
SELECT lives_ok($$SELECT mt_resolve_order('d9999999-9999-4999-8999-999999999999','refund',4,'BANK-RESOLUTION',NULL,'e7777777-7777-4777-8777-777777777777')$$,'administrator records the verified external principal refund');
SELECT lives_ok($$SELECT mt_resolve_order('d9999999-9999-4999-8999-999999999999','refund',4,'BANK-RESOLUTION',NULL,'e7777777-7777-4777-8777-777777777777')$$,'refund replay remains idempotent even after cancellation');
SELECT is((SELECT refunded_amount FROM pedidos WHERE id='d9999999-9999-4999-8999-999999999999'),4::numeric,'principal refund is accounted once');
SELECT is((SELECT count(*) FROM pedido_resoluciones WHERE pedido_id='d9999999-9999-4999-8999-999999999999'),1::bigint,'refund has one auditable external reference');
SELECT is((SELECT estado FROM pedido_items WHERE id='e3333333-3333-4333-8333-333333333333'),'cancelado','unallocated item is cancelled after refund');
SELECT is((SELECT count(*) FROM ventas WHERE servicio_id='d5555555-5555-4555-8555-555555555555'),0::bigint,'refund cannot fabricate sale revenue');
RESET ROLE;
UPDATE public.planes SET precio=12 WHERE id='d4444444-4444-4444-8444-444444444444';
SET LOCAL ROLE authenticated;
SELECT is((mt_order_resolution_quote('e1111111-1111-4111-8111-111111111111')->>'difference')::numeric,2::numeric,'expired order shows an explicit price difference');
SELECT throws_ok($$SELECT mt_order_command('e1111111-1111-4111-8111-111111111111','retry','e8888888-8888-4888-8888-888888888888',NULL)$$,'P0001','pedido_terms_changed','expired paid order cannot silently accept new prices');
SELECT throws_ok($$SELECT mt_resolve_order('e1111111-1111-4111-8111-111111111111','accept_quote',11,NULL,NULL,'e9999999-9999-4999-8999-999999999999')$$,'P0001','pedido_quote_changed','stale displayed quote cannot alter the order');
SELECT lives_ok($$SELECT mt_resolve_order('e1111111-1111-4111-8111-111111111111','accept_quote',12,NULL,NULL,'e9999999-9999-4999-8999-999999999999')$$,'administrator explicitly accepts locked current terms');
SELECT is((SELECT total FROM pedidos WHERE id='e1111111-1111-4111-8111-111111111111'),12::numeric,'accepted total is persisted atomically');
SELECT is((SELECT estado FROM pedidos WHERE id='e1111111-1111-4111-8111-111111111111'),'esperando_pago','commercial increase requires the remaining money');
SELECT is((SELECT count(*) FROM ventas WHERE servicio_id='d6666666-6666-4666-8666-666666666666'),0::bigint,'quote acceptance does not allocate before funding');
RESET ROLE;
INSERT INTO public.pedido_pagos(pedido_id,source,monto) VALUES('e1111111-1111-4111-8111-111111111111','manual',2);
UPDATE public.pedidos SET estado='pagado',payment_state='cubierto' WHERE id='e1111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT mt_order_command('e1111111-1111-4111-8111-111111111111','retry','e8888888-8888-4888-8888-888888888888',NULL)$$,'funded accepted quote uses the existing financial sale RPC');
SELECT is((SELECT sum(p.monto_original) FROM pagos_venta p JOIN ventas v ON p.venta_id=v.id WHERE v.servicio_id='d6666666-6666-4666-8666-666666666666'),12::numeric,'accepted amount is allocated exactly once');
RESET ROLE;
INSERT INTO public.pedidos(id,tercero_id,canal,moneda,total,estado,payment_state,expira_at,exchange_rate)
 VALUES('f4444444-4444-4444-8444-444444444444','d8888888-8888-4888-8888-888888888888','panel','USD',12,'pagado','cubierto',now()-interval '1 hour',1);
INSERT INTO public.pedido_items(id,pedido_id,tipo,venta_id,plan_id,categoria_id,servicio_id,ciclo_pago,precio,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot)
 SELECT 'f5555555-5555-4555-8555-555555555555','f4444444-4444-4444-8444-444444444444','renovacion',venta_id_resultante,
   plan_id,categoria_id,servicio_id,'mensual',12,12,plan_nombre_snapshot,plan_tipo_nombre_snapshot
   FROM public.pedido_items WHERE id='e4444444-4444-4444-8444-444444444444';
INSERT INTO public.pedido_pagos(pedido_id,source,monto) VALUES('f4444444-4444-4444-8444-444444444444','manual',12);
SET LOCAL ROLE authenticated;
SELECT lives_ok(format($$SELECT create_venta_payment(p_venta_id=>%L,p_fecha_inicio=>%L::date,p_fecha_fin=>%L::date,
 p_ciclo_pago=>'mensual',p_precio_original=>15,p_descuento=>0,p_total_original=>15,p_moneda_original=>'USD',
 p_total_usd=>15,p_exchange_rate=>1,p_metodo_pago_id=>NULL,p_metodo_pago_nombre_snapshot=>'Yappy',p_idempotency_key=>NULL)$$,
 (SELECT venta_id_resultante FROM pedido_items WHERE id='e4444444-4444-4444-8444-444444444444'),
 (SELECT fecha_fin FROM venta_periodos WHERE venta_id=(SELECT venta_id_resultante FROM pedido_items WHERE id='e4444444-4444-4444-8444-444444444444') ORDER BY numero_periodo DESC LIMIT 1),
 (SELECT (fecha_fin+interval '1 month')::date FROM venta_periodos WHERE venta_id=(SELECT venta_id_resultante FROM pedido_items WHERE id='e4444444-4444-4444-8444-444444444444') ORDER BY numero_periodo DESC LIMIT 1)),
 'another legitimate renewal can establish updated commercial terms');
SELECT is((mt_order_resolution_quote('f4444444-4444-4444-8444-444444444444')->>'total')::numeric,15::numeric,'renewal quote follows the current financial period');
SELECT throws_ok($$SELECT mt_order_command('f4444444-4444-4444-8444-444444444444','retry','f6666666-6666-4666-8666-666666666666',NULL)$$,
 'P0001','pedido_terms_changed','expired renewal rejects changed price instead of silently extending the period');
RESET ROLE;
UPDATE public.venta_periodos SET moneda_original='ARS' WHERE venta_id=(SELECT venta_id_resultante
 FROM public.pedido_items WHERE id='e4444444-4444-4444-8444-444444444444') AND numero_periodo=2;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT mt_order_resolution_quote('f4444444-4444-4444-8444-444444444444')$$,
 'P0001','pedido_currency_mismatch','renewal quote cannot present a changed currency as the original order currency');
RESET ROLE;
UPDATE public.venta_periodos SET moneda_original='USD' WHERE venta_id=(SELECT venta_id_resultante
 FROM public.pedido_items WHERE id='e4444444-4444-4444-8444-444444444444') AND numero_periodo=2;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT mt_resolve_order('e2222222-2222-4222-8222-222222222222','assign_items',10,NULL,ARRAY['e3333333-3333-4333-8333-333333333333'::uuid],'f1111111-1111-4111-8111-111111111111')$$,'P0001','pedido_invalid_partial_assignment','foreign item cannot be allocated through this order');
SELECT throws_ok($$SELECT mt_resolve_order('e2222222-2222-4222-8222-222222222222','assign_items',20,NULL,ARRAY['e5555555-5555-4555-8555-555555555555'::uuid,'e6666666-6666-4666-8666-666666666666'::uuid],'f1111111-1111-4111-8111-111111111111')$$,'P0001','pedido_no_stock','chosen multi-item subset is still all-or-none');
SELECT is((SELECT count(*) FROM pedido_items WHERE pedido_id='e2222222-2222-4222-8222-222222222222' AND estado='aplicado'),0::bigint,'failed selected subset rolls back its first item');
SELECT lives_ok($$SELECT mt_resolve_order('e2222222-2222-4222-8222-222222222222','assign_items',10,NULL,ARRAY['e5555555-5555-4555-8555-555555555555'::uuid],'f1111111-1111-4111-8111-111111111111')$$,'administrator can explicitly allocate the available selected item');
SELECT lives_ok($$SELECT mt_resolve_order('e2222222-2222-4222-8222-222222222222','assign_items',10,NULL,ARRAY['e5555555-5555-4555-8555-555555555555'::uuid],'f1111111-1111-4111-8111-111111111111')$$,'selected assignment intent cannot duplicate a sale');
SELECT is((SELECT delivery_state FROM pedidos WHERE id='e2222222-2222-4222-8222-222222222222'),'parcial','remaining pending item keeps delivery partial');
RESET ROLE;
SELECT is((private.mt_read_order('e2222222-2222-4222-8222-222222222222')->>'unallocatedAmount')::numeric,10::numeric,'unallocated principal excludes money already assigned');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT mt_resolve_order('e2222222-2222-4222-8222-222222222222','refund',10,'BANK-PARTIAL-REFUND',NULL,'f2222222-2222-4222-8222-222222222222')$$,'remaining principal can be externally refunded independently of allocated items');
SELECT is((SELECT payment_state FROM pedidos WHERE id='e2222222-2222-4222-8222-222222222222'),'parcialmente_reembolsado','mixed assignment and refund remain explicit');
SELECT is((SELECT estado FROM pedido_items WHERE id='e5555555-5555-4555-8555-555555555555'),'aplicado','refund preserves the assigned item');
SELECT is((SELECT estado FROM pedido_items WHERE id='e6666666-6666-4666-8666-666666666666'),'cancelado','refund cancels only unallocated items');
SELECT is((SELECT sum(p.monto_original) FROM pagos_venta p JOIN ventas v ON p.venta_id=v.id WHERE v.servicio_id='d7777777-7777-4777-8777-777777777777'),10::numeric,'partial refund does not touch existing sale income');
SELECT is((SELECT count(*) FROM pedido_resoluciones WHERE pedido_id='e2222222-2222-4222-8222-222222222222'),2::bigint,'assignment and refund retain separate ledger decisions');
RESET ROLE;
SELECT is((private.mt_read_order('e2222222-2222-4222-8222-222222222222')->>'unallocatedAmount')::numeric,0::numeric,'no unallocated principal remains after refund');
SELECT is((private.mt_read_order('e2222222-2222-4222-8222-222222222222')->>'missingAmount')::numeric,0::numeric,'refunded items do not create phantom payment debt');
INSERT INTO public.yappy_mail_messages(id,uid_validity,imap_uid,received_at,from_address,dmarc_pass,status)
 VALUES('f7777777-7777-4777-8777-777777777777',31,301,now(),'notificaciones@yappy.com.pa',true,'extraido');
INSERT INTO public.yappy_payments(id,confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,mail_message_id)
 VALUES('f8888888-8888-4888-8888-888888888888','POSTREFUND',3,'Fixture payer','9999',now(),'f7777777-7777-4777-8777-777777777777');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT mt_reconcile_order('e2222222-2222-4222-8222-222222222222','POSTREFUND',NULL,'f9999999-9999-4999-8999-999999999999')$$,'new receipt after a partial refund is recorded without reusing refunded principal');
SELECT is((SELECT monto FROM pedido_excedentes WHERE pedido_id='e2222222-2222-4222-8222-222222222222'),3::numeric,'only the new receipt becomes unallocated excess after principal refund');
SELECT is((SELECT sum(p.monto_original) FROM pagos_venta p JOIN ventas v ON p.venta_id=v.id WHERE v.servicio_id='d7777777-7777-4777-8777-777777777777'),10::numeric,'a later receipt cannot recreate cancelled items or assigned income');
SELECT throws_ok($$SELECT mt_reconcile_order('d9999999-9999-4999-8999-999999999999','POSTREFUND',NULL,'a1212121-1212-4121-8121-121212121212')$$,'P0001','pedido_cancelled','fully refunded cancellation requires operator review instead of reopening purchases');
RESET ROLE;
INSERT INTO public.pedidos(id,tercero_id,contact_id,canal,moneda,total,estado,payment_state,expira_at,exchange_rate)
 VALUES('a2323232-2323-4232-8232-232323232323','d8888888-8888-4888-8888-888888888888','50763333333','whatsapp','USD',12,'pagado','cubierto',now()-interval '1 hour',1);
INSERT INTO public.pedido_items(id,pedido_id,tipo,plan_id,categoria_id,servicio_id,ciclo_pago,precio,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot)
 VALUES('a3434343-3434-4343-8343-343434343434','a2323232-2323-4232-8232-232323232323','nueva','d4444444-4444-4444-8444-444444444444','d2222222-2222-4222-8222-222222222222','d5555555-5555-4555-8555-555555555555','mensual',12,12,'Resolution plan','Individual');
INSERT INTO public.pedido_pagos(pedido_id,source,monto) VALUES('a2323232-2323-4232-8232-232323232323','manual',12);
INSERT INTO public.catalogo_config(categoria_id,plan_id,moneda)
 VALUES('d2222222-2222-4222-8222-222222222222','d4444444-4444-4444-8444-444444444444','ARS');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT mt_order_resolution_quote('a2323232-2323-4232-8232-232323232323')$$,
 'P0001','pedido_currency_mismatch','expired purchase quote cannot silently adopt a different catalog currency');
SELECT throws_ok($$SELECT mt_order_command('a2323232-2323-4232-8232-232323232323','retry','a4545454-4545-4454-8454-454545454545',NULL)$$,
 'P0001','pedido_terms_changed','expired purchase cannot silently retain a price now expressed in another currency');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
