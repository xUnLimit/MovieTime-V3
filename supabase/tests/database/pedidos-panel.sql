BEGIN;
SELECT no_plan();
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000001','authenticated','authenticated','pedidos-admin@example.test','',now()),
 ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000002','authenticated','authenticated','pedidos-active@example.test','',now()),
 ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000003','authenticated','authenticated','pedidos-inactive@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='f1000000-0000-4000-8000-000000000001';
UPDATE public.usuarios SET active=false WHERE id='f1000000-0000-4000-8000-000000000003';
INSERT INTO public.currencies(code) VALUES ('USD') ON CONFLICT DO NOTHING;
INSERT INTO public.currencies(code) VALUES ('PDT');
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono) VALUES
 ('f2000000-0000-4000-8000-000000000001','Pedido','Fixture','cliente','0000');
INSERT INTO public.categorias(id,nombre,tipo) VALUES ('f2000000-0000-4000-8000-000000000002','Pedido','cliente');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES
 ('f2000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000002','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,precio,ciclo_pago) VALUES
 ('f2000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003','Mensual',10,'mensual');
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles) VALUES
 ('f2000000-0000-4000-8000-000000000005','f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003','Disponible','fixture@example.test','fixture',50),
 ('f2000000-0000-4000-8000-000000000006','f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003','Sin stock','fixture@example.test','fixture',0),
 ('f2000000-0000-4000-8000-000000000007','f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003','Rollback','fixture@example.test','fixture',50);

CREATE TEMP TABLE panel_intents(label text PRIMARY KEY, payload jsonb, key uuid DEFAULT gen_random_uuid(), result text);
CREATE TEMP TABLE panel_counts(pedidos bigint, ventas bigint, pagos bigint, ledger bigint, ocupados int);
GRANT ALL ON panel_intents, panel_counts TO authenticated;
CREATE FUNCTION pg_temp.panel_item(p_label text, p_service text DEFAULT 'f2000000-0000-4000-8000-000000000005')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('tipo','nueva','plan_id','f2000000-0000-4000-8000-000000000004',
    'servicio_id',p_service,'categoria_id','f2000000-0000-4000-8000-000000000002',
    'ciclo_pago','mensual','descuento',25,'panel',jsonb_build_object(
      'item_id',p_label,'precio',12,'total',9,'estado','activo','fecha_inicio','2026-10-01',
      'fecha_fin','2026-11-01','perfil_nombre','Perfil editado','codigo','1234','notas','Nota editada',
      'metodo_pago_id',NULL,'metodo_pago_nombre','Banco snapshot'));
$$;
CREATE FUNCTION pg_temp.panel_group(p_items jsonb, p_moneda text DEFAULT 'USD') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('cliente_id','f2000000-0000-4000-8000-000000000001',
    'moneda',p_moneda,'exchange_rate',1,'monto',9*jsonb_array_length(p_items),
    'crear_key',gen_random_uuid(),'confirmar_key',gen_random_uuid(),'items',p_items);
$$;
SELECT set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO panel_intents(label,payload) VALUES
 ('single',jsonb_build_array(pg_temp.panel_group(jsonb_build_array(pg_temp.panel_item('one'))))),
 ('many',jsonb_build_array(pg_temp.panel_group(jsonb_build_array(pg_temp.panel_item('two'),pg_temp.panel_item('three'))))),
 ('mixed',jsonb_build_array(pg_temp.panel_group(jsonb_build_array(pg_temp.panel_item('four'))),
    pg_temp.panel_group(jsonb_build_array(pg_temp.panel_item('five')),'PDT'))),
 ('stock',jsonb_build_array(pg_temp.panel_group(jsonb_build_array(pg_temp.panel_item('six'),
    pg_temp.panel_item('seven','f2000000-0000-4000-8000-000000000006')))));
UPDATE panel_intents SET result=public.confirmar_pedido(payload,key) WHERE label='single';
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='single')),1::bigint,'single item creates one order item');
SELECT is((SELECT precio FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='single')),12::numeric,'edited price is frozen instead of catalog price 10');
SELECT is((SELECT total FROM public.pedidos WHERE id=(SELECT result::uuid FROM panel_intents WHERE label='single')),9::numeric,'discounted total is frozen');
SELECT is((SELECT notas FROM public.ventas WHERE id=(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='single'))),'Nota editada','sale notes preserved');
SELECT is((SELECT perfil_nombre FROM public.ventas WHERE id=(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='single'))),'Perfil editado','profile name preserved');
SELECT is((SELECT codigo FROM public.ventas WHERE id=(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='single'))),'1234','code preserved');
SELECT is((SELECT fecha_inicio FROM public.venta_periodos WHERE venta_id=(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='single'))),'2026-10-01'::date,'form start date preserved');
SELECT is((SELECT metodo_pago_nombre_snapshot FROM public.pagos_venta WHERE venta_id=(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='single'))),'Banco snapshot','payment method snapshot preserved');
SELECT is((SELECT public.confirmar_pedido(payload,key) FROM panel_intents WHERE label='single'),(SELECT result FROM panel_intents WHERE label='single'),'retry returns same batch ID');
SELECT is((SELECT count(*) FROM public.pedido_pagos),1::bigint,'retry does not duplicate receipts');
SELECT is((SELECT perfiles_ocupados FROM public.servicios WHERE id='f2000000-0000-4000-8000-000000000005'),1,'trigger updates occupancy exactly once');
UPDATE panel_intents SET result=public.confirmar_pedido(payload,key) WHERE label IN ('many','mixed','stock');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='many') AND estado='aplicado'),2::bigint,'N items apply in one order');
SELECT is((SELECT count(*) FROM public.pedidos WHERE panel_batch_id=(SELECT result::uuid FROM panel_intents WHERE label='mixed')),2::bigint,'mixed currencies create two orders in one batch');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='stock') AND estado='sin_stock'),1::bigint,'stock failure is retained per item');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT result::uuid FROM panel_intents WHERE label='stock')),'pagado','stock failure retains receipt for reconciliation');
-- Force a failure during application after an earlier currency order was delivered.
RESET ROLE;
CREATE FUNCTION pg_temp.reject_panel_sale() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.servicio_id='f2000000-0000-4000-8000-000000000007' THEN RAISE EXCEPTION 'panel_test_failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER panel_test_failure BEFORE INSERT ON public.ventas FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_panel_sale();
SET LOCAL ROLE authenticated;
INSERT INTO panel_intents(label,payload) VALUES ('rollback',jsonb_build_array(
  pg_temp.panel_group(jsonb_build_array(pg_temp.panel_item('eight'))),
  pg_temp.panel_group(jsonb_build_array(pg_temp.panel_item('nine','f2000000-0000-4000-8000-000000000007')),'PDT')));
INSERT INTO panel_counts SELECT (SELECT count(*) FROM public.pedidos),(SELECT count(*) FROM public.ventas),
  (SELECT count(*) FROM public.pagos_venta),(SELECT count(*) FROM public.rpc_idempotency_keys),
  (SELECT perfiles_ocupados FROM public.servicios WHERE id='f2000000-0000-4000-8000-000000000005');
SELECT throws_ok($$SELECT public.confirmar_pedido(payload,key) FROM panel_intents WHERE label='rollback'$$,'P0001','panel_test_failure','second currency failure aborts entire cart');
SELECT is((SELECT count(*) FROM public.pedidos),(SELECT pedidos FROM panel_counts),'rollback removes all draft and confirmed orders');
SELECT is((SELECT count(*) FROM public.ventas),(SELECT ventas FROM panel_counts),'rollback removes first currency sale');
SELECT is((SELECT count(*) FROM public.pagos_venta),(SELECT pagos FROM panel_counts),'rollback removes initial payments');
SELECT is((SELECT count(*) FROM public.rpc_idempotency_keys),(SELECT ledger FROM panel_counts),'rollback removes all intent keys');
SELECT is((SELECT perfiles_ocupados FROM public.servicios WHERE id='f2000000-0000-4000-8000-000000000005'),(SELECT ocupados FROM panel_counts),'rollback restores occupancy');
RESET ROLE;
DROP TRIGGER panel_test_failure ON public.ventas;
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.confirmar_pedido(payload,key) FROM panel_intents WHERE label='rollback'$$,'exact retry succeeds once failure is removed');
-- Inactive and fully discounted sales preserve previous form behavior.
INSERT INTO panel_intents(label,payload) VALUES ('inactive',jsonb_build_array(pg_temp.panel_group(jsonb_build_array(
  jsonb_set(pg_temp.panel_item('inactive','f2000000-0000-4000-8000-000000000006'),'{panel,estado}','"inactivo"')))));
UPDATE panel_intents SET result=public.confirmar_pedido(payload,key) WHERE label='inactive';
SELECT is((SELECT estado::text FROM public.ventas WHERE id=(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='inactive'))),'inactivo','inactive cart does not require free stock');
INSERT INTO panel_intents(label,payload) VALUES ('free',jsonb_build_array(jsonb_set(pg_temp.panel_group(jsonb_build_array(
  jsonb_set(jsonb_set(pg_temp.panel_item('free'),'{descuento}','100'),'{panel,total}','0'))),'{monto}','0')));
UPDATE panel_intents SET result=public.confirmar_pedido(payload,key) WHERE label='free';
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT result::uuid FROM panel_intents WHERE label='free')),'entregado','zero-total cart delivers without a positive receipt');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='free')),0::bigint,'zero-total cart does not fabricate a receipt');
SELECT is((SELECT count(*) FROM public.pagos_venta WHERE venta_id=(SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT result::uuid FROM panel_intents WHERE label='free'))),1::bigint,'zero-total sale still gets exactly one initial payment');
SELECT * FROM finish();
ROLLBACK;
