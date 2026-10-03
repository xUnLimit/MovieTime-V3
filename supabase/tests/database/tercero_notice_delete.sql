BEGIN;
SELECT plan(6);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000000', '61111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'notice-delete@example.test', '', now());
UPDATE public.usuarios SET role = 'admin' WHERE id = '61111111-1111-4111-8111-111111111111';
INSERT INTO public.terceros (id, nombre, apellido, tipo, telefono)
VALUES ('62222222-2222-4222-8222-222222222222', 'Fixture', 'Aviso', 'cliente', '60000001');
INSERT INTO public.whatsapp_notices (id, dedupe_key, tipo, tercero_id, wa_id, channel, origin, idempotency_key)
VALUES ('63333333-3333-4333-8333-333333333333', 'fixture-delete-notice', 'dia_pago',
  '62222222-2222-4222-8222-222222222222', '50760000001', 'text', 'manual',
  '64444444-4444-4444-8444-444444444444');

SELECT is((SELECT count(*) FROM public.whatsapp_notices WHERE id = '63333333-3333-4333-8333-333333333333'),
  1::bigint, 'el cliente tiene un aviso antes de borrarlo');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.whatsapp_notices'::regclass),
  'los avisos conservan RLS');
SELECT ok(NOT has_table_privilege('authenticated', 'public.whatsapp_notices', 'DELETE'),
  'no se otorga borrado directo de avisos al usuario');

SELECT set_config('request.jwt.claims', '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$DELETE FROM public.terceros WHERE id = '62222222-2222-4222-8222-222222222222'$$,
  'un administrador puede borrar un cliente que tiene avisos');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.terceros WHERE id = '62222222-2222-4222-8222-222222222222'),
  0::bigint, 'el cliente desaparece');
SELECT is((SELECT count(*) FROM public.whatsapp_notices WHERE id = '63333333-3333-4333-8333-333333333333'),
  0::bigint, 'el aviso desaparece en la misma transaccion');
SELECT * FROM finish();
ROLLBACK;
