BEGIN;
SELECT plan(57);

-- Los perfiles nacen por handle_new_auth_user, igual que en Auth local.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'wp-a-admin@example.test', '', now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'wp-a-operator@example.test', '', now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'wp-a-inactive@example.test', '', now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'wp-a-admin-inactive@example.test', '', now());

UPDATE public.usuarios SET role = 'admin'
WHERE id IN ('11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444');
UPDATE public.usuarios SET active = false
WHERE id IN ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444');

INSERT INTO public.currencies (code) VALUES ('WPA');
INSERT INTO public.tipos_gasto (id, nombre) VALUES ('wp-a-expense-type', 'Prueba WP-A');
INSERT INTO public.categorias (id, nombre, tipo) VALUES ('wp-a-cat', 'Prueba WP-A', 'cliente');
INSERT INTO public.servicios (id, categoria_id, nombre, correo, contrasena, perfiles_disponibles)
VALUES ('wp-a-service', 'wp-a-cat', 'Prueba WP-A', 'local@example.test', 'fixture-local', 5);
INSERT INTO public.terceros (id, nombre, apellido, tipo, telefono)
VALUES ('wp-a-third', 'Prueba', 'Local', 'cliente', '00000000');
INSERT INTO public.ventas (id, cliente_id, servicio_id, categoria_id)
VALUES ('wp-a-sale', 'wp-a-third', 'wp-a-service', 'wp-a-cat');
INSERT INTO public.venta_periodos
  (id, venta_id, numero_periodo, tipo, fecha_inicio, fecha_fin, ciclo_pago,
   precio_original, total_original, moneda_original, total_usd)
VALUES ('wp-a-period', 'wp-a-sale', 1, 'inicial', current_date, current_date + 30,
        'mensual', 10, 10, 'WPA', 10);
INSERT INTO public.pagos_venta
  (id, venta_periodo_id, venta_id, monto_original, moneda_original, monto_usd)
VALUES ('wp-a-payment', 'wp-a-period', 'wp-a-sale', 10, 'WPA', 10);

CREATE FUNCTION pg_temp.anon_sin_datos() RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE t record; n bigint;
BEGIN
  FOR t IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
    BEGIN
      EXECUTE pg_catalog.format('SELECT count(*) FROM public.%I', t.tablename) INTO n;
      IF n <> 0 THEN RETURN false; END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  RETURN true;
END;
$$;

CREATE FUNCTION pg_temp.anon_sin_escritura() RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE t record; action text; policy_command text;
BEGIN
  FOR t IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
    FOREACH action IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      policy_command := CASE action WHEN 'INSERT' THEN 'a'
        WHEN 'UPDATE' THEN 'w' ELSE 'd' END;
      IF pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', t.tablename), action)
         AND EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy AS p
           WHERE p.polrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', t.tablename))
             AND p.polcmd IN ('*', policy_command)
             AND (0::oid = ANY(p.polroles) OR 'anon'::pg_catalog.regrole::oid = ANY(p.polroles))
         ) THEN
        RETURN false;
      END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END;
$$;

CREATE FUNCTION pg_temp.mutacion_denegada(p_sql text, p_insert boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE n bigint;
BEGIN
  IF p_insert THEN
    EXECUTE p_sql;
    RETURN false;
  END IF;
  EXECUTE pg_catalog.format('WITH changed AS (%s RETURNING 1) SELECT count(*) FROM changed', p_sql) INTO n;
  RETURN n = 0;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END;
$$;

CREATE FUNCTION pg_temp.anon_no_autenticado() RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN NOT public.is_authenticated();
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END;
$$;

SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE anon;
SELECT ok(pg_temp.anon_sin_datos(), 'anon no lee ninguna tabla public');
SELECT ok(pg_temp.anon_sin_escritura(), 'anon no tiene via de escritura en ninguna tabla public');
-- Para anon el helper devuelve false (no hay auth.uid()) o, si se le revocara EXECUTE, deniega: ambas cosas son seguras.
SELECT ok(pg_temp.anon_no_autenticado(), 'anon nunca queda autenticado para RLS');
SELECT throws_ok(
  $$INSERT INTO public.terceros (id, nombre, apellido, tipo, telefono)
    VALUES ('wp-a-anon', 'Prueba', 'Anon', 'cliente', '0')$$,
  '42501', NULL, 'anon no escribe terceros');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT ok(public.is_authenticated(), 'operador activo esta autenticado');
SELECT is((SELECT count(*) FROM public.ventas WHERE id = 'wp-a-sale'), 1::bigint, 'operador lee ventas');
SELECT is((SELECT count(*) FROM public.terceros WHERE id = 'wp-a-third'), 1::bigint, 'operador lee terceros');
SELECT is((SELECT count(*) FROM public.pagos_venta WHERE id = 'wp-a-payment'), 1::bigint, 'operador lee pagos');
INSERT INTO public.terceros (id, nombre, apellido, tipo, telefono)
VALUES ('wp-a-operator-third', 'Operador', 'Local', 'cliente', '00000001');
SELECT pass('operador inserta terceros');
UPDATE public.terceros SET notas = 'prueba' WHERE id = 'wp-a-operator-third';
SELECT pass('operador actualiza terceros');
INSERT INTO public.ventas (id, cliente_id, servicio_id, categoria_id)
VALUES ('wp-a-operator-sale', 'wp-a-operator-third', 'wp-a-service', 'wp-a-cat');
SELECT pass('operador inserta ventas');
UPDATE public.ventas SET notas = 'prueba' WHERE id = 'wp-a-operator-sale';
SELECT pass('operador actualiza ventas');
INSERT INTO public.pagos_venta
  (id, venta_periodo_id, venta_id, monto_original, moneda_original, monto_usd)
VALUES ('wp-a-operator-payment', 'wp-a-period', 'wp-a-sale', 1, 'WPA', 1);
SELECT pass('operador inserta pagos');
UPDATE public.pagos_venta SET notas = 'prueba' WHERE id = 'wp-a-operator-payment';
SELECT pass('operador actualiza pagos');
SELECT is((SELECT count(*) FROM public.gastos), 0::bigint, 'operador no lee gastos');
SELECT is((SELECT count(*) FROM public.whatsapp_inbound_messages), 0::bigint, 'operador no lee WhatsApp');
SELECT ok(pg_temp.mutacion_denegada($$INSERT INTO public.gastos
  (id, tipo_gasto_id, fecha, monto_original, moneda_original, monto_usd)
  VALUES ('wp-a-operator-expense', 'wp-a-expense-type', current_date, 1, 'WPA', 1)$$, true), 'operador no escribe gastos');
SELECT ok(pg_temp.mutacion_denegada($$INSERT INTO public.config (id) VALUES ('wp-a-operator-config')$$, true), 'operador no escribe config');
SELECT ok(pg_temp.mutacion_denegada($$INSERT INTO public.whatsapp_inbound_messages
  (wa_message_id, phone_number_id, from_wa_id, message_type, sent_at)
  VALUES ('wp-a-operator-message', 'test', 'test', 'text', now())$$, true), 'operador no escribe WhatsApp');
SELECT is((SELECT count(*) FROM public.ventas v WHERE v.id = 'wp-a-sale' AND (SELECT private.auth_role()) = 'admin'), 0::bigint, 'operador no puede eliminar ventas');
SELECT is((WITH changed AS (DELETE FROM public.ventas WHERE id = 'wp-a-sale' RETURNING 1)
  SELECT count(*) FROM changed), 0::bigint, 'operador no elimina ventas');
SELECT ok(pg_temp.mutacion_denegada($$DELETE FROM public.pagos_venta WHERE id = 'wp-a-payment'$$, false), 'operador no elimina pagos');
SELECT ok(pg_temp.mutacion_denegada($$DELETE FROM public.terceros WHERE id = 'wp-a-third'$$, false), 'operador no elimina terceros');
SELECT ok(pg_temp.mutacion_denegada($$DELETE FROM public.servicios WHERE id = 'wp-a-service'$$, false), 'operador no elimina servicios');
SELECT throws_ok($$UPDATE public.usuarios SET role = 'admin' WHERE id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', NULL, 'operador no cambia su role');
SELECT throws_ok($$UPDATE public.usuarios SET active = false WHERE id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', NULL, 'operador no cambia su active');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.is_authenticated(), 'operador inactivo no esta autenticado para RLS');
SELECT is(private.auth_role(), NULL::text, 'rol de inactivo es NULL');
SELECT is((SELECT count(*) FROM public.ventas), 0::bigint, 'inactivo no lee ventas');
SELECT is((SELECT count(*) FROM public.pagos_venta), 0::bigint, 'inactivo no lee pagos');
SELECT is((SELECT count(*) FROM public.terceros), 0::bigint, 'inactivo no lee terceros');
SELECT is((SELECT count(*) FROM public.servicios), 0::bigint, 'inactivo no lee servicios');
SELECT is((SELECT count(*) FROM public.config), 0::bigint, 'inactivo no lee config');
SELECT is((SELECT count(*) FROM public.whatsapp_inbound_messages), 0::bigint, 'inactivo no lee WhatsApp');
SELECT throws_ok($$INSERT INTO public.terceros (id, nombre, apellido, tipo, telefono)
  VALUES ('wp-a-inactive-third', 'Inactivo', 'Local', 'cliente', '0')$$,
  '42501', NULL, 'inactivo no inserta terceros');
SELECT ok(pg_temp.mutacion_denegada($$INSERT INTO public.ventas (id, cliente_id, servicio_id, categoria_id)
  VALUES ('wp-a-inactive-sale', 'wp-a-third', 'wp-a-service', 'wp-a-cat')$$, true), 'inactivo no inserta ventas');
SELECT ok(pg_temp.mutacion_denegada($$INSERT INTO public.pagos_venta
  (id, venta_periodo_id, venta_id, monto_original, moneda_original, monto_usd)
  VALUES ('wp-a-inactive-payment', 'wp-a-period', 'wp-a-sale', 1, 'WPA', 1)$$, true), 'inactivo no inserta pagos');
SELECT ok(pg_temp.mutacion_denegada($$INSERT INTO public.servicios
  (id, categoria_id, nombre, correo, contrasena)
  VALUES ('wp-a-inactive-service', 'wp-a-cat', 'Prueba', 'none@example.test', 'local')$$, true), 'inactivo no inserta servicios');
SELECT ok(pg_temp.mutacion_denegada($$INSERT INTO public.config (id) VALUES ('wp-a-inactive')$$, true), 'inactivo no inserta config');
SELECT ok(pg_temp.mutacion_denegada($$INSERT INTO public.whatsapp_inbound_messages
  (wa_message_id, phone_number_id, from_wa_id, message_type, sent_at)
  VALUES ('wp-a-inactive-message', 'test', 'test', 'text', now())$$, true), 'inactivo no inserta WhatsApp');
SELECT ok(pg_temp.mutacion_denegada($$UPDATE public.pagos_venta SET notas = 'prohibido' WHERE id = 'wp-a-payment'$$, false), 'inactivo no actualiza pagos');
SELECT ok(pg_temp.mutacion_denegada($$UPDATE public.terceros SET notas = 'prohibido' WHERE id = 'wp-a-third'$$, false), 'inactivo no actualiza terceros');
SELECT ok(pg_temp.mutacion_denegada($$UPDATE public.servicios SET notas = 'prohibido' WHERE id = 'wp-a-service'$$, false), 'inactivo no actualiza servicios');
SELECT ok(pg_temp.mutacion_denegada($$UPDATE public.config SET hora_envio = 10 WHERE id = 'global'$$, false), 'inactivo no actualiza config');
SELECT ok(pg_temp.mutacion_denegada($$UPDATE public.whatsapp_inbound_messages SET text_body = 'prohibido'$$, false), 'inactivo no actualiza WhatsApp');
SELECT ok(pg_temp.mutacion_denegada($$DELETE FROM public.pagos_venta WHERE id = 'wp-a-payment'$$, false), 'inactivo no elimina pagos');
SELECT ok(pg_temp.mutacion_denegada($$DELETE FROM public.terceros WHERE id = 'wp-a-third'$$, false), 'inactivo no elimina terceros');
SELECT ok(pg_temp.mutacion_denegada($$DELETE FROM public.servicios WHERE id = 'wp-a-service'$$, false), 'inactivo no elimina servicios');
SELECT ok(pg_temp.mutacion_denegada($$DELETE FROM public.config WHERE id = 'global'$$, false), 'inactivo no elimina config');
SELECT ok(pg_temp.mutacion_denegada($$DELETE FROM public.whatsapp_inbound_messages WHERE wa_message_id = 'wp-a-inactive-message'$$, false), 'inactivo no elimina WhatsApp');
SELECT is((WITH changed AS (UPDATE public.ventas SET notas = 'prohibido' WHERE id = 'wp-a-sale' RETURNING 1)
  SELECT count(*) FROM changed), 0::bigint, 'inactivo no actualiza ventas');
SELECT is((WITH changed AS (DELETE FROM public.ventas WHERE id = 'wp-a-sale' RETURNING 1)
  SELECT count(*) FROM changed), 0::bigint, 'inactivo no elimina ventas');
SELECT throws_ok($$UPDATE public.usuarios SET active = true WHERE id = '33333333-3333-4333-8333-333333333333'$$,
  '42501', NULL, 'inactivo no se reactiva');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(private.auth_role(), NULL::text, 'admin inactivo pierde el rol');
SELECT throws_ok($$SELECT public.dismiss_yappy_payment('55555555-5555-4555-8555-555555555555', 'prueba')$$,
  'P0001', 'forbidden', 'RPC de admin rechaza admin inactivo');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(private.auth_role(), 'admin'::text, 'admin activo conserva su rol');
UPDATE public.usuarios SET active = true WHERE id = '33333333-3333-4333-8333-333333333333';
SELECT pass('admin activo reactiva a otro usuario');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
