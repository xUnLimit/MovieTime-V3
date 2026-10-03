-- Local pgTAP only. Uses two real sessions, not a sequential imitation.
-- dblink must be available and local postgres socket authentication enabled.
-- app.catalog_test_dsn may override the local DSN in the test harness.
BEGIN;
CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;
SELECT no_plan();
SELECT extensions.dblink_connect('catalog_a', coalesce(nullif(current_setting('app.catalog_test_dsn', true), ''), 'host=' || coalesce(host(inet_server_addr()), '127.0.0.1') || ' port=5432 user=postgres password=postgres dbname=' || current_database()));
SELECT extensions.dblink_connect('catalog_b', coalesce(nullif(current_setting('app.catalog_test_dsn', true), ''), 'host=' || coalesce(host(inet_server_addr()), '127.0.0.1') || ' port=5432 user=postgres password=postgres dbname=' || current_database()));

-- Commit synthetic fixtures via session A so both sessions see them. Clean up
-- via A at the end, since the outer pgTAP rollback cannot remove remote writes.
SELECT extensions.dblink_exec('catalog_a', $$
  INSERT INTO public.categorias(id,nombre,tipo) VALUES ('81111111-1111-4111-8111-111111111111','Concurrent fixture','cliente');
  INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES ('82222222-2222-4222-8222-222222222222','81111111-1111-4111-8111-111111111111','Standard');
  INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
    VALUES ('83333333-3333-4333-8333-333333333333','81111111-1111-4111-8111-111111111111','82222222-2222-4222-8222-222222222222','Concurrent fixture','concurrent@example.test','synthetic',1);
$$);
SELECT extensions.dblink_exec('catalog_a', 'BEGIN');
SELECT * FROM extensions.dblink('catalog_a', $$SELECT set_config('request.jwt.claims','{"role":"service_role"}',true)$$) AS t(value text);
SELECT is((SELECT n FROM extensions.dblink('catalog_a', $$SELECT count(*) FROM public.reservar_perfil('83333333-3333-4333-8333-333333333333','first')$$) AS t(n bigint)), 1::bigint, 'first transaction holds only profile');
SELECT extensions.dblink_exec('catalog_b', 'BEGIN');
SELECT * FROM extensions.dblink('catalog_b', $$SELECT set_config('request.jwt.claims','{"role":"service_role"}',true)$$) AS t(value text);
SELECT extensions.dblink_send_query('catalog_b', $$SELECT count(*) FROM public.reservar_perfil('83333333-3333-4333-8333-333333333333','second')$$);
SELECT is(extensions.dblink_is_busy('catalog_b'), 1, 'second reservation overlaps locked transaction');
SELECT extensions.dblink_exec('catalog_a', 'COMMIT');
SELECT is((SELECT n FROM extensions.dblink_get_result('catalog_b') AS t(n bigint)), 0::bigint, 'concurrent contender cannot double hold capacity');
-- Drain the terminal empty result before using the connection again.
SELECT * FROM extensions.dblink_get_result('catalog_b') AS t(n bigint);
SELECT extensions.dblink_exec('catalog_b', 'COMMIT');
SELECT is((SELECT count(*) FROM public.reservas_perfil WHERE servicio_id = '83333333-3333-4333-8333-333333333333' AND cerrada_at IS NULL), 1::bigint, 'exactly one open hold committed');

-- Concurrent retries must preserve the same active interest and FIFO timestamp.
SELECT extensions.dblink_exec('catalog_a', 'BEGIN');
SELECT * FROM extensions.dblink('catalog_a', $$SELECT set_config('request.jwt.claims','{"role":"service_role"}',true)$$) AS t(value text);
SELECT * FROM extensions.dblink('catalog_a', $$SELECT public.registrar_interes('50760000999','81111111-1111-4111-8111-111111111111')$$) AS t(id uuid);
SELECT extensions.dblink_exec('catalog_b', 'BEGIN');
SELECT * FROM extensions.dblink('catalog_b', $$SELECT set_config('request.jwt.claims','{"role":"service_role"}',true)$$) AS t(value text);
SELECT extensions.dblink_send_query('catalog_b', $$SELECT public.registrar_interes('50760000999','81111111-1111-4111-8111-111111111111')$$);
SELECT extensions.dblink_exec('catalog_a', 'COMMIT');
SELECT * FROM extensions.dblink_get_result('catalog_b') AS t(id uuid);
SELECT * FROM extensions.dblink_get_result('catalog_b') AS t(id uuid);
SELECT extensions.dblink_exec('catalog_b', 'COMMIT');
SELECT is((SELECT count(*) FROM public.intereses WHERE categoria_id = '81111111-1111-4111-8111-111111111111'), 1::bigint, 'concurrent interest retries converge');

SELECT extensions.dblink_exec('catalog_a', 'BEGIN');
SELECT * FROM extensions.dblink('catalog_a', $$SELECT set_config('request.jwt.claims','{"role":"service_role"}',true)$$) AS t(value text);
SELECT is((SELECT n FROM extensions.dblink('catalog_a', $$SELECT count(*) FROM public.siguiente_interesado('81111111-1111-4111-8111-111111111111')$$) AS t(n bigint)), 1::bigint, 'first FIFO claim succeeds');
SELECT extensions.dblink_exec('catalog_b', 'BEGIN');
SELECT * FROM extensions.dblink('catalog_b', $$SELECT set_config('request.jwt.claims','{"role":"service_role"}',true)$$) AS t(value text);
SELECT extensions.dblink_send_query('catalog_b', $$SELECT count(*) FROM public.siguiente_interesado('81111111-1111-4111-8111-111111111111')$$);
SELECT extensions.dblink_exec('catalog_a', 'COMMIT');
SELECT is((SELECT n FROM extensions.dblink_get_result('catalog_b') AS t(n bigint)), 0::bigint, 'concurrent FIFO claim never claims same customer twice');
SELECT * FROM extensions.dblink_get_result('catalog_b') AS t(n bigint);
SELECT extensions.dblink_exec('catalog_b', 'COMMIT');

SELECT extensions.dblink_exec('catalog_a', $$
 DELETE FROM public.intereses WHERE categoria_id = '81111111-1111-4111-8111-111111111111';
 DELETE FROM public.reservas_perfil WHERE servicio_id = '83333333-3333-4333-8333-333333333333';
 DELETE FROM public.servicios WHERE id = '83333333-3333-4333-8333-333333333333';
 DELETE FROM public.planes_tipos WHERE id = '82222222-2222-4222-8222-222222222222';
 DELETE FROM public.categorias WHERE id = '81111111-1111-4111-8111-111111111111';
$$);
SELECT extensions.dblink_disconnect('catalog_a');
SELECT extensions.dblink_disconnect('catalog_b');
SELECT * FROM finish();
ROLLBACK;
