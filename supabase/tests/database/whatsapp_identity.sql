BEGIN;
SELECT plan(42);

-- Los perfiles nacen por handle_new_auth_user, igual que en Auth local.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '61111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'identity-admin@example.test', '', now()),
  ('00000000-0000-0000-0000-000000000000', '62222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'identity-operator@example.test', '', now());
UPDATE public.usuarios SET role = 'admin' WHERE id = '61111111-1111-4111-8111-111111111111';

-- Terceros sinteticos: uno unico, dos que comparten numero (ambiguo) y uno inactivo.
INSERT INTO public.terceros (id, nombre, apellido, tipo, telefono, active)
VALUES
  ('c6000000-0000-4000-8000-000000000001', 'Unico', 'Prueba', 'cliente', '6987-0001', true),
  ('c6000000-0000-4000-8000-000000000002', 'Doble', 'Uno', 'cliente', '6987-0002', true),
  ('c6000000-0000-4000-8000-000000000003', 'Doble', 'Dos', 'cliente', '+507 6987 0002', true),
  ('c6000000-0000-4000-8000-000000000004', 'Inactivo', 'Prueba', 'cliente', '6987-0003', false);

-- Normalizacion: identica a normalizePanamaWaId (message-data.test.ts)
SELECT is(public.normalize_panama_wa_id('6533-1751'), '50765331751', 'normaliza 8 digitos con guion');
SELECT is(public.normalize_panama_wa_id('+507 6533 1751'), '50765331751', 'normaliza +507 con espacios');
SELECT is(public.normalize_panama_wa_id('50765331751'), '50765331751', 'conserva 507 + 8 digitos');
SELECT is(public.normalize_panama_wa_id('(507) 6533-1751'), '50765331751', 'normaliza (507) con guion');
SELECT is(public.normalize_panama_wa_id(''), NULL, 'rechaza vacio');
SELECT is(public.normalize_panama_wa_id('123'), NULL, 'rechaza pocos digitos');
SELECT is(public.normalize_panama_wa_id('5076533175'), NULL, 'rechaza 507 + 7 digitos');
SELECT is(public.normalize_panama_wa_id('9995076533175'), NULL, 'rechaza prefijos ajenos');
SELECT is(public.normalize_panama_wa_id('abc'), NULL, 'rechaza texto sin digitos');
SELECT is(public.normalize_panama_wa_id('12345678901'), NULL, 'rechaza 11 digitos sin 507');
SELECT is(public.normalize_panama_wa_id(NULL), NULL, 'rechaza NULL');

-- Columna generada en terceros
SELECT has_column('public', 'terceros', 'wa_id', 'terceros tiene wa_id');
SELECT is((SELECT a.attgenerated FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.terceros'::regclass AND a.attname = 'wa_id'), 's'::"char", 'wa_id es generada y almacenada');
SELECT is((SELECT wa_id FROM public.terceros WHERE id = 'c6000000-0000-4000-8000-000000000001'), '50769870001',
  'wa_id se calcula del telefono');
UPDATE public.terceros SET telefono = '69870004' WHERE id = 'c6000000-0000-4000-8000-000000000004';
SELECT is((SELECT wa_id FROM public.terceros WHERE id = 'c6000000-0000-4000-8000-000000000004'), '50769870004',
  'wa_id se recalcula al cambiar el telefono');
SELECT throws_ok($$UPDATE public.terceros SET wa_id = '1' WHERE id = 'c6000000-0000-4000-8000-000000000001'$$,
  '428C9', NULL, 'wa_id no admite escritura directa');

-- Tabla de contactos: RLS y privilegios
SELECT has_table('public', 'whatsapp_contacts', 'existe la tabla de contactos');
SELECT ok((SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = 'public.whatsapp_contacts'::regclass),
  'RLS activa en contactos');
SELECT ok(NOT has_table_privilege('anon', 'public.whatsapp_contacts', 'SELECT'), 'anon no lee contactos');
SELECT ok(NOT has_table_privilege('authenticated', 'public.whatsapp_contacts', 'INSERT'), 'authenticated no inserta contactos');
SELECT ok(NOT has_table_privilege('authenticated', 'public.whatsapp_contacts', 'UPDATE'), 'authenticated no actualiza contactos');
SELECT ok(NOT has_table_privilege('service_role', 'public.whatsapp_contacts', 'INSERT'), 'service_role no inserta directo');
SELECT ok(NOT has_function_privilege('anon', 'public.upsert_whatsapp_contact(text, text)', 'EXECUTE'), 'anon no ejecuta el RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.upsert_whatsapp_contact(text, text)', 'EXECUTE'),
  'authenticated no ejecuta el RPC');
SELECT ok(has_function_privilege('service_role', 'public.upsert_whatsapp_contact(text, text)', 'EXECUTE'),
  'service_role ejecuta el RPC');

-- Resolucion lead/cliente por el webhook
SET LOCAL ROLE service_role;
SELECT results_eq($$SELECT * FROM public.upsert_whatsapp_contact('50769870001', '  Ana  ')$$,
  $$VALUES ('50769870001'::text, 'c6000000-0000-4000-8000-000000000001'::text, 'cliente'::text)$$,
  'un unico tercero activo vincula al contacto como cliente');
SELECT results_eq($$SELECT * FROM public.upsert_whatsapp_contact('50769870002', NULL)$$,
  $$VALUES ('50769870002'::text, NULL::text, 'lead'::text)$$,
  'varios terceros con el mismo numero dejan un lead sin vinculo');
SELECT results_eq($$SELECT * FROM public.upsert_whatsapp_contact('50769870004', NULL)$$,
  $$VALUES ('50769870004'::text, NULL::text, 'lead'::text)$$,
  'un tercero inactivo no vincula');
SELECT results_eq($$SELECT * FROM public.upsert_whatsapp_contact('50769879999', 'Nuevo')$$,
  $$VALUES ('50769879999'::text, NULL::text, 'lead'::text)$$,
  'un numero desconocido es lead');
SELECT throws_ok($$SELECT * FROM public.upsert_whatsapp_contact('', NULL)$$, 'P0001', 'invalid wa_id',
  'rechaza un wa_id vacio');
RESET ROLE;

SELECT is((SELECT nombre_perfil FROM public.whatsapp_contacts WHERE wa_id = '50769870001'), 'Ana',
  'el nombre de perfil se guarda recortado');

-- Una nueva entrega refresca last_seen_at, conserva el nombre y respeta el bloqueo.
UPDATE public.whatsapp_contacts
SET last_seen_at = now() - interval '1 day', estado = 'bloqueado'
WHERE wa_id = '50769870001';
SET LOCAL ROLE service_role;
SELECT results_eq($$SELECT * FROM public.upsert_whatsapp_contact('50769870001', '   ')$$,
  $$VALUES ('50769870001'::text, 'c6000000-0000-4000-8000-000000000001'::text, 'bloqueado'::text)$$,
  'un contacto bloqueado sigue bloqueado');
RESET ROLE;
SELECT is((SELECT last_seen_at FROM public.whatsapp_contacts WHERE wa_id = '50769870001'), now(),
  'last_seen_at se actualiza');
SELECT is((SELECT nombre_perfil FROM public.whatsapp_contacts WHERE wa_id = '50769870001'), 'Ana',
  'un nombre vacio no borra el anterior');

-- Si el duplicado se limpia, el lead pasa a cliente en la siguiente entrega.
UPDATE public.terceros SET active = false WHERE id = 'c6000000-0000-4000-8000-000000000003';
SET LOCAL ROLE service_role;
SELECT results_eq($$SELECT * FROM public.upsert_whatsapp_contact('50769870002', NULL)$$,
  $$VALUES ('50769870002'::text, 'c6000000-0000-4000-8000-000000000002'::text, 'cliente'::text)$$,
  'al quedar un solo tercero activo el lead se vincula');
RESET ROLE;

-- Lectura: solo administradores activos
SELECT set_config('request.jwt.claims', '{"sub":"62222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.whatsapp_contacts), 0::bigint, 'un operador no lee contactos');
SELECT throws_ok($$SELECT * FROM public.upsert_whatsapp_contact('50769870001', NULL)$$, '42501', NULL,
  'un usuario autenticado no registra contactos');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM public.whatsapp_contacts WHERE wa_id LIKE '5076987%') = 4, 'el administrador lee contactos');
SELECT throws_ok($$INSERT INTO public.whatsapp_contacts (wa_id) VALUES ('1')$$, '42501', NULL,
  'un administrador no inserta contactos directo');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT count(*) FROM public.whatsapp_contacts$$, '42501', NULL, 'anon no consulta contactos');
RESET ROLE;

-- Auditoria de seguridad
SELECT is((public.run_security_audit_validations() ->> 'rls_disabled_app_tables')::int, 0, 'todas las tablas tienen RLS');
SELECT is((public.run_security_audit_validations() ->> 'unapproved_security_definer_executable_by_authenticated')::int, 0,
  'ningun SECURITY DEFINER no aprobado es ejecutable por authenticated');

SELECT * FROM finish();
ROLLBACK;
