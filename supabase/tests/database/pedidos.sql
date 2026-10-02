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
INSERT INTO public.ventas(id,cliente_id,servicio_id,categoria_id,perfil_numero) VALUES
 ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000005','f2000000-0000-4000-8000-000000000002',1),
 ('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000005','f2000000-0000-4000-8000-000000000002',2),
 ('f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000007','f2000000-0000-4000-8000-000000000002',1);
INSERT INTO public.venta_periodos(venta_id,numero_periodo,tipo,fecha_inicio,fecha_fin,ciclo_pago,precio_original,total_original,moneda_original,total_usd,plan_nombre_snapshot,plan_tipo_nombre_snapshot) VALUES
 ('f3000000-0000-4000-8000-000000000001',1,'inicial','2026-01-01','2026-02-01','mensual',10,10,'USD',10,'Fixture','Individual'),
 ('f3000000-0000-4000-8000-000000000002',1,'inicial','2026-01-15','2027-01-15','anual',20,20,'USD',20,'Fixture anual','Individual'),
 ('f3000000-0000-4000-8000-000000000003',1,'inicial','2026-01-01','2026-02-01','mensual',10,10,'USD',10,'Fixture','Individual');
INSERT INTO public.yappy_mail_messages(id,uid_validity,imap_uid,received_at,from_address,status) VALUES
 ('f4000000-0000-4000-8000-000000000001',919,1,now(),'fixture@example.test','extraido'),
 ('f4000000-0000-4000-8000-000000000002',919,2,now(),'fixture@example.test','extraido');
INSERT INTO public.yappy_payments(id,confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,mail_message_id) VALUES
 ('f5000000-0000-4000-8000-000000000001','PEDIDOS-1',4,'Fixture','0000',now(),'f4000000-0000-4000-8000-000000000001'),
 ('f5000000-0000-4000-8000-000000000002','PEDIDOS-2',6,'Fixture','0000',now(),'f4000000-0000-4000-8000-000000000002');
CREATE TEMP TABLE intents(label text PRIMARY KEY, id uuid, key uuid DEFAULT gen_random_uuid());
GRANT ALL ON intents TO authenticated;
CREATE FUNCTION pg_temp.new_item(p_service text DEFAULT 'f2000000-0000-4000-8000-000000000005') RETURNS jsonb
LANGUAGE sql AS $$ SELECT jsonb_build_object('tipo','nueva','plan_id','f2000000-0000-4000-8000-000000000004','servicio_id',p_service,'ciclo_pago','mensual') $$;
CREATE FUNCTION pg_temp.draft(p_items jsonb, p_key uuid DEFAULT gen_random_uuid(), p_currency text DEFAULT 'USD') RETURNS uuid
LANGUAGE sql AS $$ SELECT public.crear_pedido('f2000000-0000-4000-8000-000000000001',NULL,'panel',p_currency,p_items,now()+interval '1 day',1,p_key)::uuid $$;
SELECT set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO intents(label,id) VALUES ('partial',pg_temp.draft(jsonb_build_array(pg_temp.new_item())));
SELECT is((SELECT total FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='partial')),10::numeric,'server freezes plan price');
SELECT is(public.confirmar_pedido((SELECT id FROM intents WHERE label='partial'),(SELECT key FROM intents WHERE label='partial'),'manual',4),
 (SELECT id::text FROM intents WHERE label='partial'),'partial payment returns order ID');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='partial')),'pago_en_revision','underpayment requires review');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT id FROM intents WHERE label='partial') AND venta_id_resultante IS NOT NULL),0::bigint,'underpayment creates no sales');
SELECT is(public.confirmar_pedido((SELECT id FROM intents WHERE label='partial'),(SELECT key FROM intents WHERE label='partial'),'manual',4),
 (SELECT id::text FROM intents WHERE label='partial'),'same key returns same result');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM intents WHERE label='partial')),1::bigint,'same key creates no extra payment');
SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='partial'),gen_random_uuid(),'manual',8);
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='partial')),'entregado','overpayment confirms');
SELECT is((SELECT notas FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='partial')),'Sobrepago: 2.00 USD','difference recorded in note');
SELECT is((SELECT count(*) FROM public.pagos_venta WHERE venta_id IN (SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM intents WHERE label='partial'))),1::bigint,'one payment per applied sale');
SELECT is((SELECT perfiles_ocupados FROM public.servicios WHERE id='f2000000-0000-4000-8000-000000000005'),3,'profile counter increments exactly once');
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='partial'),gen_random_uuid(),'manual',1)$$,'P0001','pedido_invalid_state','new key cannot pay delivered order twice');
INSERT INTO intents(label,id) VALUES ('yappy',pg_temp.draft(jsonb_build_array(pg_temp.new_item()))),('other',pg_temp.draft(jsonb_build_array(pg_temp.new_item())));
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='yappy'),gen_random_uuid(),'yappy',5,'f5000000-0000-4000-8000-000000000001')$$,'P0001','pedido_invalid_payment','Yappy amount comes from detected payment');
SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='yappy'),gen_random_uuid(),'yappy',4,'f5000000-0000-4000-8000-000000000001');
SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='yappy'),gen_random_uuid(),'yappy',6,'f5000000-0000-4000-8000-000000000002');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='yappy')),'entregado','two Yappy payments can cover one order');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM intents WHERE label='yappy')),2::bigint,'two distinct Yappy records retained');
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='other'),gen_random_uuid(),'yappy',4,'f5000000-0000-4000-8000-000000000001')$$,'P0001','pedido_payment_used','Yappy cannot cover another order');
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='other'),(SELECT key FROM intents WHERE label='partial'),'manual',4)$$,'P0001','pedido_key_conflict','cannot reuse confirm key for another order');
INSERT INTO intents(label,id) VALUES ('renew',pg_temp.draft('[{"tipo":"renovacion","venta_id":"f3000000-0000-4000-8000-000000000001","ciclo_pago":"mensual"},{"tipo":"renovacion","venta_id":"f3000000-0000-4000-8000-000000000002","ciclo_pago":"anual"}]'));
SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='renew'),gen_random_uuid(),'manual',30);
SELECT is((SELECT fecha_inicio FROM public.venta_periodos WHERE venta_id='f3000000-0000-4000-8000-000000000001' AND numero_periodo=2),'2026-02-01'::date,'monthly renewal starts from its own expiry');
SELECT is((SELECT fecha_fin FROM public.venta_periodos WHERE venta_id='f3000000-0000-4000-8000-000000000001' AND numero_periodo=2),'2026-03-01'::date,'monthly item keeps its cycle');
SELECT is((SELECT fecha_inicio FROM public.venta_periodos WHERE venta_id='f3000000-0000-4000-8000-000000000002' AND numero_periodo=2),'2027-01-15'::date,'annual renewal starts from its own expiry');
SELECT is((SELECT fecha_fin FROM public.venta_periodos WHERE venta_id='f3000000-0000-4000-8000-000000000002' AND numero_periodo=2),'2028-01-15'::date,'annual item keeps its cycle');
SELECT is((SELECT count(*) FROM public.pagos_venta WHERE venta_id IN ('f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002')),2::bigint,'one payment per renewal');
SELECT throws_ok($$SELECT pg_temp.draft(jsonb_build_array(pg_temp.new_item() || '{"moneda":"PDT"}'::jsonb))$$,'P0001','pedido_invalid_item','one order has one currency');
SELECT throws_ok($$SELECT pg_temp.draft('[{"tipo":"renovacion","venta_id":"f3000000-0000-4000-8000-000000000001","ciclo_pago":"mensual"}]',gen_random_uuid(),'PDT')$$,'P0001','pedido_currency_mismatch','renewal currency must match order');
SELECT throws_ok($$SELECT pg_temp.draft(jsonb_build_array(pg_temp.new_item() || '{"ciclo_pago":"anual"}'::jsonb))$$,'P0001','pedido_cycle_mismatch','new sale keeps plan cycle');
INSERT INTO intents(label,id) VALUES ('stock',pg_temp.draft(jsonb_build_array(pg_temp.new_item('f2000000-0000-4000-8000-000000000006'),pg_temp.new_item())));
SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='stock'),(SELECT key FROM intents WHERE label='stock'),'manual',20);
SELECT is(public.confirmar_pedido((SELECT id FROM intents WHERE label='stock'),(SELECT key FROM intents WHERE label='stock'),'manual',20),(SELECT id::text FROM intents WHERE label='stock'),'full confirmation retry returns same ID');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='stock')),'pagado','short stock remains paid awaiting fulfillment');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT id FROM intents WHERE label='stock') AND estado='sin_stock'),1::bigint,'only unavailable item fails');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT id FROM intents WHERE label='stock') AND estado='aplicado'),1::bigint,'available item still applies');
INSERT INTO intents(label,id) VALUES ('rollback',pg_temp.draft(jsonb_build_array(pg_temp.new_item(),jsonb_build_object('tipo','renovacion','venta_id','f3000000-0000-4000-8000-000000000003','ciclo_pago','mensual'))));
RESET ROLE;
UPDATE public.servicios SET en_reposo=true WHERE id='f2000000-0000-4000-8000-000000000007';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='rollback'),(SELECT key FROM intents WHERE label='rollback'),'manual',20)$$,'P0001','pedido_service_unavailable','paused service rejects confirmation');
SELECT throws_ok($$SELECT pg_temp.draft('[{"tipo":"renovacion","venta_id":"f3000000-0000-4000-8000-000000000003","ciclo_pago":"mensual"}]')$$,'P0001','pedido_service_unavailable','paused service rejects renewal draft');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM intents WHERE label='rollback')),0::bigint,'rejected confirmation rolls payment back');
SELECT is((SELECT count(*) FROM public.pedido_items WHERE pedido_id=(SELECT id FROM intents WHERE label='rollback') AND estado<>'pendiente'),0::bigint,'rejected confirmation rolls all items back');
SELECT is((SELECT count(*) FROM public.rpc_idempotency_keys WHERE rpc_name='confirmar_pedido' AND idempotency_key=(SELECT key FROM intents WHERE label='rollback')),0::bigint,'rejected confirmation rolls intent ledger back');
RESET ROLE;
UPDATE public.servicios SET en_reposo=false,activo=false,cortado_at=now() WHERE id='f2000000-0000-4000-8000-000000000007';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='rollback'),(SELECT key FROM intents WHERE label='rollback'),'manual',20)$$,'P0001','pedido_service_unavailable','cut service rejects renewal confirmation');
RESET ROLE;
UPDATE public.servicios SET activo=true,cortado_at=NULL WHERE id='f2000000-0000-4000-8000-000000000007';
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='rollback'),(SELECT key FROM intents WHERE label='rollback'),'manual',20)$$,'same intent succeeds after service restored');
INSERT INTO intents(label,id) VALUES ('cancel',pg_temp.draft(jsonb_build_array(pg_temp.new_item()))),('expire',pg_temp.draft(jsonb_build_array(pg_temp.new_item())));
SELECT public.cancelar_pedido((SELECT id FROM intents WHERE label='cancel'),(SELECT key FROM intents WHERE label='cancel'));
SELECT is(public.cancelar_pedido((SELECT id FROM intents WHERE label='cancel'),(SELECT key FROM intents WHERE label='cancel')),(SELECT id::text FROM intents WHERE label='cancel'),'cancel is idempotent');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='cancel')),'cancelado','draft can be cancelled');
SELECT throws_ok($$SELECT public.cancelar_pedido((SELECT id FROM intents WHERE label='partial'),gen_random_uuid())$$,'P0001','pedido_invalid_state','cannot cancel delivered paid order');
RESET ROLE;
UPDATE public.pedidos SET expira_at=now()-interval '1 second' WHERE id=(SELECT id FROM intents WHERE label='expire');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='expire'),gen_random_uuid(),'manual',10)$$,'P0001','pedido_invalid_state','cannot confirm expired deadline');
SELECT ok(public.expirar_pedidos()>=1,'expiry helper expires unpaid drafts');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='expire')),'expirado','expiry state persisted');
INSERT INTO intents(label,id) VALUES ('partial-expired',pg_temp.draft(jsonb_build_array(pg_temp.new_item())));
SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='partial-expired'),gen_random_uuid(),'manual',1);
RESET ROLE;
UPDATE public.pedidos SET expira_at=now()-interval '1 second' WHERE id=(SELECT id FROM intents WHERE label='partial-expired');
SET LOCAL ROLE authenticated;
SELECT public.expirar_pedidos();
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM intents WHERE label='partial-expired')),'pago_en_revision','expiry preserves partial payments for reconciliation');
SELECT throws_ok($$SELECT public.cancelar_pedido((SELECT id FROM intents WHERE label='partial-expired'),gen_random_uuid())$$,'P0001','pedido_invalid_state','partial payment cannot be silently cancelled');
INSERT INTO intents(label,id) VALUES ('frozen',pg_temp.draft(jsonb_build_array(pg_temp.new_item())));
RESET ROLE;
UPDATE public.planes SET precio=99,nombre='Changed after draft' WHERE id='f2000000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='frozen'),gen_random_uuid(),'manual',10);
SELECT is((SELECT precio_original FROM public.venta_periodos WHERE venta_id IN (SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM intents WHERE label='frozen'))),10::numeric,'plan price frozen before catalog change');
SELECT is((SELECT plan_nombre_snapshot FROM public.venta_periodos WHERE venta_id IN (SELECT venta_id_resultante FROM public.pedido_items WHERE pedido_id=(SELECT id FROM intents WHERE label='frozen'))),'Mensual','plan name snapshot frozen');
RESET ROLE;
UPDATE public.planes SET precio=10,nombre='Mensual' WHERE id='f2000000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
-- Draft retry also uses the actor/rpc/key ledger.
INSERT INTO intents(label,id) VALUES ('draft-retry',NULL);
UPDATE intents SET id=pg_temp.draft(jsonb_build_array(pg_temp.new_item()),key) WHERE label='draft-retry';
SELECT is(pg_temp.draft(jsonb_build_array(pg_temp.new_item()),(SELECT key FROM intents WHERE label='draft-retry')),(SELECT id FROM intents WHERE label='draft-retry'),'draft creation idempotent');
SELECT throws_ok($$INSERT INTO public.pedido_pagos(pedido_id,source,monto) VALUES ((SELECT id FROM intents WHERE label='other'),'manual',10)$$,'42501',NULL,'authenticated cannot write payments directly');
SELECT throws_ok($$UPDATE public.pedidos SET total=0$$,'42501',NULL,'authenticated cannot change frozen prices');
SELECT throws_ok($$DELETE FROM public.pedido_items$$,'42501',NULL,'authenticated cannot delete items');
RESET ROLE;
SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.pedidos'::regclass,'public.pedido_items'::regclass,'public.pedido_pagos'::regclass)),'all tables have RLS');
SELECT ok(NOT has_function_privilege('authenticated','public.aplicar_pedido_item(uuid,uuid)','EXECUTE'),'internal executor not callable by clients');
SELECT ok(NOT has_function_privilege('anon','public.confirmar_pedido(uuid,uuid,text,numeric,uuid)','EXECUTE'),'anon cannot confirm');
SELECT ok(NOT has_table_privilege('anon','public.pedidos','SELECT'),'anon cannot read orders');
SELECT set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.pedidos),0::bigint,'inactive user cannot read orders');
SELECT is((SELECT count(*) FROM public.pedido_items),0::bigint,'inactive user cannot read items');
SELECT is((SELECT count(*) FROM public.pedido_pagos),0::bigint,'inactive user cannot read payments');
SELECT throws_ok($$SELECT pg_temp.draft(jsonb_build_array(pg_temp.new_item()))$$,'P0001','pedido_forbidden','inactive user cannot create through definer');
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='other'),gen_random_uuid(),'manual',10)$$,'P0001','pedido_forbidden','inactive user cannot confirm');
SELECT throws_ok($$SELECT public.cancelar_pedido((SELECT id FROM intents WHERE label='other'),gen_random_uuid())$$,'P0001','pedido_forbidden','inactive user cannot cancel');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM public.pedidos)>0,'active operator can read orders');
SELECT throws_ok($$SELECT public.expirar_pedidos()$$,'P0001','pedido_forbidden','expiry restricted to admin or service role');
SELECT throws_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='other'),gen_random_uuid(),'yappy',4,'f5000000-0000-4000-8000-000000000001')$$,'P0001','pedido_forbidden','Yappy resolution remains admin only');
SELECT lives_ok($$SELECT public.confirmar_pedido((SELECT id FROM intents WHERE label='other'),gen_random_uuid(),'manual',10)$$,'active operator can confirm manual payment');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT public.expirar_pedidos()$$,'service role can run expiry without a user');
SELECT ok(NOT has_function_privilege('service_role','public.aplicar_pedido_item(uuid,uuid)','EXECUTE'),'service role has no internal executor grant');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
