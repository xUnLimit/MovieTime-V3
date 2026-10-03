BEGIN;
SELECT no_plan();
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000000','b1000000-0000-4000-8000-000000000001','authenticated','authenticated','buy-admin@example.test','',now()),
 ('00000000-0000-0000-0000-000000000000','b1000000-0000-4000-8000-000000000002','authenticated','authenticated','buy-op@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='b1000000-0000-4000-8000-000000000001';
INSERT INTO public.currencies(code) VALUES ('USD') ON CONFLICT DO NOTHING;
INSERT INTO public.categorias(id,nombre,tipo,code_provider) VALUES ('b2000000-0000-4000-8000-000000000002','Buy','cliente','netflix');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES ('b2000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000002','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,precio,ciclo_pago) VALUES
 ('b2000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000003','Mensual',5,'mensual');
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles) VALUES
 ('b2000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000003','Buy svc','buy@example.test','plain-secret',3);
INSERT INTO public.whatsapp_contacts(wa_id,estado,nombre_perfil) VALUES
 ('50761111111','lead','Lead Uno'), ('50762222222','lead','Lead Dos'), ('15551234567','lead','Foraneo'), ('50763333333','bloqueado','Bloqueado');

CREATE TEMP TABLE res(label text PRIMARY KEY, r text);
GRANT ALL ON res TO service_role, authenticated;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
INSERT INTO res SELECT 'hold1', id::text FROM public.reservar_perfil_para_plan('50761111111','b2000000-0000-4000-8000-000000000004');
INSERT INTO res SELECT 'hold1-again', id::text FROM public.reservar_perfil_para_plan('50761111111','b2000000-0000-4000-8000-000000000004');
INSERT INTO res SELECT 'order1', public.crear_pedido_compra_bot('50761111111', ARRAY['b2000000-0000-4000-8000-000000000004'], md5('k1')::uuid);
INSERT INTO res SELECT 'order1-replay', public.crear_pedido_compra_bot('50761111111', ARRAY['b2000000-0000-4000-8000-000000000004'], md5('k1')::uuid);
INSERT INTO res SELECT 'hold2', id::text FROM public.reservar_perfil_para_plan('50762222222','b2000000-0000-4000-8000-000000000004');
RESET ROLE;

SELECT isnt((SELECT r FROM res WHERE label='hold1'), NULL, 'a lead reserves a profile for a plan');
SELECT is((SELECT r FROM res WHERE label='hold1-again'), (SELECT r FROM res WHERE label='hold1'), 'reserving again returns the same hold');
SELECT isnt((SELECT r FROM res WHERE label='hold2'), (SELECT r FROM res WHERE label='hold1'), 'another contact gets another profile');
SELECT is((SELECT r FROM res WHERE label='order1-replay'), (SELECT r FROM res WHERE label='order1'), 'same key returns the same order');
SELECT is((SELECT count(*) FROM public.pedidos WHERE contact_id='50761111111'), 1::bigint, 'replay creates no second order');
SELECT ok((SELECT tercero_id IS NULL AND canal='whatsapp' AND estado='borrador' AND total=5 AND moneda='USD'
  FROM public.pedidos WHERE id=(SELECT r FROM res WHERE label='order1')::uuid), 'lead order has no tercero and a server computed total');
SELECT is((SELECT i.perfil_numero FROM public.pedido_items i WHERE i.pedido_id=(SELECT r FROM res WHERE label='order1')::uuid),
  (SELECT perfil_numero FROM public.reservas_perfil WHERE id=(SELECT r FROM res WHERE label='hold1')::uuid), 'item keeps the held profile');
SELECT is((SELECT expira_at FROM public.pedidos WHERE id=(SELECT r FROM res WHERE label='order1')::uuid),
  (SELECT expira_at FROM public.reservas_perfil WHERE id=(SELECT r FROM res WHERE label='hold1')::uuid), 'order expires with its hold');

SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT public.crear_pedido_compra_bot('50762222222', ARRAY['b2000000-0000-4000-8000-000000000004'], md5('k1')::uuid)$$,
  '22023','purchase_key_conflict','a key cannot be reused by another contact');
SELECT throws_ok($$SELECT public.crear_pedido_compra_bot('50764444444', ARRAY['b2000000-0000-4000-8000-000000000004'], md5('k2')::uuid)$$,
  '22023','purchase_contact_invalid','unknown contact');
SELECT throws_ok($$SELECT public.reservar_perfil_para_plan('50763333333','b2000000-0000-4000-8000-000000000004')$$,
  '22023','purchase_contact_invalid','blocked contact cannot reserve');
SELECT throws_ok($$SELECT public.crear_pedido_compra_bot('15551234567', ARRAY['b2000000-0000-4000-8000-000000000004'], md5('k3')::uuid)$$,
  '22023','purchase_unsupported_number','numbers that cannot map to a tercero are refused');
SELECT throws_ok($$SELECT public.crear_pedido_compra_bot('50762222222', ARRAY['b2000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000004'], md5('k4')::uuid)$$,
  '22023','purchase_cart_invalid','duplicate plans are refused');
SELECT throws_ok($$SELECT public.reservar_perfil_para_plan('50762222222','b2000000-0000-4000-8000-0000000000ff')$$,
  '22023','purchase_plan_invalid','unknown plan');
RESET ROLE;

-- Abandonment: a live order protects its hold; cancelling releases it.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
INSERT INTO res SELECT 'order2', public.crear_pedido_compra_bot('50762222222', ARRAY['b2000000-0000-4000-8000-000000000004'], md5('k5')::uuid);
INSERT INTO res SELECT 'release-live', public.liberar_compra_bot('50762222222')::text;
INSERT INTO res SELECT 'release-cancel', public.liberar_compra_bot('50762222222', (SELECT r FROM res WHERE label='order2')::uuid)::text;
INSERT INTO res SELECT 'release-again', public.liberar_compra_bot('50762222222', (SELECT r FROM res WHERE label='order2')::uuid)::text;
RESET ROLE;
SELECT is((SELECT r FROM res WHERE label='release-live'), '0', 'a live order keeps its hold');
SELECT is((SELECT r FROM res WHERE label='release-cancel'), '1', 'cancelling an unpaid order releases the hold');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT r FROM res WHERE label='order2')::uuid), 'cancelado', 'unpaid order cancelled');
SELECT is((SELECT r FROM res WHERE label='release-again'), '0', 'release is idempotent');

-- Payment: the finalizer creates the tercero, frees the hold and delivers.
SELECT is(private.finalizar_pedido_pagado((SELECT r FROM res WHERE label='order1')::uuid, 5), true, 'paid order is delivered');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT r FROM res WHERE label='order1')::uuid), 'entregado', 'order delivered');
SELECT ok((SELECT t.id = p.tercero_id AND t.wa_id = '50761111111' AND t.nombre = 'Lead Uno' AND t.tipo = 'cliente'
  FROM public.pedidos p JOIN public.terceros t ON t.id = p.tercero_id WHERE p.id=(SELECT r FROM res WHERE label='order1')::uuid), 'tercero created from the WhatsApp contact');
SELECT ok((SELECT estado='cliente' AND tercero_id=(SELECT tercero_id FROM public.pedidos WHERE id=(SELECT r FROM res WHERE label='order1')::uuid)
  FROM public.whatsapp_contacts WHERE wa_id='50761111111'), 'contact is now a linked client');
SELECT is((SELECT count(*) FROM public.ventas WHERE cliente_id=(SELECT tercero_id FROM public.pedidos WHERE id=(SELECT r FROM res WHERE label='order1')::uuid)), 1::bigint, 'one sale for the new client');
SELECT ok((SELECT cerrada_at IS NOT NULL FROM public.reservas_perfil WHERE id=(SELECT r FROM res WHERE label='hold1')::uuid), 'hold released in the same transaction');
SELECT is((SELECT v.perfil_numero FROM public.ventas v JOIN public.pedido_items i ON i.venta_id_resultante=v.id
  WHERE i.pedido_id=(SELECT r FROM res WHERE label='order1')::uuid),
  (SELECT perfil_numero FROM public.reservas_perfil WHERE id=(SELECT r FROM res WHERE label='hold1')::uuid), 'sale uses the held profile');
SELECT is((SELECT count(*) FROM public.terceros WHERE wa_id='50761111111'), 1::bigint, 'exactly one tercero per contact');

-- Credentials: ownership is verified in SQL and the password never leaves code-access accounts.
CREATE TEMP TABLE sale AS SELECT venta_id_resultante AS id FROM public.pedido_items
  WHERE pedido_id=(SELECT r FROM res WHERE label='order1')::uuid;
GRANT ALL ON sale TO service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
INSERT INTO res SELECT 'cred-owner', public.credenciales_venta_bot('50761111111', (SELECT id FROM sale))::text;
INSERT INTO res SELECT 'cred-other', coalesce(public.credenciales_venta_bot('50762222222', (SELECT id FROM sale))::text, 'null');
RESET ROLE;
SELECT is((SELECT r::jsonb->>'contrasena' FROM res WHERE label='cred-owner'), 'plain-secret', 'owner receives the password of a normal account');
SELECT is((SELECT r FROM res WHERE label='cred-other'), 'null', 'another contact receives nothing');
UPDATE public.servicios SET acceso_por_codigo = true WHERE id='b2000000-0000-4000-8000-000000000005';
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
INSERT INTO res SELECT 'cred-code', public.credenciales_venta_bot('50761111111', (SELECT id FROM sale))::text;
RESET ROLE;
SELECT ok((SELECT (r::jsonb->>'contrasena') IS NULL AND (r::jsonb->>'acceso_por_codigo')::boolean AND r !~ 'plain-secret' FROM res WHERE label='cred-code'),
  'code-access accounts never return the password');

-- Sales of a paid order: only for the order's own contact, never for another contact or an unpaid order.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
INSERT INTO res SELECT 'sales-owner', public.ventas_pedido_bot('50761111111', (SELECT r FROM res WHERE label='order1')::uuid)::text;
INSERT INTO res SELECT 'sales-other', public.ventas_pedido_bot('50762222222', (SELECT r FROM res WHERE label='order1')::uuid)::text;
INSERT INTO res SELECT 'sales-unpaid', public.ventas_pedido_bot('50762222222', (SELECT r FROM res WHERE label='order2')::uuid)::text;
INSERT INTO res SELECT 'sales-unknown', public.ventas_pedido_bot('50761111111', gen_random_uuid())::text;
SELECT throws_ok($$SELECT public.ventas_pedido_bot('abc', gen_random_uuid())$$, '22023', 'purchase_invalid_input', 'sales lookup validates the number');
SELECT throws_ok($$SELECT public.ventas_pedido_bot('50761111111', NULL)$$, '22023', 'purchase_invalid_input', 'sales lookup requires an order');
RESET ROLE;
SELECT is((SELECT r FROM res WHERE label='sales-owner'), '{' || (SELECT id FROM sale) || '}', 'the contact gets the sales its paid order created');
SELECT is((SELECT r FROM res WHERE label='sales-other'), '{}', 'another contact gets no sales of that order');
SELECT is((SELECT r FROM res WHERE label='sales-unpaid'), '{}', 'an unpaid (cancelled) order exposes no sales');
SELECT is((SELECT r FROM res WHERE label='sales-unknown'), '{}', 'an unknown order exposes no sales');

-- Grants.
SELECT set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.ventas_pedido_bot('50761111111', gen_random_uuid())$$, '42501', NULL, 'authenticated cannot list order sales');
SELECT throws_ok($$SELECT public.credenciales_venta_bot('50761111111','x')$$,'42501',NULL,'authenticated cannot read credentials');
SELECT throws_ok($$SELECT public.crear_pedido_compra_bot('50761111111', ARRAY['x'], gen_random_uuid())$$,'42501',NULL,'authenticated cannot create bot orders');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.reservar_perfil_para_plan(text,text)','EXECUTE'),'anon cannot reserve');
SELECT ok(NOT has_function_privilege('authenticated','public.liberar_compra_bot(text,uuid)','EXECUTE'),'authenticated cannot release');
SELECT ok(has_function_privilege('service_role','public.credenciales_venta_bot(text,text)','EXECUTE'),'service_role reads credentials');
SELECT ok(has_function_privilege('service_role','public.ventas_pedido_bot(text,uuid)','EXECUTE'),'service_role lists order sales');
SELECT ok(NOT has_function_privilege('anon','public.ventas_pedido_bot(text,uuid)','EXECUTE'),'anon cannot list order sales');
SELECT ok(NOT has_function_privilege('authenticated','public.ventas_pedido_bot(text,uuid)','EXECUTE'),'authenticated has no execute on order sales');
SELECT ok(NOT has_function_privilege('service_role','private.preparar_pedido_compra(uuid)','EXECUTE'),'internal preparer is not callable');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.compra_ajustes'::regclass),'RLS on purchase settings');
SELECT ok((SELECT bool_and(prosecdef AND proconfig IS NOT NULL) FROM pg_proc WHERE proname IN
  ('reservar_perfil_para_plan','crear_pedido_compra_bot','liberar_compra_bot','credenciales_venta_bot')), 'definers pin search_path');
SELECT * FROM finish();
ROLLBACK;
