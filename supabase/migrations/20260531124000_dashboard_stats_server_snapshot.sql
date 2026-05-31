-- ============================================================================
-- Dashboard stats server-side snapshot.
--
-- get_dashboard_stats_live() remains the canonical SQL calculation. This
-- migration adds a durable dirty flag + snapshot so dashboard reads do not
-- recalculate the full historical read-model on every page load.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS private.dashboard_read_model_state (
  id text PRIMARY KEY DEFAULT 'dashboard',
  dirty boolean NOT NULL DEFAULT true,
  dirty_reason text,
  dirty_since timestamptz,
  last_refresh_started_at timestamptz,
  last_refresh_finished_at timestamptz,
  last_refresh_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_read_model_state_singleton CHECK (id = 'dashboard')
);

CREATE TABLE IF NOT EXISTS private.dashboard_stats_snapshot (
  id text PRIMARY KEY DEFAULT 'dashboard',
  stats jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_stats_snapshot_singleton CHECK (id = 'dashboard')
);

REVOKE ALL ON private.dashboard_read_model_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.dashboard_stats_snapshot FROM PUBLIC, anon, authenticated;

INSERT INTO private.dashboard_read_model_state (id, dirty, dirty_reason, dirty_since)
VALUES ('dashboard', true, 'initial_snapshot', now())
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.mark_dashboard_read_model_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, pg_catalog
AS $$
BEGIN
  INSERT INTO private.dashboard_read_model_state (
    id,
    dirty,
    dirty_reason,
    dirty_since,
    updated_at
  )
  VALUES (
    'dashboard',
    true,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET dirty = true,
      dirty_reason = EXCLUDED.dirty_reason,
      dirty_since = COALESCE(private.dashboard_read_model_state.dirty_since, EXCLUDED.dirty_since),
      updated_at = now();

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.mark_dashboard_read_model_dirty() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats_snapshot(p_force boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, migration_audit, pg_catalog
AS $$
DECLARE
  v_locked boolean;
  v_dirty boolean;
  v_stats record;
  v_churn_stats jsonb;
  v_started_at timestamptz := now();
BEGIN
  SELECT pg_try_advisory_xact_lock(hashtext('dashboard_stats_snapshot_refresh'))
  INTO v_locked;

  IF NOT v_locked THEN
    RETURN false;
  END IF;

  INSERT INTO private.dashboard_read_model_state (id, dirty, dirty_reason, dirty_since)
  VALUES ('dashboard', true, 'missing_state', now())
  ON CONFLICT (id) DO NOTHING;

  SELECT dirty
  INTO v_dirty
  FROM private.dashboard_read_model_state
  WHERE id = 'dashboard'
  FOR UPDATE;

  IF NOT p_force AND NOT COALESCE(v_dirty, true) THEN
    RETURN false;
  END IF;

  UPDATE private.dashboard_read_model_state
  SET last_refresh_started_at = v_started_at,
      last_refresh_error = NULL,
      updated_at = now()
  WHERE id = 'dashboard';

  SELECT *
  INTO v_stats
  FROM public.get_dashboard_stats_live()
  LIMIT 1;

  SELECT public.get_dashboard_churn_stats()
  INTO v_churn_stats;

  INSERT INTO private.dashboard_stats_snapshot (id, stats, refreshed_at)
  VALUES (
    'dashboard',
    jsonb_build_object(
      'id', COALESCE(v_stats.id, 'singleton'),
      'ingresos_total', COALESCE(v_stats.ingresos_total, 0),
      'gastos_total', COALESCE(v_stats.gastos_total, 0),
      'terceros_por_mes', COALESCE(v_stats.terceros_por_mes, '[]'::jsonb),
      'terceros_por_dia', COALESCE(v_stats.terceros_por_dia, '[]'::jsonb),
      'ingresos_por_mes', COALESCE(v_stats.ingresos_por_mes, '[]'::jsonb),
      'ingresos_por_dia', COALESCE(v_stats.ingresos_por_dia, '[]'::jsonb),
      'ingresos_por_categoria', COALESCE(v_stats.ingresos_por_categoria, '[]'::jsonb),
      'ingresos_categorias_por_mes', COALESCE(v_stats.ingresos_categorias_por_mes, '[]'::jsonb),
      'ventas_pronostico', COALESCE(v_stats.ventas_pronostico, '[]'::jsonb),
      'servicios_pronostico', COALESCE(v_stats.servicios_pronostico, '[]'::jsonb),
      'churn_stats', COALESCE(
        v_churn_stats,
        '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb
      ),
      'updated_at', now()
    ),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET stats = EXCLUDED.stats,
      refreshed_at = EXCLUDED.refreshed_at;

  UPDATE private.dashboard_read_model_state
  SET dirty = false,
      dirty_reason = NULL,
      dirty_since = NULL,
      last_refresh_finished_at = now(),
      last_refresh_error = NULL,
      updated_at = now()
  WHERE id = 'dashboard';

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  UPDATE private.dashboard_read_model_state
  SET last_refresh_finished_at = now(),
      last_refresh_error = SQLERRM,
      updated_at = now()
  WHERE id = 'dashboard';

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_dashboard_stats_snapshot(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_stats_snapshot(boolean) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_snapshot()
RETURNS TABLE (
  id text,
  ingresos_total numeric,
  gastos_total numeric,
  terceros_por_mes jsonb,
  terceros_por_dia jsonb,
  ingresos_por_mes jsonb,
  ingresos_por_dia jsonb,
  ingresos_por_categoria jsonb,
  ingresos_categorias_por_mes jsonb,
  ventas_pronostico jsonb,
  servicios_pronostico jsonb,
  updated_at timestamptz,
  churn_stats jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, migration_audit, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM private.dashboard_stats_snapshot
    WHERE dashboard_stats_snapshot.id = 'dashboard'
  ) THEN
    PERFORM public.refresh_dashboard_stats_snapshot(true);
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(snapshot.stats ->> 'id', 'singleton')::text AS id,
    COALESCE((snapshot.stats ->> 'ingresos_total')::numeric, 0) AS ingresos_total,
    COALESCE((snapshot.stats ->> 'gastos_total')::numeric, 0) AS gastos_total,
    COALESCE(snapshot.stats -> 'terceros_por_mes', '[]'::jsonb) AS terceros_por_mes,
    COALESCE(snapshot.stats -> 'terceros_por_dia', '[]'::jsonb) AS terceros_por_dia,
    COALESCE(snapshot.stats -> 'ingresos_por_mes', '[]'::jsonb) AS ingresos_por_mes,
    COALESCE(snapshot.stats -> 'ingresos_por_dia', '[]'::jsonb) AS ingresos_por_dia,
    COALESCE(snapshot.stats -> 'ingresos_por_categoria', '[]'::jsonb) AS ingresos_por_categoria,
    COALESCE(snapshot.stats -> 'ingresos_categorias_por_mes', '[]'::jsonb) AS ingresos_categorias_por_mes,
    COALESCE(snapshot.stats -> 'ventas_pronostico', '[]'::jsonb) AS ventas_pronostico,
    COALESCE(snapshot.stats -> 'servicios_pronostico', '[]'::jsonb) AS servicios_pronostico,
    snapshot.refreshed_at AS updated_at,
    COALESCE(
      snapshot.stats -> 'churn_stats',
      '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb
    ) AS churn_stats
  FROM private.dashboard_stats_snapshot snapshot
  WHERE snapshot.id = 'dashboard'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      live.id,
      live.ingresos_total,
      live.gastos_total,
      live.terceros_por_mes,
      live.terceros_por_dia,
      live.ingresos_por_mes,
      live.ingresos_por_dia,
      live.ingresos_por_categoria,
      live.ingresos_categorias_por_mes,
      live.ventas_pronostico,
      live.servicios_pronostico,
      live.updated_at,
      COALESCE(
        public.get_dashboard_churn_stats(),
        '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb
      ) AS churn_stats
    FROM public.get_dashboard_stats_live() live
    LIMIT 1;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats_snapshot() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_home()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_stats record;
  v_activity jsonb;
BEGIN
  SELECT * INTO v_stats FROM public.get_dashboard_stats_snapshot() LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'usuarioId', al.usuario_id,
        'usuarioEmail', al.usuario_email,
        'accion', al.accion,
        'entidad', al.entidad,
        'entidadId', al.entidad_id,
        'entidadNombre', al.entidad_nombre,
        'detalles', al.detalles,
        'cambios', al.cambios,
        'metadata', al.metadata,
        'timestamp', al.timestamp
      )
      ORDER BY al.timestamp DESC
    ),
    '[]'::jsonb
  )
  INTO v_activity
  FROM (
    SELECT *
    FROM public.activity_log
    ORDER BY timestamp DESC
    LIMIT 6
  ) al;

  RETURN jsonb_build_object(
    'stats', jsonb_build_object(
      'id', v_stats.id,
      'ingresos_total', v_stats.ingresos_total,
      'gastos_total', v_stats.gastos_total,
      'terceros_por_mes', v_stats.terceros_por_mes,
      'terceros_por_dia', v_stats.terceros_por_dia,
      'ingresos_por_mes', v_stats.ingresos_por_mes,
      'ingresos_por_dia', v_stats.ingresos_por_dia,
      'ingresos_por_categoria', v_stats.ingresos_por_categoria,
      'ingresos_categorias_por_mes', v_stats.ingresos_categorias_por_mes,
      'ventas_pronostico', v_stats.ventas_pronostico,
      'servicios_pronostico', v_stats.servicios_pronostico,
      'churn_stats', COALESCE(
        v_stats.churn_stats,
        '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb
      ),
      'updated_at', v_stats.updated_at
    ),
    'counts', jsonb_build_object(
      'ventasActivas', (
        SELECT COUNT(*)
        FROM public.ventas
        WHERE archivado_at IS NULL
          AND estado = 'activo'
      ),
      'totalClientes', (
        SELECT COUNT(*)
        FROM public.terceros
        WHERE tipo = 'cliente'
      ),
      'totalRevendedores', (
        SELECT COUNT(*)
        FROM public.terceros
        WHERE tipo = 'revendedor'
      )
    ),
    'recentActivity', v_activity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_home() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_home() TO authenticated;

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.ventas;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.ventas
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.venta_periodos;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.venta_periodos
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.pagos_venta;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.pagos_venta
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.servicios;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.servicios
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.servicio_periodos;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.servicio_periodos
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.pagos_servicio;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.pagos_servicio
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.gastos;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.gastos
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.terceros;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.terceros
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.categorias;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.categorias
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DROP TRIGGER IF EXISTS trg_mark_dashboard_read_model_dirty ON public.exchange_rates;
CREATE TRIGGER trg_mark_dashboard_read_model_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.exchange_rates
FOR EACH STATEMENT EXECUTE FUNCTION private.mark_dashboard_read_model_dirty();

DO $$
BEGIN
  PERFORM cron.unschedule('dashboard-stats-snapshot-refresh');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'dashboard-stats-snapshot-refresh',
  '* * * * *',
  $cron$SELECT public.refresh_dashboard_stats_snapshot();$cron$
);

SELECT public.refresh_dashboard_stats_snapshot(true);

CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo')
  ),
  allowed_authenticated_security_definer(function_name) AS (
    VALUES
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('get_dashboard_stats_snapshot'),
      ('get_dashboard_churn_stats'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments'),
      ('create_venta_refund')
  ),
  required_authenticated_rpcs(function_name) AS (
    VALUES
      ('create_venta_with_initial_payment'),
      ('create_servicio_with_initial_payment'),
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('get_dashboard_stats_snapshot'),
      ('get_dashboard_churn_stats'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments'),
      ('create_venta_refund')
  ),
  public_functions AS (
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  )
  SELECT jsonb_build_object(
    'rls_disabled_app_tables',
      (
        SELECT count(*)
        FROM app_tables t
        JOIN pg_class c ON c.relname = t.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE c.relkind = 'r'
          AND c.relrowsecurity = false
      ),
    'security_definer_missing_search_path',
      (
        SELECT count(*)
        FROM public_functions
        WHERE prosecdef = true
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(COALESCE(proconfig, ARRAY[]::text[])) cfg
            WHERE cfg LIKE 'search_path=%'
          )
      ),
    'security_definer_executable_by_anon',
      (
        SELECT count(*)
        FROM public_functions
        WHERE prosecdef = true
          AND has_function_privilege('anon', oid, 'EXECUTE')
      ),
    'unapproved_security_definer_executable_by_authenticated',
      (
        SELECT count(*)
        FROM public_functions pf
        WHERE prosecdef = true
          AND has_function_privilege('authenticated', oid, 'EXECUTE')
          AND NOT EXISTS (
            SELECT 1
            FROM allowed_authenticated_security_definer allowed
            WHERE allowed.function_name = pf.proname
          )
      ),
    'required_rpc_missing_authenticated_execute',
      (
        SELECT count(*)
        FROM required_authenticated_rpcs required
        WHERE NOT EXISTS (
          SELECT 1
          FROM public_functions pf
          WHERE pf.proname = required.function_name
            AND has_function_privilege('authenticated', pf.oid, 'EXECUTE')
        )
      ),
    'required_rpc_executable_by_anon',
      (
        SELECT count(*)
        FROM required_authenticated_rpcs required
        JOIN public_functions pf ON pf.proname = required.function_name
        WHERE has_function_privilege('anon', pf.oid, 'EXECUTE')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.run_security_audit_validations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_audit_validations() TO service_role, postgres;

NOTIFY pgrst, 'reload schema';
