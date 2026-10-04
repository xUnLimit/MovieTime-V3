BEGIN;
SELECT no_plan();

INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at) VALUES
('00000000-0000-0000-0000-000000000000','71111111-1111-4111-8111-111111111111','authenticated','authenticated','copy-admin@example.test','',now()),
('00000000-0000-0000-0000-000000000000','72222222-2222-4222-8222-222222222222','authenticated','authenticated','copy-operator@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='71111111-1111-4111-8111-111111111111';

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.mt_commerce_copy'::regclass),'copy RLS enabled');
SELECT ok(NOT has_function_privilege('anon','public.mt_set_commerce_copy(text,text)','EXECUTE'),'anonymous cannot edit copy');
SELECT ok(NOT has_table_privilege('authenticated','public.mt_commerce_copy','INSERT'),'users cannot write the table directly');
SELECT ok(NOT has_table_privilege('service_role','public.mt_commerce_copy','UPDATE'),'service cannot rewrite copy directly');

SELECT set_config('request.jwt.claims','{"sub":"72222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.mt_set_commerce_copy('greeting','Hola')$$,'42501','forbidden','operator cannot edit copy');
SELECT is((SELECT count(*) FROM public.mt_commerce_copy),0::bigint,'operator reads nothing');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"71111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.mt_set_commerce_copy('Bad Key','Hola')$$,'22023','invalid copy','malformed key rejected');
SELECT throws_ok($$SELECT public.mt_set_commerce_copy('greeting','<b>Hola</b>')$$,'22023','invalid copy','markup rejected');
SELECT throws_ok($$SELECT public.mt_set_commerce_copy('greeting','   ')$$,'22023','invalid copy','blank text rejected');
SELECT throws_ok($$SELECT public.mt_set_commerce_copy('greeting',repeat('a',1001))$$,'22023','invalid copy','oversized text rejected');
SELECT is(public.mt_set_commerce_copy('greeting','  Hola, ¿en qué te ayudo?  '),'greeting','admin saves a text');
SELECT is((SELECT text FROM public.mt_commerce_copy WHERE key='greeting'),'Hola, ¿en qué te ayudo?','text is trimmed');
SELECT is(public.mt_set_commerce_copy('greeting','Buenas, ¿qué necesitas?'),'greeting','admin edits it again');
SELECT is((SELECT count(*) FROM public.mt_commerce_copy WHERE key='greeting'),1::bigint,'one row per message');
SELECT is((SELECT updated_by FROM public.mt_commerce_copy WHERE key='greeting'),'71111111-1111-4111-8111-111111111111'::uuid,'author is recorded');
SELECT is(public.mt_set_commerce_copy('greeting',NULL),'greeting','null restores the original');
SELECT is((SELECT count(*) FROM public.mt_commerce_copy),0::bigint,'restoring removes the override');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
