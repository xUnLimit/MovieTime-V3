BEGIN;
SELECT plan(8);

-- Reproduce la deriva real de produccion sin persistir cambios de esquema:
-- PK global de dos columnas, funciones restauradas con ON CONFLICT de tres.
ALTER TABLE public.rpc_idempotency_keys DROP CONSTRAINT rpc_idempotency_keys_pkey;
ALTER TABLE public.rpc_idempotency_keys ADD CONSTRAINT rpc_idempotency_keys_pkey
  PRIMARY KEY (idempotency_key, rpc_name);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000000', '71111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'rpc-drift@example.test', '', now());
UPDATE public.usuarios SET role = 'admin' WHERE id = '71111111-1111-4111-8111-111111111111';
INSERT INTO public.categorias (id, nombre, tipo)
VALUES ('72222222-2222-4222-8222-222222222222', 'Fixture RPC', 'cliente');
INSERT INTO public.servicios (id, categoria_id, nombre, correo, contrasena, perfiles_disponibles)
VALUES ('73333333-3333-4333-8333-333333333333', '72222222-2222-4222-8222-222222222222',
  'Fixture RPC', 'rpc@example.test', 'fixture-only', 10);
INSERT INTO public.ventas (id, servicio_id, categoria_id)
VALUES ('74444444-4444-4444-8444-444444444444', '73333333-3333-4333-8333-333333333333',
  '72222222-2222-4222-8222-222222222222');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rpc_idempotency_keys'::regclass),
  'las claves conservan RLS');
SELECT ok(EXISTS (SELECT 1 FROM pg_index i
  WHERE i.indrelid = 'public.rpc_idempotency_keys'::regclass AND i.indisunique AND i.indisvalid
    AND i.indpred IS NULL AND i.indexprs IS NULL
    AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
      FROM unnest(i.indkey) WITH ORDINALITY k(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum)
      = ARRAY['created_by', 'rpc_name', 'idempotency_key']),
  'existe un indice compatible con el ON CONFLICT restaurado');

CREATE FUNCTION pg_temp.renew_fixture() RETURNS text LANGUAGE sql AS $$
  SELECT public.create_venta_payment(
    p_venta_id => '74444444-4444-4444-8444-444444444444',
    p_fecha_inicio => '2026-10-01', p_fecha_fin => '2026-11-01', p_ciclo_pago => 'mensual',
    p_precio_original => 10, p_descuento => 0, p_total_original => 10,
    p_moneda_original => 'USD', p_total_usd => 10, p_exchange_rate => 1,
    p_metodo_pago_id => NULL, p_metodo_pago_nombre_snapshot => 'Pendiente de pago',
    p_idempotency_key => '75555555-5555-4555-8555-555555555555');
$$;

SELECT set_config('request.jwt.claims', '{"sub":"71111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT pg_temp.renew_fixture()$$, 'la RPC de pago funciona con la PK historica de produccion');
SELECT lives_ok($$SELECT pg_temp.renew_fixture()$$, 'reintentar la misma intencion no falla');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.pagos_venta WHERE venta_id = '74444444-4444-4444-8444-444444444444'),
  1::bigint, 'se registra exactamente un pago');
SELECT is((SELECT count(*) FROM public.venta_periodos WHERE venta_id = '74444444-4444-4444-8444-444444444444'),
  1::bigint, 'se registra exactamente un periodo');
SELECT is((SELECT count(*) FROM public.rpc_idempotency_keys
  WHERE idempotency_key = '75555555-5555-4555-8555-555555555555'), 1::bigint, 'se conserva una sola clave de reintento');
SELECT is((SELECT result_id FROM public.rpc_idempotency_keys
  WHERE idempotency_key = '75555555-5555-4555-8555-555555555555'),
  (SELECT id FROM public.pagos_venta WHERE venta_id = '74444444-4444-4444-8444-444444444444'),
  'la clave apunta al pago confirmado');
SELECT * FROM finish();
ROLLBACK;
