BEGIN;
SELECT plan(62);

-- Los perfiles nacen por handle_new_auth_user, igual que en Auth local.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '51111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'bot-admin@example.test', '', now()),
  ('00000000-0000-0000-0000-000000000000', '52222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'bot-operator@example.test', '', now()),
  ('00000000-0000-0000-0000-000000000000', '54444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'bot-admin-inactive@example.test', '', now());

UPDATE public.usuarios SET role = 'admin'
WHERE id IN ('51111111-1111-4111-8111-111111111111', '54444444-4444-4444-8444-444444444444');
UPDATE public.usuarios SET active = false WHERE id = '54444444-4444-4444-8444-444444444444';

-- Evento sintetico previo para comprobar que solo los administradores lo leen.
INSERT INTO public.whatsapp_bot_events (wa_id, type, node_id, detail)
VALUES ('50760000001', 'menu_shown', 'menu', '{"fixture": true}'::jsonb);

-- Tablas y RLS
SELECT has_table('public', 'whatsapp_bot_versions', 'existe la tabla de versiones');
SELECT has_table('public', 'whatsapp_bot_config', 'existe la tabla de configuracion');
SELECT has_table('public', 'whatsapp_bot_events', 'existe la tabla de eventos');
SELECT ok((SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = 'public.whatsapp_bot_versions'::regclass),
  'RLS activa en versiones');
SELECT ok((SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = 'public.whatsapp_bot_config'::regclass),
  'RLS activa en configuracion');
SELECT ok((SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = 'public.whatsapp_bot_events'::regclass),
  'RLS activa en eventos');

-- Privilegios: anon sin acceso, versiones inmutables para todos los roles
SELECT ok(NOT has_table_privilege('anon', 'public.whatsapp_bot_config', 'SELECT'), 'anon no lee la configuracion');
SELECT ok(NOT has_table_privilege('anon', 'public.whatsapp_bot_versions', 'SELECT'), 'anon no lee las versiones');
SELECT ok(NOT has_table_privilege('anon', 'public.whatsapp_bot_events', 'SELECT'), 'anon no lee los eventos');
SELECT ok(NOT has_table_privilege('authenticated', 'public.whatsapp_bot_versions', 'INSERT'), 'authenticated no inserta versiones');
SELECT ok(NOT has_table_privilege('authenticated', 'public.whatsapp_bot_versions', 'UPDATE'), 'authenticated no actualiza versiones');
SELECT ok(NOT has_table_privilege('authenticated', 'public.whatsapp_bot_versions', 'DELETE'), 'authenticated no borra versiones');
SELECT ok(NOT has_table_privilege('service_role', 'public.whatsapp_bot_versions', 'UPDATE'), 'service_role no actualiza versiones');
SELECT ok(NOT has_table_privilege('service_role', 'public.whatsapp_bot_versions', 'DELETE'), 'service_role no borra versiones');
SELECT ok(NOT has_table_privilege('service_role', 'public.whatsapp_bot_events', 'INSERT'), 'service_role no inserta eventos directo');
SELECT ok(has_table_privilege('service_role', 'public.whatsapp_bot_config', 'SELECT'), 'service_role lee la configuracion');

-- Siembra
SELECT is((SELECT enabled FROM public.whatsapp_bot_config WHERE id = 'global'), false, 'el bot nace apagado');
SELECT is((SELECT published_version FROM public.whatsapp_bot_config WHERE id = 'global'), 1, 'la configuracion apunta a la version 1');
SELECT is((SELECT definition ->> 'entryNodeId' FROM public.whatsapp_bot_versions WHERE version = 1), 'menu',
  'la version 1 contiene la definicion por defecto');

-- Privilegios de las funciones
SELECT ok(NOT has_function_privilege('anon', 'public.publish_whatsapp_bot_version(jsonb, text)', 'EXECUTE'), 'anon no publica');
SELECT ok(NOT has_function_privilege('anon', 'public.set_whatsapp_bot_enabled(boolean)', 'EXECUTE'), 'anon no activa');
SELECT ok(has_function_privilege('authenticated', 'public.publish_whatsapp_bot_version(jsonb, text)', 'EXECUTE'), 'authenticated puede invocar publicar');
SELECT ok(NOT has_function_privilege('service_role', 'public.publish_whatsapp_bot_version(jsonb, text)', 'EXECUTE'), 'service_role no publica');
SELECT ok(NOT has_function_privilege('authenticated', 'public.record_whatsapp_bot_event(text, text, text, text, text, jsonb)', 'EXECUTE'),
  'authenticated no registra eventos');
SELECT ok(has_function_privilege('service_role', 'public.record_whatsapp_bot_event(text, text, text, text, text, jsonb)', 'EXECUTE'),
  'service_role registra eventos');

-- Usuario sin rol de administrador
SELECT set_config('request.jwt.claims', '{"sub":"52222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.publish_whatsapp_bot_version('{}'::jsonb, 'Nota')$$, '42501', 'forbidden',
  'un operador no publica');
SELECT throws_ok($$SELECT public.set_whatsapp_bot_enabled(true)$$, '42501', 'forbidden', 'un operador no activa el bot');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_config), 0::bigint, 'un operador no lee la configuracion');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_versions), 0::bigint, 'un operador no lee las versiones');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_events), 0::bigint, 'un operador no lee los eventos');
RESET ROLE;

-- Administrador desactivado
SELECT set_config('request.jwt.claims', '{"sub":"54444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.publish_whatsapp_bot_version('{}'::jsonb, 'Nota')$$, '42501', 'forbidden',
  'un administrador desactivado no publica');
RESET ROLE;

-- Administrador activo
SELECT set_config('request.jwt.claims', '{"sub":"51111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.whatsapp_bot_config), 1::bigint, 'el administrador lee la configuracion');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_events), 1::bigint, 'el administrador lee los eventos');
SELECT lives_ok($$SELECT public.publish_whatsapp_bot_version('{"schemaVersion":1,"entryNodeId":"menu"}'::jsonb, '  Nota de prueba  ')$$,
  'el administrador publica una version');
SELECT is((SELECT published_version FROM public.whatsapp_bot_config WHERE id = 'global'),
  (SELECT max(version) FROM public.whatsapp_bot_versions), 'publicar fija la version publicada');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_versions), 2::bigint, 'publicar crea exactamente una version');
SELECT is((SELECT note FROM public.whatsapp_bot_versions WHERE version = (SELECT max(version) FROM public.whatsapp_bot_versions)),
  'Nota de prueba', 'la nota se guarda recortada');
SELECT is((SELECT created_by FROM public.whatsapp_bot_versions WHERE version = (SELECT max(version) FROM public.whatsapp_bot_versions)),
  '51111111-1111-4111-8111-111111111111'::uuid, 'la version guarda al autor');
SELECT is((SELECT updated_by FROM public.whatsapp_bot_config WHERE id = 'global'),
  '51111111-1111-4111-8111-111111111111'::uuid, 'la configuracion guarda quien publico');
SELECT is(public.set_whatsapp_bot_enabled(true), true, 'el administrador activa el bot');
SELECT is((SELECT enabled FROM public.whatsapp_bot_config WHERE id = 'global'), true, 'el bot queda activo');
SELECT is(public.set_whatsapp_bot_enabled(false), false, 'el administrador apaga el bot');

-- Limites de entrada: ninguna publicacion invalida deja rastro
SELECT throws_ok($$SELECT public.publish_whatsapp_bot_version('[]'::jsonb, 'Nota')$$, 'P0001', 'invalid bot definition',
  'rechaza una definicion que no es objeto');
SELECT throws_ok($$SELECT public.publish_whatsapp_bot_version(NULL::jsonb, 'Nota')$$, 'P0001', 'invalid bot definition',
  'rechaza una definicion nula');
SELECT throws_ok($$SELECT public.publish_whatsapp_bot_version(jsonb_build_object('x', repeat('a', 262144)), 'Nota')$$,
  'P0001', 'invalid bot definition', 'rechaza una definicion de mas de 256 KB');
SELECT throws_ok($$SELECT public.publish_whatsapp_bot_version('{}'::jsonb, '   ')$$, 'P0001', 'invalid bot version note',
  'la nota es obligatoria');
SELECT throws_ok($$SELECT public.publish_whatsapp_bot_version('{}'::jsonb, repeat('x', 201))$$, 'P0001', 'invalid bot version note',
  'la nota admite 200 caracteres como maximo');
SELECT throws_ok($$SELECT public.set_whatsapp_bot_enabled(NULL)$$, 'P0001', 'invalid bot enabled flag',
  'rechaza un interruptor nulo');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_versions), 2::bigint, 'las publicaciones rechazadas no crean versiones');

-- Escrituras directas denegadas incluso a un administrador
SELECT throws_ok($$INSERT INTO public.whatsapp_bot_versions (definition) VALUES ('{}'::jsonb)$$, '42501', NULL,
  'un administrador no inserta versiones directo');
SELECT throws_ok($$UPDATE public.whatsapp_bot_versions SET note = 'x'$$, '42501', NULL, 'las versiones son inmutables');
SELECT throws_ok($$DELETE FROM public.whatsapp_bot_versions WHERE version = 1$$, '42501', NULL, 'las versiones no se borran');
SELECT throws_ok($$UPDATE public.whatsapp_bot_config SET enabled = true$$, '42501', NULL, 'la configuracion solo cambia por RPC');
SELECT throws_ok($$INSERT INTO public.whatsapp_bot_events (wa_id, type) VALUES ('1', 'error')$$, '42501', NULL,
  'un administrador no inserta eventos');
RESET ROLE;

-- Registro de eventos por el webhook y purga a los 90 dias
INSERT INTO public.whatsapp_bot_events (wa_id, type, created_at)
VALUES ('50760000002', 'menu_shown', now() - interval '91 days'),
       ('50760000003', 'menu_shown', now() - interval '89 days');
SET LOCAL ROLE service_role;
SELECT ok(public.record_whatsapp_bot_event('50760000001', NULL, 'code_sent', 'login', 'codigo', '{"minutes": 5}'::jsonb) IS NOT NULL,
  'service_role registra un evento');
SELECT throws_ok($$SELECT public.record_whatsapp_bot_event('50760000001', NULL, 'TIPO INVALIDO', NULL, NULL, '{}'::jsonb)$$,
  '23514', NULL, 'rechaza un tipo con formato invalido');
SELECT throws_ok($$SELECT public.record_whatsapp_bot_event('50760000001', NULL, 'error', NULL, NULL, '[]'::jsonb)$$,
  '23514', NULL, 'rechaza un detalle que no es objeto');
SELECT throws_ok($$SELECT public.record_whatsapp_bot_event('50760000001', NULL, 'error', NULL, NULL, jsonb_build_object('k', repeat('a', 4097)))$$,
  '23514', NULL, 'rechaza un detalle de mas de 4 KB');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.whatsapp_bot_events WHERE wa_id = '50760000002'), 0::bigint,
  'el evento de hace 91 dias se purga al insertar');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_events WHERE wa_id = '50760000003'), 1::bigint,
  'el evento de hace 89 dias se conserva');

-- anon
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT count(*) FROM public.whatsapp_bot_config$$, '42501', NULL, 'anon no consulta la configuracion');
SELECT throws_ok($$SELECT public.publish_whatsapp_bot_version('{}'::jsonb, 'Nota')$$, '42501', NULL, 'anon no publica');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
