BEGIN;
SELECT no_plan();
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
 VALUES('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111111','authenticated','authenticated','manual-admin@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='a1111111-1111-4111-8111-111111111111';
-- Un segundo usuario sin rol de administrador: bajar de rol al unico admin lo impide la regla de "al menos un administrador activo".
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
 VALUES('00000000-0000-0000-0000-000000000000','a1111112-1111-4111-8111-111111111111','authenticated','authenticated','manual-operator@example.test','',now());
UPDATE public.usuarios SET role='operador' WHERE id='a1111112-1111-4111-8111-111111111111';
INSERT INTO public.categorias(id,nombre,tipo) VALUES('a2222222-2222-4222-8222-222222222222','Manual fixture','cliente');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES('a3333333-3333-4333-8333-333333333333','a2222222-2222-4222-8222-222222222222','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,ciclo_pago,precio)
 VALUES('a4444444-4444-4444-8444-444444444444','a2222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333','Manual plan','mensual',10);
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
 VALUES('a5555555-5555-4555-8555-555555555555','a2222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333','Manual service','manual@example.test','fixture-only',3);
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono)
 VALUES('a8888888-8888-4888-8888-888888888888','Manual','Customer','cliente','50764444444');
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.pedidos(id,tercero_id,canal,moneda,total,estado,payment_state,delivery_state,expira_at,exchange_rate)
 VALUES('b1111111-1111-4111-8111-111111111111','a8888888-8888-4888-8888-888888888888','panel','USD',10,'esperando_pago','pendiente','pendiente',now()+interval '1 hour',1),
 ('b2222222-2222-4222-8222-222222222222','a8888888-8888-4888-8888-888888888888','panel','USD',10,'esperando_pago','pendiente','pendiente',now()+interval '1 hour',1),
 ('b3333333-3333-4333-8333-333333333333','a8888888-8888-4888-8888-888888888888','panel','USD',10,'entregado','cubierto','asignado',now()+interval '1 hour',1),
 ('b4444444-4444-4444-8444-444444444444','a8888888-8888-4888-8888-888888888888','panel','USD',10,'cancelado','pendiente','pendiente',now()+interval '1 hour',1);
INSERT INTO public.pedido_items(id,pedido_id,tipo,plan_id,categoria_id,servicio_id,perfil_numero,ciclo_pago,precio,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot,estado)
 VALUES('c1111111-1111-4111-8111-111111111111','b1111111-1111-4111-8111-111111111111','nueva','a4444444-4444-4444-8444-444444444444','a2222222-2222-4222-8222-222222222222','a5555555-5555-4555-8555-555555555555',1,'mensual',10,10,'Manual plan','Individual','pendiente'),
 ('c2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222','nueva','a4444444-4444-4444-8444-444444444444','a2222222-2222-4222-8222-222222222222','a5555555-5555-4555-8555-555555555555',2,'mensual',10,10,'Manual plan','Individual','pendiente'),
 ('c3333333-3333-4333-8333-333333333333','b3333333-3333-4333-8333-333333333333','nueva','a4444444-4444-4444-8444-444444444444','a2222222-2222-4222-8222-222222222222','a5555555-5555-4555-8555-555555555555',3,'mensual',10,10,'Manual plan','Individual','aplicado');
INSERT INTO public.pedido_pagos(pedido_id,source,monto) VALUES('b3333333-3333-4333-8333-333333333333','manual',10);

-- Quien no es administrador no puede usar ninguna de las tres acciones.
SELECT set_config('request.jwt.claims','{"sub":"a1111112-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT mt_delete_order('b1111111-1111-4111-8111-111111111111','a9111111-1111-4111-8111-111111111111')$$,'42501','forbidden','an operator cannot delete orders');
SELECT throws_ok($$SELECT mt_register_order_payment('b1111111-1111-4111-8111-111111111111',5,'EFECTIVO-1','a9222222-2222-4222-8222-222222222222')$$,'42501','forbidden','an operator cannot register payments');
SELECT throws_ok($$SELECT mt_mark_order_delivered('b3333333-3333-4333-8333-333333333333','a9333333-3333-4333-8333-333333333333')$$,'42501','forbidden','an operator cannot mark deliveries');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;

-- Eliminar: archivo lógico de un pedido sin dinero; es idempotente y desaparece de la lista.
SELECT lives_ok($$SELECT mt_delete_order('b1111111-1111-4111-8111-111111111111','a9444444-4444-4444-8444-444444444444')$$,'an order without money can be deleted');
SELECT lives_ok($$SELECT mt_delete_order('b1111111-1111-4111-8111-111111111111','a9444444-4444-4444-8444-444444444444')$$,'the same intention replays');
SELECT lives_ok($$SELECT mt_delete_order('b1111111-1111-4111-8111-111111111111','a9555555-5555-4555-8555-555555555555')$$,'deleting twice does nothing new');
SELECT isnt((SELECT deleted_at FROM public.pedidos WHERE id='b1111111-1111-4111-8111-111111111111'),NULL,'the order is archived, not erased');
SELECT is((SELECT estado FROM public.pedidos WHERE id='b1111111-1111-4111-8111-111111111111'),'cancelado','the reservation is released');
SELECT is((SELECT estado FROM public.pedido_items WHERE id='c1111111-1111-4111-8111-111111111111'),'cancelado','its pending services are cancelled');
SELECT ok(NOT (SELECT public.mt_list_orders()) @> '[{"id":"b1111111-1111-4111-8111-111111111111"}]'::jsonb,'the panel list hides deleted orders');
SELECT ok((SELECT public.mt_list_orders()) @> '[{"id":"b2222222-2222-4222-8222-222222222222"}]'::jsonb,'other orders stay listed');
SELECT ok(EXISTS(SELECT 1 FROM jsonb_array_elements(mt_list_orders()) item WHERE item->>'id'='b3333333-3333-4333-8333-333333333333'),'paid orders remain listed until explicitly archived');
SELECT throws_ok($$SELECT mt_register_order_payment('b1111111-1111-4111-8111-111111111111',5,'EFECTIVO-2','a9777777-7777-4777-8777-777777777777')$$,'P0001','pedido_not_found','a deleted order accepts no payments');

-- Pago manual: parcial y luego completo, con la misma cuenta que el cruce con Yappy.
SELECT throws_ok($$SELECT mt_register_order_payment('b2222222-2222-4222-8222-222222222222',0,'EFECTIVO-3','a9888888-8888-4888-8888-888888888888')$$,'P0001','pedido_invalid_amount','the amount must be positive');
SELECT throws_ok($$SELECT mt_register_order_payment('b2222222-2222-4222-8222-222222222222',5.123,'EFECTIVO-3','a9888888-8888-4888-8888-888888888888')$$,'P0001','pedido_invalid_amount','the amount has at most two decimals');
SELECT throws_ok($$SELECT mt_register_order_payment('b2222222-2222-4222-8222-222222222222',5,'<x>','a9888888-8888-4888-8888-888888888888')$$,'P0001','pedido_invalid_reference','the reference is validated');
SELECT throws_ok($$SELECT mt_register_order_payment('b4444444-4444-4444-8444-444444444444',5,'EFECTIVO-4','a9999999-9999-4999-8999-999999999999')$$,'P0001','pedido_cancelled','a cancelled order accepts no payments');
SELECT lives_ok($$SELECT mt_register_order_payment('b2222222-2222-4222-8222-222222222222',4,'EFECTIVO-5','aa111111-1111-4111-8111-111111111111')$$,'a partial manual payment is recorded');
SELECT lives_ok($$SELECT mt_register_order_payment('b2222222-2222-4222-8222-222222222222',4,'EFECTIVO-5','aa111111-1111-4111-8111-111111111111')$$,'the same intention replays');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id='b2222222-2222-4222-8222-222222222222'),1::bigint,'money is never applied twice');
SELECT is((SELECT payment_state FROM public.pedidos WHERE id='b2222222-2222-4222-8222-222222222222'),'parcial','the order is partially paid');
SELECT lives_ok($$SELECT mt_register_order_payment('b2222222-2222-4222-8222-222222222222',6,'EFECTIVO-6','aa222222-2222-4222-8222-222222222222')$$,'the remaining amount is recorded');
SELECT is((SELECT payment_state FROM public.pedidos WHERE id='b2222222-2222-4222-8222-222222222222'),'cubierto','the order is covered');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id='b2222222-2222-4222-8222-222222222222' AND source='manual' AND created_by='a1111111-1111-4111-8111-111111111111'),2::bigint,'each manual payment records who entered it');

-- Entrega manual: solo desde «asignado» con el cobro cubierto.
SELECT throws_ok($$SELECT mt_mark_order_delivered('b4444444-4444-4444-8444-444444444444','aa333333-3333-4333-8333-333333333333')$$,'P0001','pedido_not_deliverable','a cancelled order cannot be delivered');
-- Preparar el estado de la fixture requiere permisos de tabla: se hace como propietario y se vuelve al administrador.
RESET ROLE;
UPDATE public.pedidos SET delivery_state='asignado',estado='pagado' WHERE id='b3333333-3333-4333-8333-333333333333';
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT mt_mark_order_delivered('b3333333-3333-4333-8333-333333333333','aa444444-4444-4444-8444-444444444444')$$,'an assigned and paid order can be marked as delivered');
SELECT lives_ok($$SELECT mt_mark_order_delivered('b3333333-3333-4333-8333-333333333333','aa444444-4444-4444-8444-444444444444')$$,'the same intention replays');
SELECT is((SELECT delivery_state FROM public.pedidos WHERE id='b3333333-3333-4333-8333-333333333333'),'enviado','the delivery state advances');
SELECT throws_ok($$SELECT mt_mark_order_delivered('b3333333-3333-4333-8333-333333333333','aa555555-5555-4555-8555-555555555555')$$,'P0001','pedido_not_deliverable','a delivered order cannot be delivered again');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT mt_delete_order('b3333333-3333-4333-8333-333333333333','a9666666-6666-4666-8666-666666666666')$$,'a completed order can be archived');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id='b3333333-3333-4333-8333-333333333333'),1::bigint,'archiving preserves recorded payments');
SELECT is((SELECT estado FROM public.pedido_items WHERE pedido_id='b3333333-3333-4333-8333-333333333333'),'aplicado','archiving preserves assigned items');
SELECT is((SELECT delivery_state FROM public.pedidos WHERE id='b3333333-3333-4333-8333-333333333333'),'enviado','archiving preserves delivery history');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.mt_delete_order(uuid,uuid)','EXECUTE'),'anonymous users cannot delete orders');
SELECT ok(NOT has_function_privilege('service_role','public.mt_register_order_payment(uuid,numeric,text,uuid)','EXECUTE'),'the bot cannot register manual payments');
SELECT * FROM finish();
ROLLBACK;
