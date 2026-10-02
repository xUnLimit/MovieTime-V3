BEGIN;
SELECT no_plan();

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000000', '71111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'catalog-admin@example.test', '', now()),
 ('00000000-0000-0000-0000-000000000000', '72222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'catalog-operator@example.test', '', now());
UPDATE public.usuarios SET role = 'admin' WHERE id = '71111111-1111-4111-8111-111111111111';
INSERT INTO public.categorias (id, nombre, tipo) VALUES
 ('73333333-3333-4333-8333-333333333333', 'Catalog fixture', 'cliente'),
 ('73444444-4444-4444-8444-444444444444', 'Other fixture', 'cliente');
INSERT INTO public.planes_tipos (id, categoria_id, nombre) VALUES
 ('74444444-4444-4444-8444-444444444444', '73333333-3333-4333-8333-333333333333', 'Standard');
INSERT INTO public.planes (id, categoria_id, plan_tipo_id, nombre, precio, ciclo_pago) VALUES
 ('75555555-5555-4555-8555-555555555555', '73333333-3333-4333-8333-333333333333', '74444444-4444-4444-8444-444444444444', 'Monthly', 5, 'mensual'),
 ('75666666-6666-4666-8666-666666666666', '73333333-3333-4333-8333-333333333333', '74444444-4444-4444-8444-444444444444', 'Annual', 50, 'anual');
INSERT INTO public.servicios (id, categoria_id, plan_tipo_id, nombre, correo, contrasena, perfiles_disponibles) VALUES
 ('76666666-6666-4666-8666-666666666666', '73333333-3333-4333-8333-333333333333', '74444444-4444-4444-8444-444444444444', 'Fixture', 'fixture@example.test', 'synthetic', 4);
INSERT INTO public.ventas (id, servicio_id, categoria_id, perfil_numero) VALUES
 ('77777777-7777-4777-8777-777777777777', '76666666-6666-4666-8666-666666666666', '73333333-3333-4333-8333-333333333333', 2);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

SELECT is((SELECT perfiles_libres FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 3::bigint, 'capacity minus occupied');
SELECT is((SELECT estado FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 'disponible', 'stock above default threshold');
SELECT is((SELECT precio FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 5::numeric, 'current plan price without period history');
SELECT is((SELECT moneda FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 'USD', 'explicit configured currency');
SELECT is((SELECT ciclos::text FROM public.catalogo_disponible() WHERE plan_id = '75666666-6666-4666-8666-666666666666'), '{anual}', 'each cycle keeps its own price');

CREATE TEMP TABLE test_hold AS SELECT * FROM public.reservar_perfil('76666666-6666-4666-8666-666666666666', 'item-first');
SELECT is((SELECT perfil_numero FROM test_hold), 1, 'first free profile avoids active sale');
SELECT is((SELECT expira_at - created_at FROM test_hold), interval '30 minutes', 'default TTL');
SELECT is((SELECT id FROM public.reservar_perfil('76666666-6666-4666-8666-666666666666', 'item-first')), (SELECT id FROM test_hold), 'hold retry is idempotent');
SELECT is((SELECT perfiles_libres FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 2::bigint, 'active hold subtracts stock');
SELECT is((SELECT estado FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 'ultimos', 'threshold includes equality');
SELECT throws_ok($$INSERT INTO public.reservas_perfil(servicio_id, perfil_numero, owner_ref, expira_at)
 VALUES ('76666666-6666-4666-8666-666666666666', 1, 'duplicate', now() + interval '1 hour')$$,
 '23505', NULL, 'partial unique index rejects duplicate open hold');
SELECT throws_ok($$INSERT INTO public.ventas(servicio_id, categoria_id, perfil_numero)
 VALUES ('76666666-6666-4666-8666-666666666666', '73333333-3333-4333-8333-333333333333', 1)$$,
 '23514', 'profile held', 'existing sales cannot steal a held profile');
SELECT is(public.liberar_reserva((SELECT id FROM test_hold), 'wrong-owner'), false, 'release requires owner');
SELECT is(public.liberar_reserva((SELECT id FROM test_hold), 'item-first'), true, 'owner releases');
SELECT is(public.liberar_reserva((SELECT id FROM test_hold), 'item-first'), false, 'release retry is harmless');
INSERT INTO public.reservas_perfil(servicio_id, perfil_numero, owner_ref, created_at, expira_at) VALUES
 ('76666666-6666-4666-8666-666666666666', 1, 'expired', now() - interval '2 hours', now() - interval '1 hour');
SELECT is((SELECT perfiles_libres FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 3::bigint, 'expiry frees stock before cleanup');
SELECT is((SELECT perfil_numero FROM public.reservar_perfil('76666666-6666-4666-8666-666666666666', 'reused')), 1, 'reservation closes expired row before reuse');
SELECT ok((SELECT cerrada_at IS NOT NULL FROM public.reservas_perfil WHERE owner_ref = 'expired'), 'expired row closed');
INSERT INTO public.reservas_perfil(servicio_id, perfil_numero, owner_ref, created_at, expira_at) VALUES
 ('76666666-6666-4666-8666-666666666666', 3, 'cleanup', now() - interval '2 hours', now() - interval '1 hour');
SELECT is(public.expirar_reservas(), 1, 'explicit cleanup counts expired rows');
SELECT is(public.expirar_reservas(), 0, 'cleanup idempotent');

INSERT INTO public.catalogo_config(categoria_id, reserva_ttl_minutos, umbral_stock_bajo, orden) VALUES
 ('73333333-3333-4333-8333-333333333333', 7, 1, 9);
SELECT is((SELECT expira_at - created_at FROM public.reservar_perfil('76666666-6666-4666-8666-666666666666', 'ttl-category')), interval '7 minutes', 'category TTL');
INSERT INTO public.catalogo_config(categoria_id, plan_id, reserva_ttl_minutos, umbral_stock_bajo, orden) VALUES
 ('73333333-3333-4333-8333-333333333333', '75555555-5555-4555-8555-555555555555', 3, 0, 2);
SELECT is((SELECT expira_at - created_at FROM public.reservar_perfil('76666666-6666-4666-8666-666666666666', 'ttl-plan', '75555555-5555-4555-8555-555555555555')), interval '3 minutes', 'plan TTL overrides category');
SELECT is((SELECT count(*) FROM public.reservar_perfil('76666666-6666-4666-8666-666666666666', 'exhausted')), 0::bigint, 'full capacity cannot be held');
SELECT is((SELECT estado FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 'agotado', 'all remaining profiles held');
SELECT is((SELECT orden FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 2, 'plan ordering overrides category');
UPDATE public.catalogo_config SET visible_en_bot = false WHERE plan_id IS NULL;
SELECT is((SELECT count(*) FROM public.catalogo_disponible() WHERE categoria_id = '73333333-3333-4333-8333-333333333333'), 1::bigint, 'explicit plan visibility overrides category');
UPDATE public.catalogo_config SET visible_en_bot = false WHERE plan_id IS NOT NULL;
SELECT is((SELECT count(*) FROM public.catalogo_disponible() WHERE categoria_id = '73333333-3333-4333-8333-333333333333'), 0::bigint, 'hidden plans excluded');
UPDATE public.catalogo_config SET visible_en_bot = true;
UPDATE public.reservas_perfil SET cerrada_at = now() WHERE cerrada_at IS NULL;
UPDATE public.servicios SET en_reposo = true WHERE id = '76666666-6666-4666-8666-666666666666';
SELECT is((SELECT perfiles_libres FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 0::bigint, 'resting service excluded');
SELECT is((SELECT count(*) FROM public.reservar_perfil('76666666-6666-4666-8666-666666666666', 'resting')), 0::bigint, 'cannot hold resting service');
UPDATE public.servicios SET en_reposo = false, activo = false WHERE id = '76666666-6666-4666-8666-666666666666';
SELECT is((SELECT perfiles_libres FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 0::bigint, 'inactive service excluded');
UPDATE public.servicios SET cortado_at = now() WHERE id = '76666666-6666-4666-8666-666666666666';
SELECT is((SELECT perfiles_libres FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 0::bigint, 'cut service excluded');
UPDATE public.servicios SET activo = true, cortado_at = NULL, archivado_at = now() WHERE id = '76666666-6666-4666-8666-666666666666';
SELECT is((SELECT perfiles_libres FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 0::bigint, 'archived service excluded');
UPDATE public.planes SET activo = false WHERE id = '75555555-5555-4555-8555-555555555555';
SELECT is((SELECT count(*) FROM public.catalogo_disponible() WHERE plan_id = '75555555-5555-4555-8555-555555555555'), 0::bigint, 'inactive plan excluded');
UPDATE public.planes_tipos SET activo = false WHERE id = '74444444-4444-4444-8444-444444444444';
SELECT is((SELECT count(*) FROM public.catalogo_disponible() WHERE categoria_id = '73333333-3333-4333-8333-333333333333'), 0::bigint, 'inactive type excluded');

CREATE TEMP TABLE first_interest AS SELECT public.registrar_interes('50760000001', '73333333-3333-4333-8333-333333333333') AS id;
SELECT is(public.registrar_interes('50760000001', '73333333-3333-4333-8333-333333333333', NULL, 'manual'), (SELECT id FROM first_interest), 'null-plan interest idempotency');
UPDATE public.intereses SET created_at = now() - interval '1 day' WHERE id = (SELECT id FROM first_interest);
SELECT lives_ok($$SELECT public.registrar_interes('50760000002', '73333333-3333-4333-8333-333333333333')$$, 'second waiting customer');
SELECT lives_ok($$SELECT public.registrar_interes('50760000001', '73333333-3333-4333-8333-333333333333', '75555555-5555-4555-8555-555555555555')$$, 'specific plan is separate bucket');
SELECT is((SELECT cantidad_esperando FROM public.v_demanda_sin_stock WHERE categoria_id = '73333333-3333-4333-8333-333333333333' AND plan_id IS NULL), 2::bigint, 'waiting demand count');
SELECT is((SELECT esperando_desde FROM public.v_demanda_sin_stock WHERE categoria_id = '73333333-3333-4333-8333-333333333333' AND plan_id IS NULL), now() - interval '1 day', 'oldest waiting date');
SELECT is((SELECT id FROM public.siguiente_interesado('73333333-3333-4333-8333-333333333333')), (SELECT id FROM first_interest), 'FIFO oldest claimed first');
SELECT ok((SELECT estado = 'avisado' AND avisado_at IS NOT NULL FROM public.intereses WHERE id = (SELECT id FROM first_interest)), 'claim atomically stamps notification');
SELECT is(public.registrar_interes('50760000001', '73333333-3333-4333-8333-333333333333'), (SELECT id FROM first_interest), 'notified interest remains active and idempotent');
SELECT is((SELECT contact_id FROM public.siguiente_interesado('73333333-3333-4333-8333-333333333333')), '50760000002', 'next waiting customer');
SELECT is((SELECT count(*) FROM public.siguiente_interesado('73333333-3333-4333-8333-333333333333')), 0::bigint, 'empty bucket does not steal specific-plan interest');
SELECT is((SELECT contact_id FROM public.siguiente_interesado('73333333-3333-4333-8333-333333333333', '75555555-5555-4555-8555-555555555555')), '50760000001', 'specific-plan FIFO');
UPDATE public.intereses SET estado = 'convertido' WHERE id = (SELECT id FROM first_interest);
SELECT isnt(public.registrar_interes('50760000001', '73333333-3333-4333-8333-333333333333'), (SELECT id FROM first_interest), 'terminal interest allows new registration');
SELECT throws_ok($$SELECT public.registrar_interes('invalid-contact', '73333333-3333-4333-8333-333333333333')$$, '22023', 'invalid interest input', 'contact validated');
SELECT throws_ok($$SELECT public.registrar_interes('5076', '73444444-4444-4444-8444-444444444444', '75555555-5555-4555-8555-555555555555')$$, '23514', 'invalid category/plan', 'cross-category plan rejected');

SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.catalogo_ajustes'::regclass, 'public.catalogo_config'::regclass, 'public.reservas_perfil'::regclass, 'public.intereses'::regclass)), 'RLS on every new table');
SELECT ok(NOT has_table_privilege('anon', 'public.intereses', 'SELECT'), 'anon cannot read contacts');
SELECT ok(NOT has_table_privilege('anon', 'public.catalogo_config', 'SELECT'), 'anon cannot read catalog config');
SELECT ok(NOT has_table_privilege('anon', 'public.reservas_perfil', 'SELECT'), 'anon cannot read owners');
SELECT ok(NOT has_table_privilege('anon', 'public.v_demanda_sin_stock', 'SELECT'), 'anon cannot read demand');
SELECT ok(NOT has_function_privilege('anon', 'public.catalogo_disponible()', 'EXECUTE'), 'anon cannot call catalog');
SELECT ok(NOT has_function_privilege('anon', 'public.reservar_perfil(text,text,text)', 'EXECUTE'), 'anon cannot reserve');
SELECT ok(NOT has_function_privilege('authenticated', 'public.registrar_interes(text,text,text,text)', 'EXECUTE'), 'only service role registers');
SELECT ok(NOT has_table_privilege('authenticated', 'public.intereses', 'UPDATE'), 'admins read interests without direct writes');
SELECT ok(NOT has_table_privilege('service_role', 'public.reservas_perfil', 'INSERT'), 'holds must use locking RPC');
SELECT ok((SELECT bool_and(prosecdef AND 'search_path=""' = ANY(proconfig)) FROM pg_proc
 WHERE oid IN ('public.catalogo_disponible()'::regprocedure, 'public.reservar_perfil(text,text,text)'::regprocedure,
 'public.liberar_reserva(uuid,text)'::regprocedure, 'public.expirar_reservas()'::regprocedure,
 'public.registrar_interes(text,text,text,text)'::regprocedure, 'public.siguiente_interesado(text,text)'::regprocedure)),
 'all public RPCs fix a safe definer search path');
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT public.catalogo_disponible()$$, 'actual service role reads catalog');
SELECT lives_ok($$SELECT public.registrar_interes('50760000003','73333333-3333-4333-8333-333333333333')$$, 'actual service role writes interest through RPC');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.catalogo_disponible()$$, '42501', NULL, 'actual anon execute rejected');
SELECT throws_ok($$SELECT * FROM public.intereses$$, '42501', NULL, 'actual anon table read rejected');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"72222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.intereses), 0::bigint, 'operator RLS hides contacts');
SELECT is((SELECT count(*) FROM public.v_demanda_sin_stock), 0::bigint, 'invoker view respects RLS');
SELECT throws_ok($$SELECT public.catalogo_disponible()$$, '42501', 'forbidden', 'operator cannot read definer catalog');
SELECT throws_ok($$SELECT public.expirar_reservas()$$, '42501', 'forbidden', 'operator cannot expire');
SELECT throws_ok($$SELECT public.reservar_perfil('76666666-6666-4666-8666-666666666666','x')$$, '42501', 'forbidden', 'operator cannot reserve');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"71111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) > 0 FROM public.intereses), 'admin RLS reads contacts');
SELECT lives_ok($$UPDATE public.catalogo_ajustes SET reserva_ttl_minutos = 20 WHERE id = 'global'$$, 'admin edits settings');
SELECT lives_ok($$SELECT public.catalogo_disponible()$$, 'admin invokes catalog');
RESET ROLE;
UPDATE public.usuarios SET active = false WHERE id = '71111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.catalogo_disponible()$$, '42501', 'forbidden', 'inactive admin denied');
SELECT is((SELECT count(*) FROM public.catalogo_config), 0::bigint, 'inactive admin RLS denied');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT throws_ok($$SELECT public.catalogo_disponible()$$, '42501', 'forbidden', 'null auth role cannot bypass checks');
SELECT * FROM finish();
ROLLBACK;
