BEGIN;
SELECT plan(26);

-- Claves sinteticas: sha256 hex de 64 caracteres.
SELECT has_table('public', 'netflix_code_claims', 'existe la tabla de reclamaciones');
SELECT ok((SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = 'public.netflix_code_claims'::regclass),
  'RLS activa en netflix_code_claims');
SELECT is((SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'netflix_code_claims'),
  0::bigint, 'netflix_code_claims no tiene politicas');
SELECT ok(NOT has_table_privilege('anon', 'public.netflix_code_claims', 'SELECT'), 'anon no lee la tabla');
SELECT ok(NOT has_table_privilege('anon', 'public.netflix_code_claims', 'INSERT'), 'anon no inserta en la tabla');
SELECT ok(NOT has_table_privilege('authenticated', 'public.netflix_code_claims', 'SELECT'), 'authenticated no lee la tabla');
SELECT ok(NOT has_table_privilege('authenticated', 'public.netflix_code_claims', 'INSERT'), 'authenticated no inserta en la tabla');
SELECT ok(has_table_privilege('service_role', 'public.netflix_code_claims', 'SELECT'), 'service_role lee la tabla');
SELECT ok(NOT has_table_privilege('service_role', 'public.netflix_code_claims', 'INSERT'), 'service_role no escribe directo');
SELECT ok(NOT has_function_privilege('anon', 'public.claim_netflix_code(text, text)', 'EXECUTE'), 'anon no reclama');
SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_netflix_code(text, text)', 'EXECUTE'), 'authenticated no reclama');
SELECT ok(NOT has_function_privilege('anon', 'public.release_netflix_code(text, text)', 'EXECUTE'), 'anon no libera');
SELECT ok(NOT has_function_privilege('authenticated', 'public.release_netflix_code(text, text)', 'EXECUTE'), 'authenticated no libera');
SELECT ok(has_function_privilege('service_role', 'public.claim_netflix_code(text, text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.release_netflix_code(text, text)', 'EXECUTE'),
  'service_role ejecuta ambas funciones');

SET LOCAL ROLE service_role;
SELECT is(public.claim_netflix_code(repeat('a', 64), '50760000001'), 'claimed', 'primera entrega reclama');
SELECT is(public.claim_netflix_code(repeat('a', 64), '50760000001'), 'mine', 'el mismo numero recibe mine');
SELECT is(public.claim_netflix_code(repeat('a', 64), '50760000002'), 'taken', 'otro numero recibe taken');
SELECT is(public.release_netflix_code(repeat('a', 64), '50760000002'), false, 'otro numero no libera la reclamacion ajena');
SELECT is((SELECT wa_id FROM public.netflix_code_claims WHERE mail_key = repeat('a', 64)), '50760000001',
  'la reclamacion sigue siendo del primer numero');
SELECT is(public.release_netflix_code(repeat('a', 64), '50760000001'), true, 'el dueno libera su reclamacion');
SELECT is(public.claim_netflix_code(repeat('a', 64), '50760000002'), 'claimed', 'tras liberar otro numero puede reclamar');
RESET ROLE;

-- Las filas con mas de 2 dias se purgan al reclamar otro correo.
INSERT INTO public.netflix_code_claims (mail_key, wa_id, created_at)
VALUES (repeat('b', 64), '50760000003', now() - interval '3 days');
SET LOCAL ROLE service_role;
SELECT is(public.claim_netflix_code(repeat('c', 64), '50760000003'), 'claimed', 'reclamar otro correo funciona');
SELECT is((SELECT count(*) FROM public.netflix_code_claims WHERE mail_key = repeat('b', 64)), 0::bigint,
  'la reclamacion de hace 3 dias se purga');
SELECT throws_ok($$SELECT public.claim_netflix_code('no-es-hash', '50760000001')$$, 'P0001', 'invalid netflix code claim',
  'rechaza una clave que no es sha256 hex');
SELECT throws_ok($$SELECT public.release_netflix_code(repeat('a', 64), '')$$, 'P0001', 'invalid netflix code release',
  'rechaza un numero vacio');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.claim_netflix_code(repeat('d', 64), '50760000001')$$, '42501', NULL,
  'anon no puede ejecutar la reclamacion');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
