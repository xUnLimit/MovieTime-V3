BEGIN;
SELECT no_plan();
UPDATE public.mt_automation_settings SET settings=jsonb_set(settings,'{purchasesEnabled}','true');

INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
 VALUES('00000000-0000-0000-0000-000000000000','c1111111-1111-4111-8111-111111111111',
   'authenticated','authenticated','last4-admin@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='c1111111-1111-4111-8111-111111111111';
INSERT INTO public.categorias(id,nombre,tipo) VALUES('c2222222-2222-4222-8222-222222222222','Last4 fixture','cliente');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES('c3333333-3333-4333-8333-333333333333','c2222222-2222-4222-8222-222222222222','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,ciclo_pago,precio)
 VALUES('c4444444-4444-4444-8444-444444444444','c2222222-2222-4222-8222-222222222222','c3333333-3333-4333-8333-333333333333','Mensual','mensual',10);
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
 VALUES('c5555555-5555-4555-8555-555555555555','c2222222-2222-4222-8222-222222222222','c3333333-3333-4333-8333-333333333333','Last4 fixture','last4@example.test','fixture-only',12);
INSERT INTO public.whatsapp_contacts(wa_id,estado)
 SELECT '507630000' || lpad(n::text,2,'0'),'lead' FROM generate_series(1,10) n;
CREATE TEMP TABLE fixture_orders(name text PRIMARY KEY,id uuid);
GRANT ALL ON fixture_orders TO PUBLIC;
CREATE FUNCTION pg_temp.wa(n integer) RETURNS text LANGUAGE sql AS $$ SELECT '507630000' || lpad(n::text,2,'0') $$;
CREATE FUNCTION pg_temp.payment(code text,amount numeric,paid timestamptz DEFAULT now()) RETURNS void LANGUAGE plpgsql AS $$
DECLARE mail uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.yappy_mail_messages(id,uid_validity,imap_uid,received_at,from_address,dmarc_pass,status)
   VALUES(mail,7,(random()*1000000000)::bigint+1,now(),'no-reply@yappy.com.pa',true,'extraido');
 INSERT INTO public.yappy_payments(confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,mail_message_id)
   VALUES(code,amount,'Other payer','0000',paid,mail);
END $$;
CREATE FUNCTION pg_temp.match(n integer,last4 text,k uuid DEFAULT gen_random_uuid()) RETURNS text LANGUAGE sql AS $$
 SELECT public.mt_match_order_payment((SELECT id FROM fixture_orders WHERE name='o' || n),last4,pg_temp.wa(n),k)
$$;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
INSERT INTO fixture_orders SELECT 'o' || n,public.mt_create_commerce_order(pg_temp.wa(n),
 ARRAY['c4444444-4444-4444-8444-444444444444'],'compra',gen_random_uuid(),10)::uuid FROM generate_series(1,10) n;

-- Unique match: amount + last four + window confirms through the same atomic path as 'pago CODIGO'.
SELECT pg_temp.payment('VAEIZ-93839238',10);
SELECT lives_ok($$SELECT pg_temp.match(1,'9238','c6111111-1111-4111-8111-111111111111')$$,'unique match confirms');
SELECT is((SELECT payment_state FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='o1')),'cubierto','the order is covered');
SELECT is((SELECT delivery_state FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='o1')),'asignado','the covered order is assigned atomically');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='o1')),1::bigint,'one receipt is applied');
SELECT lives_ok($$SELECT pg_temp.match(1,'9238','c6111111-1111-4111-8111-111111111111')$$,'the same intention replays');
SELECT lives_ok($$SELECT pg_temp.match(1,'9238')$$,'a covered order ignores a new attempt');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='o1')),1::bigint,'money is never applied twice');

-- A payment already assigned cannot confirm a second order.
SELECT lives_ok($$SELECT pg_temp.match(2,'9238')$$,'an assigned payment is not matched again');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='o2')),'pago_en_revision','the second order goes to review');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='o2')),0::bigint,'no money is confirmed for it');

-- No match and invalid input.
SELECT lives_ok($$SELECT pg_temp.match(3,'0000')$$,'no match is a controlled outcome');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='o3')),'pago_en_revision','no match sends the order to review');
SELECT throws_ok($$SELECT pg_temp.match(4,'12ab')$$,'P0001','pedido_invalid_receipt','only four digits are accepted');
SELECT lives_ok($$SELECT public.mt_match_order_payment((SELECT id FROM fixture_orders WHERE name='o4'),NULL,pg_temp.wa(4),gen_random_uuid())$$,'a request without digits goes to review');
SELECT is((SELECT estado FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='o4')),'pago_en_revision','without digits the order waits for a person');
SELECT throws_ok($$SELECT public.mt_match_order_payment((SELECT id FROM fixture_orders WHERE name='o5'),'1234',pg_temp.wa(10),gen_random_uuid())$$,'42501','pedido_forbidden','another contact cannot use the order');

-- Ambiguous: both candidates are flagged and none is confirmed.
SELECT pg_temp.payment('AAAAA-12345555',10);
SELECT pg_temp.payment('BBBBB-99995555',10);
SELECT lives_ok($$SELECT pg_temp.match(5,'5555')$$,'ambiguous matches are controlled');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='o5')),0::bigint,'ambiguity confirms nothing');
SELECT is((SELECT count(*) FROM public.yappy_payments WHERE revision_pedido_id=(SELECT id FROM fixture_orders WHERE name='o5') AND requiere_revision),2::bigint,'both candidates are left for the operator');

-- Partial, excess and late payments are never auto-confirmed.
SELECT pg_temp.payment('CCCCC-00007777',4);
SELECT pg_temp.payment('DDDDD-00008888',12);
SELECT pg_temp.payment('EEEEE-00006666',10,now()+interval '100 hours');
SELECT pg_temp.match(6,'7777');
SELECT is((SELECT revision_motivo FROM public.yappy_payments WHERE confirmation_code='CCCCC-00007777'),'Pago menor al monto pendiente','a partial payment is flagged');
SELECT pg_temp.match(7,'8888');
SELECT is((SELECT revision_motivo FROM public.yappy_payments WHERE confirmation_code='DDDDD-00008888'),'Pago mayor al monto pendiente','an excess payment is flagged');
SELECT pg_temp.match(8,'6666');
SELECT is((SELECT revision_motivo FROM public.yappy_payments WHERE confirmation_code='EEEEE-00006666'),'Pago fuera de la ventana del pedido','a late payment is flagged');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id IN (SELECT id FROM fixture_orders WHERE name IN ('o6','o7','o8'))),0::bigint,'none of them confirms money');
SELECT is((SELECT count(*) FROM public.pedidos WHERE id IN (SELECT id FROM fixture_orders WHERE name IN ('o6','o7','o8')) AND estado='pago_en_revision'),3::bigint,'all three wait for review');

-- The panel projection carries the candidate; the bot projection never does.
SELECT set_config('request.jwt.claims','{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT (o->'reviewCandidate'->>'code') FROM jsonb_array_elements(public.mt_list_orders()) o WHERE o->>'id'=(SELECT id::text FROM fixture_orders WHERE name='o6')),'CCCCC-00007777','Cobros shows the cross-checked candidate');
SELECT throws_ok($$SELECT public.mt_match_order_payment((SELECT id FROM fixture_orders WHERE name='o6'),'7777',pg_temp.wa(6),gen_random_uuid())$$,'42501',NULL,'an operator session cannot run the customer match');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT ok(NOT (public.mt_get_commerce_order(pg_temp.wa(6),(SELECT id FROM fixture_orders WHERE name='o6')) ? 'reviewCandidate'),'the customer-facing projection hides the candidate');

-- Attempt limit per contact: a sixth attempt cannot match even a real payment.
SELECT pg_temp.match(9,n) FROM unnest(ARRAY['0001','0002','0003','0004','0005']) n;
SELECT pg_temp.payment('FFFFF-00004444',10);
SELECT lives_ok($$SELECT pg_temp.match(9,'4444')$$,'the sixth attempt is controlled');
SELECT is((SELECT count(*) FROM public.pedido_pagos WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='o9')),0::bigint,'the limit blocks guessing');
SELECT ok(EXISTS (SELECT 1 FROM public.intentos_comprobante WHERE pedido_id=(SELECT id FROM fixture_orders WHERE name='o9') AND resultado='intentos_excedidos'),'the lockout is audited');

-- No regression: 'pago CODIGO' still reconciles by the full code.
SELECT pg_temp.payment('GGGGG-00003333',10);
SELECT lives_ok($$SELECT public.mt_reconcile_order((SELECT id FROM fixture_orders WHERE name='o10'),'GGGGG-00003333',pg_temp.wa(10),gen_random_uuid())$$,'the code command still works');
SELECT is((SELECT payment_state FROM public.pedidos WHERE id=(SELECT id FROM fixture_orders WHERE name='o10')),'cubierto','the full-code path still confirms');

-- Grants: only the server role may run the customer match.
SELECT ok(NOT has_function_privilege('anon','public.mt_match_order_payment(uuid,text,text,uuid)','EXECUTE'),'anonymous cannot match');
SELECT ok(NOT has_function_privilege('authenticated','public.mt_match_order_payment(uuid,text,text,uuid)','EXECUTE'),'operators cannot forge the customer identity');
SELECT ok(has_function_privilege('service_role','public.mt_match_order_payment(uuid,text,text,uuid)','EXECUTE'),'the server role can match');
SELECT ok((SELECT prosecdef AND 'search_path=""' = ANY(proconfig) FROM pg_proc WHERE oid='public.mt_match_order_payment(uuid,text,text,uuid)'::regprocedure),'the function pins an empty search_path');
SELECT * FROM finish();
ROLLBACK;
