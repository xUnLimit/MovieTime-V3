BEGIN;
SELECT plan(11);
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
 VALUES('00000000-0000-0000-0000-000000000000','cc111111-1111-4111-8111-111111111111','authenticated','authenticated','deleted-order-admin@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='cc111111-1111-4111-8111-111111111111';
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono) VALUES
 ('cc222222-2222-4222-8222-222222222222','Archived','Customer','cliente','50760000001'),
 ('cc333333-3333-4333-8333-333333333333','Active','Customer','cliente','50760000002');
SELECT set_config('request.jwt.claims','{"sub":"cc111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
INSERT INTO public.pedidos(id,tercero_id,canal,moneda,total,expira_at,exchange_rate) VALUES
 ('cc444444-4444-4444-8444-444444444444','cc222222-2222-4222-8222-222222222222','panel','USD',10,now()+interval '1 hour',1),
 ('cc555555-5555-4555-8555-555555555555','cc333333-3333-4333-8333-333333333333','panel','USD',10,now()+interval '1 hour',1);
INSERT INTO public.whatsapp_notices(id,dedupe_key,tipo,tercero_id,wa_id,channel,origin,idempotency_key)
 VALUES('cc777777-7777-4777-8777-777777777777','deleted-order-customer','suscripcion','cc222222-2222-4222-8222-222222222222','50760000000','text','manual','cc888888-8888-4888-8888-888888888888');
UPDATE public.pedidos SET notice_id='cc777777-7777-4777-8777-777777777777' WHERE id='cc444444-4444-4444-8444-444444444444';
UPDATE public.pedidos SET estado='entregado',delivery_state='asignado' WHERE id='cc444444-4444-4444-8444-444444444444';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$DELETE FROM public.terceros WHERE id='cc333333-3333-4333-8333-333333333333'$$,'P0001','tercero_has_active_orders','active orders block customer deletion');
SELECT lives_ok($$SELECT public.mt_delete_order('cc444444-4444-4444-8444-444444444444','cc666666-6666-4666-8666-666666666666')$$,'the unpaid order can be deleted');
SELECT is((SELECT estado FROM public.pedidos WHERE id='cc444444-4444-4444-8444-444444444444'),'cancelado','old delivery state without sales or money does not block deletion');
SELECT lives_ok($$DELETE FROM public.terceros WHERE id='cc222222-2222-4222-8222-222222222222'$$,'a deleted order no longer blocks customer deletion');
SELECT is((SELECT count(*) FROM public.terceros WHERE id='cc222222-2222-4222-8222-222222222222'),0::bigint,'customer is deleted');
SELECT ok((SELECT tercero_id IS NULL AND contact_id IS NULL AND deleted_at IS NOT NULL FROM public.pedidos WHERE id='cc444444-4444-4444-8444-444444444444'),'panel order without phone releases its customer');
SELECT is((SELECT total FROM public.pedidos WHERE id='cc444444-4444-4444-8444-444444444444'),10::numeric,'order audit retains its amount');
SELECT ok((SELECT notice_id IS NULL FROM public.pedidos WHERE id='cc444444-4444-4444-8444-444444444444'),'deleted customer notices do not leave a blocking order reference');
SELECT is((SELECT tercero_id FROM public.pedidos WHERE id='cc555555-5555-4555-8555-555555555555'),'cc333333-3333-4333-8333-333333333333','active order retains its customer');
RESET ROLE;
SELECT throws_ok($$INSERT INTO public.pedidos(canal,moneda,expira_at,exchange_rate,created_by) VALUES('panel','USD',now()+interval '1 hour',1,'cc111111-1111-4111-8111-111111111111')$$,'23514',NULL,'live orders still require a customer or phone');
SELECT ok(NOT has_function_privilege('authenticated','private.mt_release_deleted_customer_orders()','EXECUTE'),'trigger cannot be called directly');
SELECT * FROM finish();
ROLLBACK;
