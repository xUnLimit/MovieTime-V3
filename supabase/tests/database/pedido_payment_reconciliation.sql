BEGIN;
SELECT no_plan();
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000001','authenticated','authenticated','recon-admin@example.test','',now()),
 ('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000002','authenticated','authenticated','recon-active@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='e1000000-0000-4000-8000-000000000001';
INSERT INTO public.currencies(code) VALUES ('USD') ON CONFLICT DO NOTHING;
INSERT INTO public.terceros(id,nombre,apellido,tipo,telefono) VALUES ('e2000000-0000-4000-8000-000000000001','Recon','Fixture','cliente','0000');
INSERT INTO public.categorias(id,nombre,tipo) VALUES ('e2000000-0000-4000-8000-000000000002','Recon','cliente');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES ('e2000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000002','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,precio,ciclo_pago) VALUES
 ('e2000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000003','Mensual',10,'mensual');
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles) VALUES
 ('e2000000-0000-4000-8000-000000000005','e2000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000003','Recon','fixture@example.test','fixture',50);

-- One yappy payment (and mail) per code; amounts and ages vary per scenario.
CREATE FUNCTION pg_temp.mkpay(p_n integer, p_code text, p_amount numeric, p_age interval DEFAULT interval '0') RETURNS void
LANGUAGE sql AS $$
  INSERT INTO public.yappy_mail_messages(id,uid_validity,imap_uid,received_at,from_address,status)
    VALUES (('e4000000-0000-4000-8000-0000000000' || lpad(p_n::text,2,'0'))::uuid,818,p_n,now(),'fixture@example.test','extraido');
  INSERT INTO public.yappy_payments(id,confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,mail_message_id)
    VALUES (('e5000000-0000-4000-8000-0000000000' || lpad(p_n::text,2,'0'))::uuid,p_code,p_amount,'Otro','9999',now()-p_age,
            ('e4000000-0000-4000-8000-0000000000' || lpad(p_n::text,2,'0'))::uuid);
$$;
CREATE FUNCTION pg_temp.mkpedido(p_n integer, p_estado text DEFAULT 'esperando_pago') RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_id uuid := ('e6000000-0000-4000-8000-0000000000' || lpad(p_n::text,2,'0'))::uuid;
BEGIN
  INSERT INTO public.pedidos(id,tercero_id,canal,moneda,total,estado,expira_at,created_by,exchange_rate)
    VALUES (v_id,'e2000000-0000-4000-8000-000000000001','whatsapp','USD',10,p_estado,now()+interval '1 day','e1000000-0000-4000-8000-000000000001',1);
  INSERT INTO public.pedido_items(pedido_id,tipo,plan_id,categoria_id,servicio_id,ciclo_pago,precio,total,plan_nombre_snapshot,plan_tipo_nombre_snapshot)
    VALUES (v_id,'nueva','e2000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000005','mensual',10,10,'Mensual','Individual');
  RETURN v_id;
END;
$$;
SELECT pg_temp.mkpay(1,'RECON-10000001',10);
SELECT pg_temp.mkpay(2,'RECON-10000002',9.99);
SELECT pg_temp.mkpay(3,'RECON-10000003',9);
SELECT pg_temp.mkpay(4,'RECON-10000004',1);
SELECT pg_temp.mkpay(5,'RECON-10000005',12);
SELECT pg_temp.mkpay(6,'RECON-10000006',10,interval '10 days');
SELECT pg_temp.mkpay(7,'RECON-10000007',8);
SELECT pg_temp.mkpedido(1); SELECT pg_temp.mkpedido(2); SELECT pg_temp.mkpedido(3); SELECT pg_temp.mkpedido(4);
SELECT pg_temp.mkpedido(5); SELECT pg_temp.mkpedido(6); SELECT pg_temp.mkpedido(7); SELECT pg_temp.mkpedido(8);
SELECT pg_temp.mkpedido(9,'cancelado'); SELECT pg_temp.mkpedido(10);

CREATE TEMP TABLE res(label text PRIMARY KEY, r jsonb);
GRANT ALL ON res TO service_role, authenticated;
CREATE FUNCTION pg_temp.pid(p_n integer) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('e6000000-0000-4000-8000-0000000000' || lpad(p_n::text,2,'0'))::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.pid(integer) TO service_role, authenticated;

CREATE FUNCTION pg_temp.k(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT md5(p)::uuid $$;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
-- Exact amount confirms and delivers; the phone is not part of the key.
INSERT INTO res SELECT 'exact', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(1),' recon-10000001 ',pg_temp.k('exact'),'wa1');
INSERT INTO res SELECT 'exact-same-key', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(1),'RECON-10000001',pg_temp.k('exact'),'wa1');
INSERT INTO res SELECT 'exact-again', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(1),'RECON-10000001',pg_temp.k('exact2'),'wa1');
-- Single use: another order cannot claim the same code.
INSERT INTO res SELECT 'used', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(2),'RECON-10000001',pg_temp.k('used'),'wa2');
-- Tolerance (default 0.01).
INSERT INTO res SELECT 'tolerance', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(2),'RECON-10000002',pg_temp.k('tol'),'wa2');
-- Underpayment then a second code completes the sum.
INSERT INTO res SELECT 'under', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(3),'RECON-10000003',pg_temp.k('under'),'wa3');
INSERT INTO res SELECT 'under-sum', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(3),'RECON-10000004',pg_temp.k('under2'),'wa3');
-- Overpayment confirms with a note.
INSERT INTO res SELECT 'over', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(4),'RECON-10000005',pg_temp.k('over'),'wa4');
-- Payment older than the window is flagged, not applied.
INSERT INTO res SELECT 'window', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(5),'RECON-10000006',pg_temp.k('win'),'wa5');
-- Invalid orders.
INSERT INTO res SELECT 'cancelled', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(9),'RECON-10000007',pg_temp.k('canc'),'wa9');
INSERT INTO res SELECT 'missing', public.reclamar_pago_yappy_para_pedido(gen_random_uuid(),'RECON-10000007',pg_temp.k('miss'),'wa9');
-- Email not arrived: pending, then resolved by a retry after the sync ingests it.
INSERT INTO res SELECT 'pending', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(6),'RECON-20000001',pg_temp.k('pend'),'wa6');
INSERT INTO res SELECT 'pending-list-before', to_jsonb((SELECT count(*) FROM public.listar_comprobantes_pendientes(10) WHERE pedido_id = pg_temp.pid(6)));
RESET ROLE;
SELECT pg_temp.mkpay(8,'RECON-20000001',10);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
INSERT INTO res SELECT 'retry', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(6),'RECON-20000001',pg_temp.k('retry'),'wa6',true);
INSERT INTO res SELECT 'pending-list-after', to_jsonb((SELECT count(*) FROM public.listar_comprobantes_pendientes(10) WHERE pedido_id = pg_temp.pid(6)));
RESET ROLE;

SELECT is(r->>'resultado','confirmado','exact amount confirms') FROM res WHERE label='exact';
SELECT is((SELECT estado FROM public.pedidos WHERE id=pg_temp.pid(1)),'entregado','confirmed order is delivered atomically');
SELECT is((SELECT count(*) FROM public.pagos_venta WHERE notas = 'Pedido ' || pg_temp.pid(1)::text),1::bigint,'one sale payment per applied item');
SELECT is((SELECT match_status FROM public.yappy_payments WHERE confirmation_code='RECON-10000001'),'registrado','yappy payment registered');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE yappy_payment_id='e5000000-0000-4000-8000-000000000001'),1::bigint,'one Yappy, one pedido_pagos row');
SELECT is((SELECT r FROM res WHERE label='exact-same-key'),(SELECT r FROM res WHERE label='exact'),'same key returns the stored answer');
SELECT is((SELECT count(*) FROM public.intentos_comprobante WHERE pedido_id=pg_temp.pid(1)),2::bigint,'retry with same key adds no attempt row');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='exact-again'),'confirmado','same customer retyping a claimed code gets the current state');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=pg_temp.pid(1)),1::bigint,'retyping never duplicates the payment');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='used'),'codigo_usado','code claimed by another order is rejected');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=pg_temp.pid(2) AND yappy_payment_id='e5000000-0000-4000-8000-000000000001'),0::bigint,'rejected code records no payment');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='tolerance'),'confirmado','difference within tolerance confirms');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='under'),'monto_menor','underpayment outcome');
SELECT is((SELECT estado FROM public.pedidos WHERE id=pg_temp.pid(3)) ,'entregado','sum of several Yappy codes completes the order');
SELECT is((SELECT r->>'faltante' FROM res WHERE label='under'),'1.00','underpayment reports what is missing');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=pg_temp.pid(3)),2::bigint,'both codes retained');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='under-sum'),'confirmado','second code confirms');
SELECT ok((SELECT requiere_revision FROM public.yappy_payments WHERE confirmation_code='RECON-10000003'),'underpayment flagged for /pagos-yappy');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='over'),'monto_mayor','overpayment outcome');
SELECT is((SELECT (r->>'confirmado')::boolean FROM res WHERE label='over'),true,'overpayment is confirmed');
SELECT is((SELECT notas FROM public.pedidos WHERE id=pg_temp.pid(4)),'Sobrepago: 2.00 USD','overpayment difference noted');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='window'),'fuera_de_ventana','stale payment is outside the window');
SELECT is((SELECT estado FROM public.pedidos WHERE id=pg_temp.pid(5)),'esperando_pago','out-of-window payment does not move the order');
SELECT ok((SELECT requiere_revision AND revision_motivo='fuera_de_ventana' FROM public.yappy_payments WHERE confirmation_code='RECON-10000006'),'out-of-window payment flagged');
SELECT is((SELECT match_status FROM public.yappy_payments WHERE confirmation_code='RECON-10000006'),'sin_match','out-of-window payment stays unclaimed');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='cancelled'),'pedido_invalido','cancelled order is invalid');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='missing'),'pedido_invalido','unknown order is invalid');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='pending'),'no_encontrado','missing email is not found');
SELECT is((SELECT r FROM res WHERE label='pending-list-before'),'1'::jsonb,'pending receipt listed for retry');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='retry'),'confirmado','retry confirms once the email is ingested');
SELECT is((SELECT r FROM res WHERE label='pending-list-after'),'0'::jsonb,'resolved receipt leaves the pending list');
SELECT is((SELECT count(*) FROM public.domain_events WHERE type='pedido.pago_reclamado' AND aggregate_id=pg_temp.pid(1)::text),1::bigint,'claim emits one domain event');
SELECT is((SELECT count(*) FROM public.domain_events WHERE type='pedido.pago_en_revision' AND aggregate_id=pg_temp.pid(3)::text),1::bigint,'review notice emitted for underpayment');
SELECT is((SELECT count(*) FROM public.domain_events WHERE type LIKE 'pedido.%' AND payload::text ~ '(wa[0-9]|RECON-)'),0::bigint,'events carry no phone or code');

-- Attempts guard against code guessing.
UPDATE public.pedido_pago_ajustes SET max_intentos = 2;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
INSERT INTO res SELECT 'g1', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(7),'GUESS-10000001',pg_temp.k('g1'),'wa-guess');
INSERT INTO res SELECT 'g2', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(7),'GUESS-10000002',pg_temp.k('g2'),'wa-guess');
INSERT INTO res SELECT 'g3', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(7),'RECON-10000007',pg_temp.k('g3'),'wa-guess');
INSERT INTO res SELECT 'g-other-order', public.reclamar_pago_yappy_para_pedido(pg_temp.pid(8),'GUESS-10000003',pg_temp.k('g4'),'wa-guess');
RESET ROLE;
SELECT is((SELECT r->>'resultado' FROM res WHERE label='g3'),'intentos_excedidos','guard blocks even a valid code after too many misses');
SELECT is((SELECT r->>'resultado' FROM res WHERE label='g-other-order'),'intentos_excedidos','guard also counts attempts per WhatsApp id');
SELECT is((SELECT estado FROM public.pedidos WHERE id=pg_temp.pid(7)),'esperando_pago','blocked attempt does not claim the payment');
SELECT is((SELECT count(*) FROM public.domain_events WHERE type='pedido.pago_en_revision' AND aggregate_id=pg_temp.pid(7)::text),1::bigint,'blocked order raises one admin notice');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT public.reclamar_pago_yappy_para_pedido(gen_random_uuid(),'X',NULL)$$,'P0001','pedido_key_required','key is required');
RESET ROLE;

-- Grants and RLS.
SELECT set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.reclamar_pago_yappy_para_pedido(gen_random_uuid(),'X',gen_random_uuid())$$,'42501',NULL,'authenticated cannot claim');
SELECT throws_ok($$SELECT * FROM public.listar_comprobantes_pendientes(1)$$,'42501',NULL,'authenticated cannot list pending receipts');
SELECT is((SELECT count(*) FROM public.intentos_comprobante),0::bigint,'non-admin reads no attempts');
SELECT is((WITH u AS (UPDATE public.pedido_pago_ajustes SET tolerancia = 4 RETURNING 1) SELECT count(*) FROM u),0::bigint,'non-admin cannot edit settings');
SELECT throws_ok($$INSERT INTO public.intentos_comprobante(pedido_id,codigo,resultado,idempotency_key) VALUES (gen_random_uuid(),'X','confirmado',gen_random_uuid())$$,'42501',NULL,'authenticated cannot write attempts');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM public.intentos_comprobante) > 0,'admin reads attempts');
SELECT is((WITH u AS (UPDATE public.pedido_pago_ajustes SET tolerancia = 0.5 RETURNING 1) SELECT count(*) FROM u),1::bigint,'admin edits settings');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.reclamar_pago_yappy_para_pedido(gen_random_uuid(),'X',gen_random_uuid())$$,'42501',NULL,'anon cannot claim');
RESET ROLE;
SELECT ok(NOT has_function_privilege('service_role','private.finalizar_pedido_pagado(uuid,numeric)','EXECUTE'),'internal finalizer is not callable');
SELECT ok(NOT has_function_privilege('authenticated','public.reclamar_pago_yappy_para_pedido(uuid,text,uuid,text,boolean)','EXECUTE'),'claim RPC is service_role only');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE proname='reclamar_pago_yappy_para_pedido'),'claim RPC is SECURITY DEFINER');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.intentos_comprobante'::regclass),'RLS on attempts');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.pedido_pago_ajustes'::regclass),'RLS on settings');
SELECT is((public.run_security_audit_validations()->>'rls_disabled_app_tables')::integer,0,'audit: RLS enabled everywhere');
SELECT is((public.run_security_audit_validations()->>'unapproved_security_definer_executable_by_authenticated')::integer,0,'audit: no new authenticated definers');
SELECT * FROM finish();
ROLLBACK;
