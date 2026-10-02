BEGIN;
SELECT plan(48);

-- Los perfiles nacen por handle_new_auth_user, igual que en Auth local.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '61111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'outbox-admin@example.test', '', now()),
  ('00000000-0000-0000-0000-000000000000', '62222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'outbox-operator@example.test', '', now());
UPDATE public.usuarios SET role = 'admin' WHERE id = '61111111-1111-4111-8111-111111111111';

-- Tabla, RLS y privilegios
SELECT has_table('public', 'domain_events', 'existe la tabla de eventos');
SELECT ok((SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = 'public.domain_events'::regclass), 'RLS activa');
SELECT is((SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'domain_events'),
  1::bigint, 'solo existe la politica de lectura de administradores');
SELECT ok(NOT has_table_privilege('anon', 'public.domain_events', 'SELECT'), 'anon no lee');
SELECT ok(NOT has_table_privilege('anon', 'public.domain_events', 'INSERT'), 'anon no inserta');
SELECT ok(NOT has_table_privilege('authenticated', 'public.domain_events', 'INSERT'), 'authenticated no inserta');
SELECT ok(NOT has_table_privilege('authenticated', 'public.domain_events', 'UPDATE'), 'authenticated no actualiza');
SELECT ok(NOT has_table_privilege('authenticated', 'public.domain_events', 'DELETE'), 'authenticated no borra');
SELECT ok(NOT has_function_privilege('anon', 'public.emit_domain_event(text, text, text, jsonb)', 'EXECUTE'), 'anon no emite');
SELECT ok(NOT has_function_privilege('authenticated', 'public.emit_domain_event(text, text, text, jsonb)', 'EXECUTE'), 'authenticated no emite');
SELECT ok(NOT has_function_privilege('service_role', 'public.emit_domain_event(text, text, text, jsonb)', 'EXECUTE'), 'service_role no emite');
SELECT ok(NOT has_function_privilege('anon', 'public.claim_domain_events(integer, integer)', 'EXECUTE'), 'anon no reclama');
SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_domain_events(integer, integer)', 'EXECUTE'), 'authenticated no reclama');
SELECT ok(NOT has_function_privilege('authenticated', 'public.finish_domain_event(uuid, text)', 'EXECUTE'), 'authenticated no finaliza');
SELECT ok(has_function_privilege('service_role', 'public.claim_domain_events(integer, integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.finish_domain_event(uuid, text)', 'EXECUTE'), 'service_role ejecuta claim y finish');

-- Restricciones del payload
SELECT throws_ok($$SELECT public.emit_domain_event('venta.creada', 'venta', 'x', '[]'::jsonb)$$, '23514', NULL, 'el payload debe ser un objeto');
SELECT throws_ok($$SELECT public.emit_domain_event('venta.creada', 'venta', 'x', jsonb_build_object('k', repeat('a', 9000)))$$,
  '23514', NULL, 'el payload tiene tope de tamano');
SELECT throws_ok($$SELECT public.emit_domain_event('Tipo Invalido', 'venta', 'x', '{}'::jsonb)$$, '23514', NULL, 'el tipo respeta el formato');

-- Fixtures sinteticos
INSERT INTO public.categorias (id, nombre, tipo) VALUES ('e3000000-0000-4000-8000-000000000001', 'Categoria Outbox', 'cliente');
INSERT INTO public.servicios (id, categoria_id, nombre, correo, contrasena)
VALUES ('e3000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000001', 'Servicio 1', 'cuenta1@example.test', 'clave-original-1'),
       ('e3000000-0000-4000-8000-000000000003', 'e3000000-0000-4000-8000-000000000001', 'Servicio 2', 'cuenta2@example.test', 'clave-original-2');
INSERT INTO public.terceros (id, nombre, apellido, telefono, tipo)
VALUES ('e3000000-0000-4000-8000-000000000004', 'Cliente', 'Outbox', '50760007788', 'cliente');

-- Triggers
INSERT INTO public.ventas (id, categoria_id, servicio_id, cliente_id, estado)
VALUES ('e3000000-0000-4000-8000-000000000005', 'e3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000004', 'activo');
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'venta.creada' AND aggregate_id = 'e3000000-0000-4000-8000-000000000005'), 1::bigint,
  'insertar una venta emite exactamente un venta.creada');
SELECT is((SELECT payload ->> 'servicio_id' FROM public.domain_events WHERE type = 'venta.creada' AND aggregate_id = 'e3000000-0000-4000-8000-000000000005'),
  'e3000000-0000-4000-8000-000000000002', 'venta.creada lleva el servicio');

UPDATE public.ventas SET notas = 'nota irrelevante' WHERE id = 'e3000000-0000-4000-8000-000000000005';
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'venta.transferida'), 0::bigint,
  'cambiar otras columnas no emite venta.transferida');
UPDATE public.ventas SET servicio_id = 'e3000000-0000-4000-8000-000000000003' WHERE id = 'e3000000-0000-4000-8000-000000000005';
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'venta.transferida' AND aggregate_id = 'e3000000-0000-4000-8000-000000000005'), 1::bigint,
  'cambiar servicio_id emite exactamente un venta.transferida');
SELECT is((SELECT payload ->> 'to_servicio_id' FROM public.domain_events WHERE type = 'venta.transferida'), 'e3000000-0000-4000-8000-000000000003',
  'venta.transferida lleva el servicio destino');

UPDATE public.servicios SET nombre = 'Otro nombre' WHERE id = 'e3000000-0000-4000-8000-000000000002';
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'servicio.credenciales_cambiadas'), 0::bigint,
  'cambiar el nombre no emite credenciales_cambiadas');
UPDATE public.servicios SET contrasena = 'clave-nueva-secreta' WHERE id = 'e3000000-0000-4000-8000-000000000002';
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'servicio.credenciales_cambiadas' AND aggregate_id = 'e3000000-0000-4000-8000-000000000002'), 1::bigint,
  'cambiar la contrasena emite exactamente un evento');
SELECT ok((SELECT payload ->> 'contrasena_cambiada' = 'true' AND payload ->> 'correo_cambiado' = 'false'
  FROM public.domain_events WHERE type = 'servicio.credenciales_cambiadas'), 'el payload solo trae banderas');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.domain_events WHERE payload::text ~* '(clave-|cuenta[0-9]@)'),
  'ningun payload contiene contrasenas ni correos');

-- RPC redefinidos, ejecutados como administrador autenticado
SELECT set_config('request.jwt.claims',
  '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT ok(public.create_venta_payment(
  'e3000000-0000-4000-8000-000000000005', current_date, current_date + 30, 'mensual', 10, 0, 10, 'USD', 10, 1, '', 'Efectivo', now(), NULL, NULL, NULL, NULL,
  NULL, '71111111-1111-4111-8111-111111111111') IS NOT NULL, 'create_venta_payment sigue funcionando');
SELECT is(public.create_venta_payment(
  'e3000000-0000-4000-8000-000000000005', current_date, current_date + 30, 'mensual', 10, 0, 10, 'USD', 10, 1, '', 'Efectivo', now(), NULL, NULL, NULL, NULL,
  NULL, '71111111-1111-4111-8111-111111111111'),
  (SELECT result_id FROM public.rpc_idempotency_keys WHERE idempotency_key = '71111111-1111-4111-8111-111111111111'),
  'la repeticion idempotente devuelve el mismo pago');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'venta.pago_registrado' AND aggregate_id = 'e3000000-0000-4000-8000-000000000005'), 1::bigint,
  'create_venta_payment emite exactamente un evento y la repeticion idempotente no emite otro');

SET LOCAL ROLE authenticated;
SELECT ok(public.create_venta_refund(
  'e3000000-0000-4000-8000-000000000005', 4, 'USD', 4, 1, '', 'Efectivo', 'cuenta destino', now(), 'nota', false, NULL,
  NULL, '72222222-2222-4222-8222-222222222222') IS NOT NULL, 'create_venta_refund sigue funcionando');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'venta.reembolsada' AND aggregate_id = 'e3000000-0000-4000-8000-000000000005'), 1::bigint,
  'create_venta_refund emite exactamente un evento');

-- Yappy: ingest como service_role y resolve como administrador
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT is((SELECT outcome FROM public.ingest_yappy_payment(
  1, 1, 'msg-1', now(), 'Yappy', true, 1, 'OUTBOXCODE1', 10, 'Cliente O.', '7788', now())), 'nuevo',
  'ingest_yappy_payment sigue funcionando');
SELECT is((SELECT outcome FROM public.ingest_yappy_payment(
  1, 2, 'msg-2', now(), 'Yappy', true, 1, 'OUTBOXCODE1', 10, 'Cliente O.', '7788', now())), 'duplicado',
  'un codigo repetido sigue siendo duplicado');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'yappy.pago_detectado'), 1::bigint,
  'ingest emite un evento solo para filas nuevas');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.domain_events WHERE type LIKE 'yappy.%' AND payload::text LIKE '%7788%'),
  'los eventos de Yappy no llevan telefono');

SELECT set_config('request.jwt.claims',
  '{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.resolve_yappy_payment(
  (SELECT id FROM public.yappy_payments WHERE confirmation_code = 'OUTBOXCODE1'), 'e3000000-0000-4000-8000-000000000005', 'nota'), 'registrado',
  'resolve_yappy_payment sigue funcionando');
SELECT is(public.resolve_yappy_payment(
  (SELECT id FROM public.yappy_payments WHERE confirmation_code = 'OUTBOXCODE1'), 'e3000000-0000-4000-8000-000000000005', 'nota'), 'registrado',
  'resolver de nuevo es idempotente');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.domain_events WHERE type = 'yappy.pago_resuelto'), 1::bigint,
  'resolve emite exactamente un evento');

-- Lectura por RLS
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM public.domain_events) > 0, 'el administrador activo lee los eventos');
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"62222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.domain_events), 0::bigint, 'un usuario no administrador no ve eventos');
RESET ROLE;

-- Reclamo
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT ok((SELECT count(*) FROM public.claim_domain_events(100, 60)) > 0, 'claim devuelve los eventos pendientes');
SELECT is((SELECT count(*) FROM public.claim_domain_events(100, 60)), 0::bigint,
  'una segunda llamada no reclama eventos bloqueados (idempotente)');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.domain_events WHERE attempts <> 1), 0::bigint, 'cada evento se reclamo una sola vez');

SET LOCAL ROLE service_role;
SELECT is(public.finish_domain_event((SELECT id FROM public.domain_events ORDER BY occurred_at, id LIMIT 1), 'HANDLER_ERROR'), true,
  'finish con etiqueta libera el evento');
SELECT throws_ok($$SELECT public.finish_domain_event('00000000-0000-0000-0000-000000000000', 'detalle libre')$$,
  'invalid domain event finish', 'finish rechaza etiquetas que no son codigos');
SELECT is(public.finish_domain_event((SELECT id FROM public.domain_events ORDER BY occurred_at, id LIMIT 1), NULL), true,
  'finish sin error marca el evento como procesado');
RESET ROLE;
SELECT ok((SELECT processed_at IS NOT NULL AND last_error IS NULL FROM public.domain_events ORDER BY occurred_at, id LIMIT 1),
  'el evento procesado queda sin error');

SELECT * FROM finish();
ROLLBACK;
