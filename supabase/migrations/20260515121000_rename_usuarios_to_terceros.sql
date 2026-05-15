-- ============================================================================
-- Rename commercial actors from usuarios to terceros.
--
-- profiles/auth.users remain the internal system users.
-- terceros are external commercial actors: clientes and revendedores.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'asociado_a_enum')
     AND EXISTS (
       SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'asociado_a_enum' AND e.enumlabel = 'usuario'
     )
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'asociado_a_enum' AND e.enumlabel = 'tercero'
     ) THEN
    ALTER TYPE public.asociado_a_enum RENAME VALUE 'usuario' TO 'tercero';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'entidad_log_enum')
     AND EXISTS (
       SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'entidad_log_enum' AND e.enumlabel = 'usuario'
     )
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'entidad_log_enum' AND e.enumlabel = 'tercero'
     ) THEN
    ALTER TYPE public.entidad_log_enum RENAME VALUE 'usuario' TO 'tercero';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'usuario_tipo_enum')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'tercero_tipo_enum') THEN
    ALTER TYPE public.usuario_tipo_enum RENAME TO tercero_tipo_enum;
  END IF;

  IF to_regclass('public.usuarios') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.terceros')) THEN
    ALTER TABLE public.usuarios RENAME TO terceros;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_pkey' AND conrelid = 'public.terceros'::regclass) THEN
    ALTER TABLE public.terceros RENAME CONSTRAINT usuarios_pkey TO terceros_pkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_created_by_fkey' AND conrelid = 'public.terceros'::regclass) THEN
    ALTER TABLE public.terceros RENAME CONSTRAINT usuarios_created_by_fkey TO terceros_created_by_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_metodo_pago_id_fkey' AND conrelid = 'public.terceros'::regclass) THEN
    ALTER TABLE public.terceros RENAME CONSTRAINT usuarios_metodo_pago_id_fkey TO terceros_metodo_pago_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_usuarios' AND tgrelid = 'public.terceros'::regclass) THEN
    ALTER TRIGGER trg_touch_usuarios ON public.terceros RENAME TO trg_touch_terceros;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'terceros' AND policyname = 'usuarios_select') THEN
    ALTER POLICY usuarios_select ON public.terceros RENAME TO terceros_select;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'terceros' AND policyname = 'usuarios_insert') THEN
    ALTER POLICY usuarios_insert ON public.terceros RENAME TO terceros_insert;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'terceros' AND policyname = 'usuarios_update') THEN
    ALTER POLICY usuarios_update ON public.terceros RENAME TO terceros_update;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'terceros' AND policyname = 'usuarios_delete_admin') THEN
    ALTER POLICY usuarios_delete_admin ON public.terceros RENAME TO terceros_delete_admin;
  END IF;
END $$;

ALTER INDEX IF EXISTS public.idx_usuarios_tipo_active RENAME TO idx_terceros_tipo_active;
ALTER INDEX IF EXISTS public.idx_usuarios_metodo_pago RENAME TO idx_terceros_metodo_pago;
ALTER INDEX IF EXISTS public.idx_usuarios_created_by RENAME TO idx_terceros_created_by;

DO $$
BEGIN
  IF to_regclass('public.v_usuarios_servicios_activos') IS NOT NULL
     AND to_regclass('public.v_terceros_servicios_activos') IS NULL THEN
    ALTER VIEW public.v_usuarios_servicios_activos RENAME TO v_terceros_servicios_activos;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'v_terceros_servicios_activos' AND column_name = 'usuario_id'
  ) THEN
    ALTER VIEW public.v_terceros_servicios_activos RENAME COLUMN usuario_id TO tercero_id;
  END IF;
END $$;
-- ============================================================================
-- Live dashboard read model
--
-- The dashboard cache remains available as an admin repair artifact, but normal
-- app reads should use this SQL read model so UI data is computed from the
-- normalized source tables every time it is loaded.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_dashboard_home();
DROP FUNCTION IF EXISTS public.get_dashboard_stats_live();
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_live()
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
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_audit, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  WITH legacy_base AS (
    SELECT
      CASE
        WHEN lor.source_collection = 'pagosVenta' THEN 'ingresos'
        ELSE 'gastos'
      END AS kind,
      ((COALESCE(
        NULLIF(lor.payload ->> 'fechaInicio', ''),
        NULLIF(lor.payload ->> 'fecha', ''),
        NULLIF(lor.payload ->> 'createdAt', '')
      ))::timestamptz AT TIME ZONE 'America/Panama')::date AS fecha,
      COALESCE((lor.payload ->> 'monto')::numeric, (lor.payload ->> 'total')::numeric, 0) AS amount_original,
      UPPER(COALESCE(NULLIF(lor.payload ->> 'moneda', ''), 'USD')) AS currency,
      NULLIF(lor.payload ->> 'categoriaId', '') AS categoria_id
    FROM migration_audit.legacy_orphan_records lor
    WHERE lor.resolved_at IS NULL
      AND lor.source_collection IN ('pagosVenta', 'pagosServicio')
      AND COALESCE(
        NULLIF(lor.payload ->> 'fechaInicio', ''),
        NULLIF(lor.payload ->> 'fecha', ''),
        NULLIF(lor.payload ->> 'createdAt', '')
      ) IS NOT NULL
  ),
  legacy_finance AS (
    SELECT
      lb.kind,
      lb.fecha,
      CASE
        WHEN lb.currency IN ('USD', 'PAB') THEN lb.amount_original
        WHEN direct.rate IS NOT NULL AND direct.rate > 0 THEN lb.amount_original * direct.rate
        WHEN inverse.rate IS NOT NULL AND inverse.rate > 0 THEN lb.amount_original / inverse.rate
        ELSE lb.amount_original
      END AS amount_usd,
      lb.categoria_id,
      COALESCE(c.nombre, lb.categoria_id) AS categoria_nombre
    FROM legacy_base lb
    LEFT JOIN exchange_rates direct ON direct.currency_pair = lb.currency || '_USD'
    LEFT JOIN exchange_rates inverse ON inverse.currency_pair = 'USD_' || lb.currency
    LEFT JOIN categorias c ON c.id = lb.categoria_id
    WHERE lb.fecha IS NOT NULL
  ),
  finance AS (
    SELECT
      'ingresos'::text AS kind,
      COALESCE(vp.fecha_inicio, pv.fecha_pago::date) AS fecha,
      pv.monto_usd::numeric AS amount_usd,
      v.categoria_id,
      COALESCE(c.nombre, v.categoria_id) AS categoria_nombre
    FROM pagos_venta pv
    JOIN venta_periodos vp ON vp.id = pv.venta_periodo_id
    JOIN ventas v ON v.id = pv.venta_id
    LEFT JOIN categorias c ON c.id = v.categoria_id
    WHERE pv.estado = 'registrado'

    UNION ALL

    SELECT
      'gastos'::text AS kind,
      COALESCE(sp.fecha_inicio, ps.fecha_pago::date) AS fecha,
      ps.monto_usd::numeric AS amount_usd,
      COALESCE(ps.categoria_id_snapshot, s.categoria_id) AS categoria_id,
      COALESCE(c.nombre, COALESCE(ps.categoria_id_snapshot, s.categoria_id)) AS categoria_nombre
    FROM pagos_servicio ps
    JOIN servicio_periodos sp ON sp.id = ps.servicio_periodo_id
    JOIN servicios s ON s.id = ps.servicio_id
    LEFT JOIN categorias c ON c.id = COALESCE(ps.categoria_id_snapshot, s.categoria_id)
    WHERE ps.estado = 'registrado'

    UNION ALL

    SELECT
      'gastos'::text AS kind,
      g.fecha,
      g.monto_usd::numeric AS amount_usd,
      NULL::text AS categoria_id,
      NULL::text AS categoria_nombre
    FROM gastos g

    UNION ALL

    SELECT kind, fecha, amount_usd, categoria_id, categoria_nombre
    FROM legacy_finance
  ),
  totals AS (
    SELECT
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS ingresos_total,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos_total
    FROM finance
  ),
  monthly AS (
    SELECT
      to_char(fecha, 'YYYY-MM') AS mes,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS ingresos,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance
    GROUP BY to_char(fecha, 'YYYY-MM')
  ),
  current_month AS (
    SELECT date_trunc('month', (now() AT TIME ZONE 'America/Panama')::date::timestamp)::date AS first_day
  ),
  daily AS (
    SELECT
      to_char(fecha, 'YYYY-MM-DD') AS dia,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS ingresos,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance, current_month cm
    WHERE fecha >= cm.first_day
      AND fecha < (cm.first_day + INTERVAL '1 month')::date
    GROUP BY to_char(fecha, 'YYYY-MM-DD')
  ),
  user_base AS (
    SELECT
      (u.created_at AT TIME ZONE 'America/Panama')::date AS fecha,
      u.tipo
    FROM terceros u
    WHERE u.tipo IN ('cliente', 'revendedor')
  ),
  user_monthly AS (
    SELECT
      to_char(fecha, 'YYYY-MM') AS mes,
      COUNT(*) FILTER (WHERE tipo = 'cliente') AS clientes,
      COUNT(*) FILTER (WHERE tipo = 'revendedor') AS revendedores
    FROM user_base
    GROUP BY to_char(fecha, 'YYYY-MM')
  ),
  user_daily AS (
    SELECT
      to_char(fecha, 'YYYY-MM-DD') AS dia,
      COUNT(*) FILTER (WHERE tipo = 'cliente') AS clientes,
      COUNT(*) FILTER (WHERE tipo = 'revendedor') AS revendedores
    FROM user_base, current_month cm
    WHERE fecha >= cm.first_day
      AND fecha < (cm.first_day + INTERVAL '1 month')::date
    GROUP BY to_char(fecha, 'YYYY-MM-DD')
  ),
  category_totals AS (
    SELECT
      categoria_id,
      categoria_nombre,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS total,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance
    WHERE categoria_id IS NOT NULL
    GROUP BY categoria_id, categoria_nombre
  ),
  category_monthly AS (
    SELECT
      to_char(fecha, 'YYYY-MM') AS mes,
      categoria_id,
      categoria_nombre,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS total,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance
    WHERE categoria_id IS NOT NULL
    GROUP BY to_char(fecha, 'YYYY-MM'), categoria_id, categoria_nombre
  ),
  latest_venta_period AS (
    SELECT DISTINCT ON (vp.venta_id)
      vp.*
    FROM venta_periodos vp
    ORDER BY vp.venta_id, vp.fecha_fin DESC, vp.numero_periodo DESC, vp.created_at DESC
  ),
  latest_venta_payment_period AS (
    SELECT DISTINCT ON (pv.venta_id)
      pv.venta_id,
      vp.fecha_inicio,
      vp.fecha_fin,
      vp.ciclo_pago,
      vp.precio_original,
      vp.total_original,
      pv.monto_original,
      COALESCE(NULLIF(pv.moneda_original, ''), NULLIF(vp.moneda_original, '')) AS moneda_original
    FROM pagos_venta pv
    JOIN venta_periodos vp ON vp.id = pv.venta_periodo_id
    WHERE pv.estado = 'registrado'
    ORDER BY pv.venta_id, vp.fecha_fin DESC, vp.numero_periodo DESC, pv.fecha_pago DESC, pv.created_at DESC
  ),
  venta_forecast AS (
    SELECT
      v.id,
      v.categoria_id,
      COALESCE(lpp.fecha_inicio, lvp.fecha_inicio) AS fecha_inicio,
      COALESCE(lpp.fecha_fin, lvp.fecha_fin) AS fecha_fin,
      COALESCE(lpp.ciclo_pago, lvp.ciclo_pago, 'mensual'::ciclo_pago_enum) AS ciclo_pago,
      COALESCE(
        NULLIF(lpp.precio_original, 0),
        NULLIF(lpp.monto_original, 0),
        NULLIF(lpp.total_original, 0),
        NULLIF(lvp.precio_original, 0),
        lvp.total_original,
        0
      ) AS precio_final,
      COALESCE(NULLIF(lpp.moneda_original, ''), NULLIF(lvp.moneda_original, ''), 'USD') AS moneda
    FROM ventas v
    LEFT JOIN latest_venta_period lvp ON lvp.venta_id = v.id
    LEFT JOIN latest_venta_payment_period lpp ON lpp.venta_id = v.id
    WHERE v.estado <> 'inactivo'
      AND v.archivado_at IS NULL
  ),
  latest_servicio_period AS (
    SELECT DISTINCT ON (sp.servicio_id)
      sp.*
    FROM servicio_periodos sp
    ORDER BY sp.servicio_id, sp.fecha_vencimiento DESC, sp.numero_periodo DESC, sp.created_at DESC
  ),
  servicio_forecast AS (
    SELECT
      s.id,
      lsp.fecha_vencimiento,
      COALESCE(lsp.ciclo_pago, 'mensual'::ciclo_pago_enum) AS ciclo_pago,
      COALESCE(lsp.costo_original, 0) AS costo_servicio,
      COALESCE(NULLIF(lsp.moneda_original, ''), 'USD') AS moneda
    FROM servicios s
    JOIN latest_servicio_period lsp ON lsp.servicio_id = s.id
    WHERE s.activo = true
      AND s.en_reposo = false
      AND s.archivado_at IS NULL
      AND COALESCE(lsp.costo_original, 0) > 0
  )
  SELECT
    'singleton'::text AS id,
    (SELECT totals.ingresos_total FROM totals) AS ingresos_total,
    (SELECT totals.gastos_total FROM totals) AS gastos_total,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('mes', mes, 'clientes', clientes, 'revendedores', revendedores)
        ORDER BY mes
      )
      FROM user_monthly
    ), '[]'::jsonb) AS terceros_por_mes,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('dia', dia, 'clientes', clientes, 'revendedores', revendedores)
        ORDER BY dia
      )
      FROM user_daily
    ), '[]'::jsonb) AS terceros_por_dia,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('mes', mes, 'ingresos', ingresos, 'gastos', gastos)
        ORDER BY mes
      )
      FROM monthly
    ), '[]'::jsonb) AS ingresos_por_mes,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('dia', dia, 'ingresos', ingresos, 'gastos', gastos)
        ORDER BY dia
      )
      FROM daily
    ), '[]'::jsonb) AS ingresos_por_dia,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'categoriaId', categoria_id,
          'nombre', categoria_nombre,
          'total', total,
          'gastos', gastos
        )
        ORDER BY categoria_nombre
      )
      FROM category_totals
    ), '[]'::jsonb) AS ingresos_por_categoria,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'mes', mes,
          'categoriaId', categoria_id,
          'nombre', categoria_nombre,
          'total', total,
          'gastos', gastos
        )
        ORDER BY mes, categoria_nombre
      )
      FROM category_monthly
    ), '[]'::jsonb) AS ingresos_categorias_por_mes,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vf.id,
          'categoriaId', vf.categoria_id,
          'fechaInicio', to_char(vf.fecha_inicio, 'YYYY-MM-DD') || 'T00:00:00',
          'fechaFin', to_char(vf.fecha_fin, 'YYYY-MM-DD') || 'T00:00:00',
          'cicloPago', vf.ciclo_pago,
          'precioFinal', vf.precio_final,
          'moneda', vf.moneda
        )
        ORDER BY vf.id
      )
      FROM venta_forecast vf
      WHERE vf.fecha_fin IS NOT NULL
    ), '[]'::jsonb) AS ventas_pronostico,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', sf.id,
          'fechaVencimiento', to_char(sf.fecha_vencimiento, 'YYYY-MM-DD') || 'T00:00:00',
          'cicloPago', sf.ciclo_pago,
          'costoServicio', sf.costo_servicio,
          'moneda', sf.moneda
        )
        ORDER BY sf.id
      )
      FROM servicio_forecast sf
      WHERE sf.fecha_vencimiento IS NOT NULL
    ), '[]'::jsonb) AS servicios_pronostico,
    now() AS updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats_live() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats_live() TO authenticated;

DROP FUNCTION IF EXISTS public.get_dashboard_home();
CREATE OR REPLACE FUNCTION public.get_dashboard_home()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_stats RECORD;
  v_activity jsonb;
BEGIN
  SELECT * INTO v_stats FROM public.get_dashboard_stats_live() LIMIT 1;

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
    FROM activity_log
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
      'updated_at', v_stats.updated_at
    ),
    'counts', jsonb_build_object(
      'ventasActivas', (
        SELECT COUNT(*)
        FROM ventas
        WHERE archivado_at IS NULL
          AND estado = 'activo'
      ),
      'totalClientes', (
        SELECT COUNT(*)
        FROM terceros
        WHERE tipo = 'cliente'
      ),
      'totalRevendedores', (
        SELECT COUNT(*)
        FROM terceros
        WHERE tipo = 'revendedor'
      )
    ),
    'recentActivity', v_activity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_home() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_home() TO authenticated;


CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('terceros'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
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
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments')
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
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments')
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

COMMIT;
