BEGIN;
SELECT no_plan();
UPDATE public.mt_automation_settings SET settings=jsonb_set(settings,'{purchasesEnabled}','true');

INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
 VALUES('00000000-0000-0000-0000-000000000000','81111111-1111-4111-8111-111111111111',
   'authenticated','authenticated','orders-fixture@example.test','',now());
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
 VALUES('00000000-0000-0000-0000-000000000000','81222222-2222-4222-8222-222222222222',
   'authenticated','authenticated','orders-spare-admin@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='81222222-2222-4222-8222-222222222222';
UPDATE public.usuarios SET role='admin' WHERE id='81111111-1111-4111-8111-111111111111';
INSERT INTO public.categorias(id,nombre,tipo) VALUES('82222222-2222-4222-8222-222222222222','Orders fixture','cliente');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES('83333333-3333-4333-8333-333333333333','82222222-2222-4222-8222-222222222222','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,ciclo_pago,precio)
 VALUES('84444444-4444-4444-8444-444444444444','82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333','Mensual','mensual',10);
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
 VALUES('85555555-5555-4555-8555-555555555555','82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333','Orders fixture','orders@example.test','fixture-only',1);
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono)
 VALUES('86666666-6666-4666-8666-666666666666','Existing','Customer','cliente','50760000000');
INSERT INTO public.whatsapp_contacts(wa_id,tercero_id,estado)
 VALUES('50760000000','86666666-6666-4666-8666-666666666666','cliente'),('50761111111',NULL,'lead'),('50762222222',NULL,'lead');
CREATE TEMP TABLE fixture_orders(name text PRIMARY KEY,id uuid);
CREATE FUNCTION pg_temp.create_commerce(wa text,k uuid,total numeric DEFAULT 10) RETURNS text LANGUAGE sql AS $$
 SELECT public.mt_create_commerce_order(wa,ARRAY['84444444-4444-4444-8444-444444444444'],'compra',k,total)
$$;
CREATE FUNCTION pg_temp.panel_fixture() RETURNS text LANGUAGE sql AS $$
 SELECT public.mt_panel_checkout('[{"clienteId":"86666666-6666-4666-8666-666666666666","moneda":"USD","exchangeRate":1,"items":[
   {"planId":"84444444-4444-4444-8444-444444444444","servicioId":"85555555-5555-4555-8555-555555555555","perfilNumero":1,
   "precio":10,"descuento":0,"cicloPago":"mensual","fechaInicio":"2026-10-01","fechaFin":"2026-11-01","estado":"activo"},
   {"planId":"84444444-4444-4444-8444-444444444444","servicioId":"85555555-5555-4555-8555-555555555555","perfilNumero":1,
   "precio":10,"descuento":0,"cicloPago":"mensual","fechaInicio":"2026-10-01","fechaFin":"2026-11-01","estado":"activo"}]}]'::jsonb,
   '87777777-7777-4777-8777-777777777777')
$$;

SELECT set_config('request.jwt.claims','{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT pg_temp.panel_fixture()$$,'P0001','pedido_no_stock','a failed second item rejects the entire panel cart');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.pedidos WHERE tercero_id='86666666-6666-4666-8666-666666666666'),0::bigint,'panel rollback leaves no order');
SELECT is((SELECT count(*) FROM public.ventas WHERE servicio_id='85555555-5555-4555-8555-555555555555'),0::bigint,'panel rollback leaves no partial sale');
SELECT is((SELECT count(*) FROM public.pagos_venta WHERE venta_id IN (SELECT id FROM public.ventas WHERE servicio_id='85555555-5555-4555-8555-555555555555')),0::bigint,'panel rollback leaves no payment');

SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT throws_ok($$SELECT pg_temp.create_commerce('50761111111','88888888-8888-4888-8888-888888888888',11)$$,
 'P0001','pedido_quote_changed','a price mismatch rolls back the reservation');
SELECT is((SELECT count(*) FROM public.reservas_perfil WHERE servicio_id='85555555-5555-4555-8555-555555555555' AND cerrada_at IS NULL),0::bigint,'rejected quote holds no stock');
INSERT INTO fixture_orders VALUES('lead',pg_temp.create_commerce('50761111111','89999999-9999-4999-8999-999999999999')::uuid);
SELECT is(pg_temp.create_commerce('50761111111','89999999-9999-4999-8999-999999999999'),(SELECT id::text FROM fixture_orders WHERE name='lead'),'same intention replays the same order');
SELECT throws_ok($$SELECT pg_temp.create_commerce('50762222222','90000000-0000-4000-8000-000000000000')$$,
 'P0001','pedido_no_stock','another buyer cannot reserve the last held profile');
SELECT throws_ok(format('SELECT public.mt_get_commerce_order(%L,%L)','50762222222',(SELECT id FROM fixture_orders WHERE name='lead')),
 '42501','pedido_forbidden','knowing an order ID grants no access to another contact');

INSERT INTO public.yappy_mail_messages(id,uid_validity,imap_uid,received_at,from_address,dmarc_pass,status)
 VALUES('91111111-1111-4111-8111-111111111111',1,101,now(),'no-reply@yappy.com.pa',true,'extraido'),
 ('92222222-2222-4222-8222-222222222222',1,102,now(),'no-reply@yappy.com.pa',true,'extraido'),
 ('93333333-3333-4333-8333-333333333333',1,103,now(),'no-reply@yappy.com.pa',false,'extraido');
INSERT INTO public.yappy_payments(id,confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,mail_message_id)
 VALUES('94444444-4444-4444-8444-444444444444','FIXTURE1',4,'Other payer','9999',now(),'91111111-1111-4111-8111-111111111111'),
 ('95555555-5555-4555-8555-555555555555','FIXTURE2',9,'Other payer','9999',now(),'92222222-2222-4222-8222-222222222222'),
 ('96666666-6666-4666-8666-666666666666','UNTRUSTED',50,'Other payer','9999',now(),'93333333-3333-4333-8333-333333333333');
SELECT lives_ok(format('SELECT public.mt_reconcile_order(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'UNTRUSTED','50761111111','97777777-7777-4777-8777-777777777777'),'untrusted proof stays pending');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead')),0::bigint,'DMARC failure cannot confirm money');
SELECT lives_ok(format('SELECT public.mt_reconcile_order(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'FIXTURE1','50761111111','98888888-8888-4888-8888-888888888888'),'a payment from another phone records the partial receipt');
SELECT is((SELECT payment_state FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='lead')),'parcial','insufficient payment remains partial');
SELECT is((SELECT count(*) FROM public.ventas WHERE servicio_id='85555555-5555-4555-8555-555555555555'),0::bigint,'partial payment does not deliver access');
SELECT lives_ok(format('SELECT public.mt_reconcile_order(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'FIXTURE2','50761111111','99999999-9999-4999-8999-999999999999'),'multiple payments can cover one order');
SELECT is((SELECT delivery_state FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='lead')),'asignado','covered order is assigned atomically');
SELECT is((SELECT monto FROM public.pedido_excedentes WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead')),3::numeric,'surplus is an explicit pending balance');
SELECT is((SELECT sum(monto_original) FROM public.pagos_venta WHERE venta_id IN (SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead'))),10::numeric,'surplus is not allocated as sale revenue');
SELECT is((SELECT count(*) FROM public.terceros WHERE wa_id='50761111111'),1::bigint,'paid lead creates exactly one customer');
SELECT ok((SELECT created_by IS NULL AND actor_service='whatsapp-commerce' FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='lead')),'service never impersonates an administrator');
SELECT ok((SELECT created_by IS NULL FROM public.ventas WHERE id=(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead'))),'financial record retains service attribution without a forged UID');
SELECT lives_ok(format('SELECT public.mt_reconcile_order(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'FIXTURE2','50761111111','a1111111-1111-4111-8111-111111111111'),'repeated confirmation code is harmless');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead')),2::bigint,'external receipt is never applied twice');
SELECT is((SELECT count(*) FROM public.domain_events WHERE aggregate_id=(SELECT id::text FROM fixture_orders WHERE name='lead') AND type='pedido.asignado'),1::bigint,'assignment domain event has one emitter and one occurrence');
SELECT is((SELECT count(*) FROM public.domain_events WHERE aggregate_id=(SELECT id::text FROM fixture_orders WHERE name='lead') AND type='pedido.pagado'),1::bigint,'funded event is emitted once');
SELECT ok(NOT has_function_privilege('anon','public.mt_panel_checkout(jsonb,uuid)','EXECUTE'),'anonymous cannot checkout');
SELECT ok(NOT has_function_privilege('authenticated','public.mt_create_commerce_order(text,text[],text,uuid,numeric)','EXECUTE'),'operator cannot forge the server contact identity');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.pedido_excedentes'::regclass),'surplus ledger is protected by RLS');
SELECT lives_ok($$SELECT public.ingest_yappy_payment(99,99,'fixture-no-existing-payer',now(),'Fixture',true,2,
 'NEWPAYER',7,'New payer','4321',now(),NULL)$$,'bank evidence from a new payer is retained independently of customer phone');
SELECT is((SELECT amount FROM public.yappy_payments WHERE confirmation_code='NEWPAYER'),7::numeric,'unknown payer last-four digits do not discard genuine money');

-- Renewal ownership and real payment/period reuse, without a simulated administrator.
SELECT throws_ok(format('SELECT public.mt_create_commerce_order(%L,ARRAY[%L],%L,%L,10)','50760000000',
 (SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead')),
 'renovacion','a2222222-2222-4222-8222-222222222222'),'P0001','pedido_invalid_sale','a known contact cannot renew another customer sale');
INSERT INTO fixture_orders SELECT 'renewal',public.mt_create_commerce_order('50761111111',ARRAY[
 (SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead'))],
 'renovacion','a3333333-3333-4333-8333-333333333333',10)::uuid;
SELECT lives_ok(format('SELECT public.mt_reconcile_order(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='renewal'),
 'DELAYED1','50761111111','a4444444-4444-4444-8444-444444444444'),'a delayed trusted mail leaves a durable pending attempt');
SELECT ok((SELECT pendiente FROM public.intentos_comprobante WHERE idempotency_key='a4444444-4444-4444-8444-444444444444'),'email waiting survives a new message');
INSERT INTO public.yappy_mail_messages(id,uid_validity,imap_uid,received_at,from_address,dmarc_pass,status)
 VALUES('a5555555-5555-4555-8555-555555555555',1,104,now(),'no-reply@yappy.com.pa',true,'extraido');
INSERT INTO public.yappy_payments(id,confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,mail_message_id)
 VALUES('a6666666-6666-4666-8666-666666666666','DELAYED1',10,'Other payer','9999',now(),'a5555555-5555-4555-8555-555555555555');
SELECT lives_ok('SELECT public.mt_retry_receipts(50)','background retry reconciles trusted late mail');
SELECT is((SELECT delivery_state FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='renewal')),'asignado','renewal resumes without another customer message');
UPDATE public.mt_automation_settings SET settings=jsonb_set(settings,'{purchasesEnabled}','false');
SELECT throws_ok($$SELECT pg_temp.create_commerce('50760000000','a7878787-7878-4787-8787-787878787878')$$,
 'P0001','pedido_purchases_paused','pausing new purchases does not cancel funded or renewal processing');
SELECT lives_ok(format('SELECT public.mt_get_commerce_order(%L,%L)','50761111111',(SELECT id FROM fixture_orders WHERE name='renewal')),'paid order status stays available while purchases are paused');
UPDATE public.mt_automation_settings SET settings=jsonb_set(settings,'{purchasesEnabled}','true');
SELECT is((SELECT count(*) FROM public.venta_periodos WHERE venta_id=(SELECT venta_id_resultante FROM public.pedido_items
 WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead'))),2::bigint,'renewal adds exactly one atomic period');
SELECT is((SELECT count(*) FROM public.terceros WHERE wa_id='50761111111'),1::bigint,'renewal links the existing customer');
SELECT throws_ok(format('SELECT public.mt_order_command(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='renewal'),
 'cancel','a7777777-7777-4777-8777-777777777777','50761111111'),'P0001','pedido_funded_cannot_cancel','a funded order cannot be cancelled as an unpaid reservation');

-- A funded two-item order cannot leak a partial assignment when the second slot vanished.
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
 VALUES('a8888888-8888-4888-8888-888888888888','82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333','Two profiles','two@example.test','fixture-only',2);
INSERT INTO fixture_orders SELECT 'two-items',public.mt_create_commerce_order('50762222222',
 ARRAY['84444444-4444-4444-8444-444444444444','84444444-4444-4444-8444-444444444444'],
 'compra','a9999999-9999-4999-8999-999999999999',20)::uuid;
UPDATE public.reservas_perfil SET cerrada_at=now() WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='two-items');
UPDATE public.pedidos SET expira_at=now()-interval '1 second' WHERE id=(SELECT id FROM fixture_orders WHERE name='two-items');
INSERT INTO public.ventas(id,cliente_id,servicio_id,categoria_id,perfil_numero,estado)
 VALUES('b1111111-1111-4111-8111-111111111111','86666666-6666-4666-8666-666666666666','a8888888-8888-4888-8888-888888888888',
 '82222222-2222-4222-8222-222222222222',2,'activo');
INSERT INTO public.yappy_mail_messages(id,uid_validity,imap_uid,received_at,from_address,dmarc_pass,status)
 VALUES('b2222222-2222-4222-8222-222222222222',1,105,now(),'no-reply@yappy.com.pa',true,'extraido');
INSERT INTO public.yappy_payments(id,confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,mail_message_id)
 VALUES('b3333333-3333-4333-8333-333333333333','TWOITEMS',20,'Other payer','9999',now(),'b2222222-2222-4222-8222-222222222222');
SELECT lives_ok(format('SELECT public.mt_reconcile_order(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='two-items'),
 'TWOITEMS','50762222222','b4444444-4444-4444-8444-444444444444'),'payment remains registered if an expired reservation lost stock');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='two-items')),'pagado','funded order remains pending resolution');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='two-items') AND estado='aplicado'),0::bigint,'no partial item can escape subtransaction rollback');
SELECT is((SELECT count(*) FROM public.ventas WHERE servicio_id='a8888888-8888-4888-8888-888888888888'),1::bigint,'only the pre-existing occupant remains');
SELECT is((SELECT count(*) FROM public.terceros WHERE wa_id='50762222222'),0::bigint,'failed allocation cannot leave a half-created lead');
UPDATE public.ventas SET estado='inactivo' WHERE id='b1111111-1111-4111-8111-111111111111';
SELECT lives_ok(format('SELECT public.mt_order_command(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='two-items'),
 'retry','b5555555-5555-4555-8555-555555555555','50762222222'),'restored stock permits explicit all-item retry');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='two-items') AND estado='aplicado'),2::bigint,'retry applies every item together');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='two-items')),1::bigint,'retry does not charge the order again');

-- Cancellation is scoped and releases reservations rather than keeping them indefinitely.
UPDATE public.servicios SET perfiles_disponibles=3 WHERE id='a8888888-8888-4888-8888-888888888888';
INSERT INTO fixture_orders VALUES('cancel',pg_temp.create_commerce('50760000000','b6666666-6666-4666-8666-666666666666')::uuid);
SELECT lives_ok(format('SELECT public.mt_order_command(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='cancel'),
 'cancel','b7777777-7777-4777-8777-777777777777','50760000000'),'the owner can abandon an unpaid cart');
SELECT is((SELECT count(*) FROM public.reservas_perfil WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='cancel') AND cerrada_at IS NULL),0::bigint,'abandonment releases held profiles');

SELECT set_config('request.jwt.claims','{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
UPDATE public.usuarios SET role='operador' WHERE id='81111111-1111-4111-8111-111111111111';
SELECT throws_ok(format('SELECT public.mt_resolve_excess(%L,%L,%L,3,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'credito','CREDIT-FIXTURE','b8888888-8888-4888-8888-888888888888'),'42501','pedido_forbidden','an operator cannot resolve surplus money without admin permission');
UPDATE public.usuarios SET role='admin' WHERE id='81111111-1111-4111-8111-111111111111';
SELECT throws_ok(format('SELECT public.mt_resolve_excess(%L,%L,%L,4,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'credito','CREDIT-FIXTURE','b8888888-8888-4888-8888-888888888888'),'P0001','pedido_excess_changed','stale excess decisions cannot record the wrong amount');
SELECT lives_ok(format('SELECT public.mt_resolve_excess(%L,%L,%L,3,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'credito','CREDIT-FIXTURE','b8888888-8888-4888-8888-888888888888'),'an administrator can register traceable excess credit');
SELECT lives_ok(format('SELECT public.mt_resolve_excess(%L,%L,%L,3,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'credito','CREDIT-FIXTURE','b8888888-8888-4888-8888-888888888888'),'repeated credit intent does not create a second financial entry');
SELECT is((SELECT count(*) FROM public.pedido_exceso_resoluciones WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead')),1::bigint,'one excess decision creates one ledger entry');
SELECT is((SELECT (private.mt_read_order(id)->>'excessAmount')::numeric FROM fixture_orders WHERE name='lead'),0::numeric,'resolved credit is removed from pending surplus');
SELECT is((SELECT sum(monto_original) FROM public.pagos_venta WHERE venta_id IN (SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead'))),20::numeric,'excess resolution never changes sale or renewal revenue');

SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
INSERT INTO public.yappy_mail_messages(id,uid_validity,imap_uid,received_at,from_address,dmarc_pass,status)
 VALUES('b9999999-9999-4999-8999-999999999999',1,106,now(),'notificaciones@yappy.com.pa',true,'extraido');
INSERT INTO public.yappy_payments(id,confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,mail_message_id)
 VALUES('c1111111-1111-4111-8111-111111111111','ADDITIONAL',2,'Other payer','9999',now(),'b9999999-9999-4999-8999-999999999999');
SELECT lives_ok(format('SELECT public.mt_reconcile_order(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'ADDITIONAL','50761111111','c2222222-2222-4222-8222-222222222222'),'a new bank receipt reopens only its additional unresolved amount');
SELECT is((SELECT monto FROM public.pedido_excedentes WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead')),2::numeric,'settled excess is not recredited by a later receipt');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='lead')),'entregado','new overpayment does not reset assignment or charge again');
SELECT lives_ok(format('SELECT public.mt_reconcile_order(%L,%L,%L,%L)',(SELECT id FROM fixture_orders WHERE name='renewal'),
 'ADDITIONAL','50761111111','c3333333-3333-4333-8333-333333333333'),'a reference already used by another order stays in review');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='renewal')),1::bigint,'external payment uniqueness belongs to the payment identifier');
SELECT set_config('request.jwt.claims','{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SELECT lives_ok(format('SELECT public.mt_resolve_excess(%L,%L,%L,2,%L)',(SELECT id FROM fixture_orders WHERE name='lead'),
 'reembolsado','BANK-REFUND-FIXTURE','c4444444-4444-4444-8444-444444444444'),'administrator registers an externally verified surplus refund');
SELECT is((SELECT count(*) FROM public.pedido_exceso_resoluciones WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='lead')),2::bigint,'credit and verified refund retain separate financial facts');
SELECT is((SELECT excess_settled_amount FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='lead')),5::numeric,'settled financial amount accumulates exactly once');
SELECT is((SELECT (private.mt_read_order(id)->>'excessAmount')::numeric FROM fixture_orders WHERE name='lead'),0::numeric,'no outstanding surplus remains after verified refund');

SELECT * FROM finish();
ROLLBACK;
