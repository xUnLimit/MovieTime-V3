-- Run only against a local database rebuilt from migrations, never a remote DB.
BEGIN;
SELECT no_plan();
SELECT is((SELECT renovacion_parcial_enabled FROM public.renovacion_ajustes WHERE id='global'), false, 'feature defaults OFF');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.renovacion_ajustes'::regclass), 'settings enforce RLS');
SELECT ok(NOT has_function_privilege('service_role',
 'public.crear_pedido_renovacion(text,text,text,text,jsonb,timestamptz,numeric,uuid,uuid,text,jsonb)', 'EXECUTE'), 'service role cannot create renewal orders');
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000000','f7100000-0000-4000-8000-000000000001','authenticated','authenticated','renewal-admin@example.test','',now()),
 ('00000000-0000-0000-0000-000000000000','f7100000-0000-4000-8000-000000000002','authenticated','authenticated','renewal-operator@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='f7100000-0000-4000-8000-000000000001';
INSERT INTO public.currencies(code) VALUES ('USD') ON CONFLICT DO NOTHING;
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono) VALUES
 ('f7200000-0000-4000-8000-000000000001','Renovación','Fixture','cliente','60000000');
INSERT INTO public.categorias(id,nombre,tipo) VALUES ('f7200000-0000-4000-8000-000000000002','Renovación','cliente');
INSERT INTO public.servicios(id,categoria_id,nombre,correo,contrasena,perfiles_disponibles) VALUES
 ('f7200000-0000-4000-8000-000000000003','f7200000-0000-4000-8000-000000000002','Servicio','fixture@example.test','fixture',10);
INSERT INTO public.ventas(id,cliente_id,servicio_id,categoria_id,perfil_numero) VALUES
 ('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000003','f7200000-0000-4000-8000-000000000002',1),
 ('f7300000-0000-4000-8000-000000000002','f7200000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000003','f7200000-0000-4000-8000-000000000002',2);
INSERT INTO public.venta_periodos(id,venta_id,numero_periodo,tipo,fecha_inicio,fecha_fin,ciclo_pago,precio_original,total_original,moneda_original,total_usd) VALUES
 ('f7400000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',1,'inicial','2026-01-01','2026-02-01','mensual',5,5,'USD',5),
 ('f7400000-0000-4000-8000-000000000002','f7300000-0000-4000-8000-000000000002',1,'inicial','2026-01-01','2026-02-01','mensual',7,7,'USD',7);
INSERT INTO public.whatsapp_notices(id,dedupe_key,tipo,tercero_id,wa_id,channel,fecha_vencimiento,origin,status,idempotency_key) VALUES
 ('f7500000-0000-4000-8000-000000000001','renewal-fixture','dia_pago','f7200000-0000-4000-8000-000000000001','50760000000','text','2026-02-01','manual','accepted',gen_random_uuid());
INSERT INTO public.whatsapp_notice_ventas(notice_id,venta_id) VALUES
 ('f7500000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001'),
 ('f7500000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000002');
CREATE TEMP TABLE renewal_intent(id text, key uuid);
GRANT ALL ON renewal_intent TO authenticated;
CREATE FUNCTION pg_temp.renew(p_key uuid, p_price numeric DEFAULT 5, p_wa text DEFAULT '50760000000') RETURNS text
LANGUAGE sql AS $$ SELECT public.crear_pedido_renovacion(
 'f7200000-0000-4000-8000-000000000001', NULL, 'whatsapp', 'USD',
 '[{"tipo":"renovacion","venta_id":"f7300000-0000-4000-8000-000000000001","ciclo_pago":"mensual","descuento":0}]',
 now()+interval '20 minutes',1,p_key,'f7500000-0000-4000-8000-000000000001',p_wa,
 jsonb_build_array(jsonb_build_object('venta_id','f7300000-0000-4000-8000-000000000001',
 'period_id','f7400000-0000-4000-8000-000000000001','precio',p_price))) $$;
SELECT set_config('request.jwt.claims','{"sub":"f7100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.renovacion_ajustes),0::bigint,'operator cannot read settings');
SELECT is((WITH changed AS (UPDATE public.renovacion_ajustes SET renovacion_parcial_enabled=true RETURNING *) SELECT count(*) FROM changed),0::bigint,'operator cannot enable feature');
SELECT set_config('request.jwt.claims','{"sub":"f7100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT throws_ok($$SELECT pg_temp.renew(gen_random_uuid())$$,'P0001','renewal_disabled','OFF prevents writes');
UPDATE public.renovacion_ajustes SET renovacion_parcial_enabled=true;
SELECT throws_ok($$SELECT pg_temp.renew(gen_random_uuid(),5,'50761111111')$$,'P0001','renewal_notice_invalid','foreign sender rejected');
SELECT throws_ok($$SELECT pg_temp.renew(gen_random_uuid(),6)$$,'P0001','renewal_snapshot_changed','tampered price rejected atomically');
SELECT is((SELECT count(*) FROM public.pedidos WHERE notice_id='f7500000-0000-4000-8000-000000000001'),0::bigint,'invalid snapshot creates no order');
INSERT INTO renewal_intent(key) VALUES (gen_random_uuid());
UPDATE renewal_intent SET id=pg_temp.renew(key);
SELECT is((SELECT total FROM public.pedidos WHERE id=(SELECT id::uuid FROM renewal_intent)),5::numeric,'partial renewal freezes only selected price');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT id::uuid FROM renewal_intent)),1::bigint,'unselected service excluded');
SELECT is(pg_temp.renew((SELECT key FROM renewal_intent)),(SELECT id FROM renewal_intent),'same intent returns same order');
SELECT public.confirmar_pedido((SELECT id::uuid FROM renewal_intent),gen_random_uuid(),'manual',5);
SELECT is(pg_temp.renew((SELECT key FROM renewal_intent)),(SELECT id FROM renewal_intent),'replay after applied renewal returns original order');
SELECT throws_ok($$SELECT pg_temp.renew(gen_random_uuid())$$,'P0001','renewal_snapshot_changed','a new intent cannot renew the stale notice');
SELECT is((SELECT max(numero_periodo) FROM public.venta_periodos WHERE venta_id='f7300000-0000-4000-8000-000000000002'),1,'unselected sale period is unchanged');
RESET ROLE;
UPDATE public.whatsapp_notices SET created_at=now()-interval '31 days' WHERE id='f7500000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT pg_temp.renew(gen_random_uuid())$$,'P0001','renewal_notice_invalid','old notice rejected');
SELECT * FROM finish();
ROLLBACK;
