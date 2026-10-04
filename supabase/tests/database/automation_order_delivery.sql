BEGIN;
SELECT plan(35);
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
VALUES('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111111','authenticated','authenticated','delivery-admin@example.test','',now()),
 ('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111112','authenticated','authenticated','delivery-admin2@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id IN('a1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111112');
INSERT INTO public.categorias(id,nombre,tipo) VALUES('a2222222-2222-4222-8222-222222222222','Netflix delivery fixture','cliente');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES('a3333333-3333-4333-8333-333333333333','a2222222-2222-4222-8222-222222222222','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,ciclo_pago,precio)
VALUES('a4444444-4444-4444-8444-444444444444','a2222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333','Mensual','mensual',10);
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
VALUES('a5555555-5555-4555-8555-555555555555','a2222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333','Netflix fixture','delivery@example.test',gen_random_uuid()::text,2);
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono)
VALUES('a6666666-6666-4666-8666-666666666666','Delivery','Fixture','cliente','50760000999');
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
CREATE TEMP TABLE delivery_fixture_order AS SELECT public.mt_panel_checkout('[{"clienteId":"a6666666-6666-4666-8666-666666666666","moneda":"USD","exchangeRate":1,"items":[
 {"planId":"a4444444-4444-4444-8444-444444444444","servicioId":"a5555555-5555-4555-8555-555555555555","perfilNumero":1,"precio":10,"descuento":0,"cicloPago":"mensual","fechaInicio":"2026-10-01","fechaFin":"2026-11-01","estado":"activo"},
 {"planId":"a4444444-4444-4444-8444-444444444444","servicioId":"a5555555-5555-4555-8555-555555555555","perfilNumero":2,"precio":10,"descuento":0,"cicloPago":"mensual","fechaInicio":"2026-10-01","fechaFin":"2026-11-01","estado":"activo"}]}]'::jsonb,
 'a7777777-7777-4777-8777-777777777777')::uuid AS id;
SELECT is((SELECT count(*) FROM public.mt_order_deliveries WHERE pedido_id=(SELECT id FROM delivery_fixture_order)),2::bigint,'assignment enqueues each item atomically');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.mt_order_deliveries'::regclass),'delivery ledger RLS active');
SELECT ok(NOT has_table_privilege('authenticated','public.mt_order_deliveries','INSERT'),'operators cannot forge delivery work');
SELECT ok(NOT has_function_privilege('anon','public.mt_order_delivery_access(uuid,uuid,bigint)','EXECUTE'),'anon cannot retrieve credentials');
UPDATE public.config SET whatsapp_auto_enabled=false WHERE id='global';
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT is(public.mt_claim_order_delivery(),NULL::jsonb,'global automatic off prevents sending');
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
CREATE TEMP TABLE delivery_fixture_claim AS SELECT public.mt_claim_order_delivery((SELECT id FROM delivery_fixture_order)) AS value;
SELECT ok((SELECT value IS NOT NULL FROM delivery_fixture_claim),'admin explicitly sends with automatic off');
SELECT is(public.mt_claim_order_delivery(),NULL::jsonb,'parallel item waits for the same conversation lease');
SELECT ok(public.mt_order_delivery_access((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim))->>'password' IS NOT NULL,'authorized password is transient');
SELECT ok(public.set_whatsapp_conversation_mode('50760000999','human',1),'taking chat invalidates pending access');
SELECT is(public.mt_order_delivery_access((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim)),NULL::jsonb,'old worker cannot retrieve access after takeover');
UPDATE delivery_fixture_claim SET value=public.mt_claim_order_delivery((SELECT id FROM delivery_fixture_order));
INSERT INTO public.mt_service_access(service_id,mode,provider,rotation_confirmed_at)
VALUES('a5555555-5555-4555-8555-555555555555','code','netflix',now());
SELECT is(public.mt_order_delivery_access((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim))->>'password',NULL,'code mode never returns password');
SELECT is(public.mt_order_delivery_access((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim))->>'pin',NULL,'code mode never returns PIN');
INSERT INTO public.whatsapp_outbound_messages(id,idempotency_key,to_wa_id,message_kind,text_body,send_status,wa_message_id)
VALUES('a8888888-8888-4888-8888-888888888888',gen_random_uuid(),'50760000999','text','Protected fixture','accepted','delivery.wrong');
SELECT throws_ok($$SELECT public.mt_finish_order_delivery((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim),'accepted','a8888888-8888-4888-8888-888888888888')$$,
 'P0001','delivery_not_accepted','another accepted message cannot prove this item was sent');
UPDATE public.whatsapp_outbound_messages SET idempotency_key=private.mt_delivery_reply_key((SELECT (value->>'itemId')::uuid FROM delivery_fixture_claim))
 WHERE id='a8888888-8888-4888-8888-888888888888';
SELECT ok(public.mt_finish_order_delivery((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim),'accepted','a8888888-8888-4888-8888-888888888888'),'API acceptance records only the delivered item');
SELECT is((SELECT delivery_state FROM public.pedidos WHERE id=(SELECT id FROM delivery_fixture_order)),'asignado','one accepted item does not mark whole order sent');
UPDATE delivery_fixture_claim SET value=public.mt_claim_order_delivery((SELECT id FROM delivery_fixture_order));
SELECT ok(public.mt_finish_order_delivery((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim),'retry'),'outage remains recoverable');
SELECT is((SELECT count(*) FROM public.pagos_venta WHERE venta_id IN(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM delivery_fixture_order))),2::bigint,'delivery outage never repeats or reverses payment');
UPDATE public.mt_order_deliveries SET available_at=now()-interval '1 minute' WHERE status='queued' AND pedido_id=(SELECT id FROM delivery_fixture_order);
UPDATE delivery_fixture_claim SET value=public.mt_claim_order_delivery((SELECT id FROM delivery_fixture_order));
SELECT ok(public.mt_finish_order_delivery((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim),'review'),'uncertain send pauses automatic retries');
SELECT ok(NOT public.mt_retry_order_delivery((SELECT id FROM delivery_fixture_order)),'manual retry cannot resend an uncertain access');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT is(public.mt_resolve_access_sale('50760000000',(SELECT value->>'saleId' FROM delivery_fixture_claim)),NULL,'sale-bound code button rejects a different contact');
SELECT is(public.mt_resolve_access_sale('50760000999',(SELECT value->>'saleId' FROM delivery_fixture_claim)),'a5555555-5555-4555-8555-555555555555','sale-bound code button resolves only eligible own account');
UPDATE public.servicios SET activo=false WHERE id='a5555555-5555-4555-8555-555555555555';
SELECT is(public.mt_resolve_access_sale('50760000999',(SELECT value->>'saleId' FROM delivery_fixture_claim)),NULL,'inactive account cannot deliver a code');
SELECT is((SELECT count(*) FROM public.mt_order_deliveries WHERE pedido_id=(SELECT id FROM delivery_fixture_order) AND status='accepted'),1::bigint,'retry never reopens the accepted item');
UPDATE public.servicios SET activo=true WHERE id='a5555555-5555-4555-8555-555555555555';
UPDATE public.ventas SET estado='inactivo' WHERE id=(SELECT value->>'saleId' FROM delivery_fixture_claim);
SELECT is(public.mt_resolve_access_sale('50760000999',(SELECT value->>'saleId' FROM delivery_fixture_claim)),NULL,'cancelled sale cannot deliver a code');
UPDATE public.ventas SET estado='activo' WHERE id=(SELECT value->>'saleId' FROM delivery_fixture_claim);
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono)
VALUES('a6666666-6666-4666-8666-666666666667','Duplicate','Fixture','cliente','50760000999');
SELECT is(public.mt_resolve_access_sale('50760000999',(SELECT value->>'saleId' FROM delivery_fixture_claim)),NULL,'ambiguous active identity is denied');
UPDATE public.terceros SET active=false WHERE id='a6666666-6666-4666-8666-666666666667';
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
UPDATE public.usuarios SET active=false WHERE id='a1111111-1111-4111-8111-111111111111';
SELECT throws_ok($$SELECT public.mt_retry_order_delivery((SELECT id FROM delivery_fixture_order))$$,'42501','forbidden','revoked administrator cannot retry delivery');
UPDATE public.usuarios SET active=true WHERE id='a1111111-1111-4111-8111-111111111111';
-- Independent fixture transition: emulate a definitive failed API response instead of an uncertain response.
UPDATE public.mt_order_deliveries SET failure_code='DELIVERY_FAILED' WHERE pedido_id=(SELECT id FROM delivery_fixture_order) AND status='review';
SELECT ok(public.mt_retry_order_delivery((SELECT id FROM delivery_fixture_order)),'a definite failure can be retried explicitly');
INSERT INTO public.pedido_items(pedido_id,tipo,servicio_id,plan_id,categoria_id,ciclo_pago,precio,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot)
SELECT id,'nueva','a5555555-5555-4555-8555-555555555555','a4444444-4444-4444-8444-444444444444',
 'a2222222-2222-4222-8222-222222222222','mensual',10,10,'Pending fixture','Individual' FROM delivery_fixture_order;
UPDATE public.pedidos SET delivery_state='parcial' WHERE id=(SELECT id FROM delivery_fixture_order);
SELECT is((SELECT count(*) FROM public.mt_order_deliveries WHERE pedido_id=(SELECT id FROM delivery_fixture_order)),2::bigint,'partial resolution never enqueues an unapplied item');
UPDATE delivery_fixture_claim SET value=public.mt_claim_order_delivery((SELECT id FROM delivery_fixture_order));
SELECT ok((SELECT value IS NOT NULL FROM delivery_fixture_claim),'partial order permits eligible applied access');
SELECT ok(public.mt_order_delivery_access((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim)) IS NOT NULL,'partial order authorizes only the assigned own sale');
INSERT INTO public.whatsapp_outbound_messages(id,idempotency_key,to_wa_id,message_kind,text_body,send_status,wa_message_id)
VALUES('a8888888-8888-4888-8888-888888888889',private.mt_delivery_reply_key((SELECT (value->>'itemId')::uuid FROM delivery_fixture_claim)),
 '50760000999','text','Protected fixture','accepted','delivery.second');
SELECT ok(public.mt_finish_order_delivery((SELECT (value->>'id')::uuid FROM delivery_fixture_claim),
 (SELECT (value->>'token')::uuid FROM delivery_fixture_claim),(SELECT (value->>'fence')::bigint FROM delivery_fixture_claim),'accepted','a8888888-8888-4888-8888-888888888889'),'partial delivered subset is recorded');
SELECT is((SELECT delivery_state FROM public.pedidos WHERE id=(SELECT id FROM delivery_fixture_order)),'parcial','remaining pending item prevents order sent');
UPDATE public.pedido_items SET estado='cancelado' WHERE pedido_id=(SELECT id FROM delivery_fixture_order) AND estado='pendiente';
UPDATE public.pedidos SET delivery_state='asignado' WHERE id=(SELECT id FROM delivery_fixture_order);
SELECT is((SELECT delivery_state FROM public.pedidos WHERE id=(SELECT id FROM delivery_fixture_order)),'enviado','final partial resolution preserves accepted delivery without resending it');
SELECT is(public.mt_claim_order_delivery((SELECT id FROM delivery_fixture_order)),NULL::jsonb,'completed delivery is never claimed again');
SELECT ok(NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mt_order_deliveries'
 AND column_name IN('password','pin','email','payload','text_body','contrasena')),'work ledger has no credential payload columns');
SELECT * FROM finish();
ROLLBACK;
