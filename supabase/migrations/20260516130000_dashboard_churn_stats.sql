-- ============================================================================
-- Dashboard churn stats.
-- Adds a compact churn read model for the existing dashboard home payload.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ventas_cortada_cliente
  ON public.ventas(cortada_at, cliente_id)
  WHERE archivado_at IS NULL
    AND cortada_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_dashboard_churn_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
WITH bounds AS (
  SELECT date_trunc('month', now() AT TIME ZONE 'America/Panama')::date AS current_month
),
months AS (
  SELECT
    gs::date AS month_start,
    (gs::date + INTERVAL '1 month')::date AS month_end,
    (gs::timestamp AT TIME ZONE 'America/Panama') AS month_start_at,
    ((gs + INTERVAL '1 month')::timestamp AT TIME ZONE 'America/Panama') AS month_end_at
  FROM bounds,
    generate_series(
      (bounds.current_month - INTERVAL '11 months')::date,
      bounds.current_month,
      INTERVAL '1 month'
    ) AS gs
),
clientes_activos AS (
  SELECT COUNT(DISTINCT t.id) AS total
  FROM public.terceros t
  JOIN public.ventas v ON v.cliente_id = t.id
  WHERE t.tipo = 'cliente'
    AND t.active = true
    AND v.archivado_at IS NULL
    AND v.estado = 'activo'
),
clientes_inactivos AS (
  SELECT COUNT(DISTINCT t.id) AS total
  FROM public.terceros t
  WHERE t.tipo = 'cliente'
    AND t.active = true
    AND EXISTS (
      SELECT 1
      FROM public.ventas v
      WHERE v.cliente_id = t.id
        AND v.archivado_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.ventas v
      WHERE v.cliente_id = t.id
        AND v.archivado_at IS NULL
        AND v.estado = 'activo'
    )
),
churn_events AS (
  SELECT DISTINCT
    t.id AS cliente_id,
    date_trunc('month', v.cortada_at AT TIME ZONE 'America/Panama')::date AS month_start
  FROM public.ventas v
  JOIN public.terceros t ON t.id = v.cliente_id
  WHERE t.tipo = 'cliente'
    AND t.active = true
    AND v.archivado_at IS NULL
    AND v.cortada_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.ventas other_v
      WHERE other_v.cliente_id = v.cliente_id
        AND other_v.id <> v.id
        AND other_v.archivado_at IS NULL
        AND other_v.created_at <= v.cortada_at
        AND (
          (other_v.estado = 'activo' AND other_v.cortada_at IS NULL)
          OR other_v.cortada_at > v.cortada_at
        )
    )
),
perdidos_por_mes AS (
  SELECT
    m.month_start,
    COUNT(DISTINCT ce.cliente_id) AS perdidos
  FROM months m
  LEFT JOIN churn_events ce ON ce.month_start = m.month_start
  GROUP BY m.month_start
),
activos_inicio_mes AS (
  SELECT
    m.month_start,
    COUNT(DISTINCT t.id) AS activos_inicio
  FROM months m
  LEFT JOIN public.ventas v
    ON v.archivado_at IS NULL
    AND v.created_at < m.month_start_at
    AND (
      (v.estado = 'activo' AND v.cortada_at IS NULL)
      OR v.cortada_at >= m.month_start_at
    )
  LEFT JOIN public.terceros t
    ON t.id = v.cliente_id
    AND t.tipo = 'cliente'
    AND t.active = true
  GROUP BY m.month_start
),
por_mes AS (
  SELECT
    m.month_start,
    to_char(m.month_start, 'YYYY-MM') AS mes,
    COALESCE(ppm.perdidos, 0)::integer AS perdidos,
    COALESCE(aim.activos_inicio, 0)::integer AS activos_inicio,
    CASE
      WHEN COALESCE(aim.activos_inicio, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(ppm.perdidos, 0)::numeric / aim.activos_inicio::numeric) * 100, 2)
    END AS churn_pct
  FROM months m
  LEFT JOIN perdidos_por_mes ppm ON ppm.month_start = m.month_start
  LEFT JOIN activos_inicio_mes aim ON aim.month_start = m.month_start
),
current_month_churn AS (
  SELECT COALESCE(churn_pct, 0) AS churn_pct
  FROM por_mes, bounds
  WHERE por_mes.month_start = bounds.current_month
)
SELECT jsonb_build_object(
  'kpis', jsonb_build_object(
    'clientesActivos', COALESCE((SELECT total FROM clientes_activos), 0),
    'clientesInactivos', COALESCE((SELECT total FROM clientes_inactivos), 0),
    'tasaChurnMesActual', COALESCE((SELECT churn_pct FROM current_month_churn), 0)
  ),
  'porMes', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'mes', mes,
        'perdidos', perdidos,
        'activosInicio', activos_inicio,
        'churnPct', churn_pct
      )
      ORDER BY month_start
    )
    FROM por_mes
  ), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_churn_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_churn_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_home()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_stats RECORD;
  v_activity jsonb;
  v_churn_stats jsonb;
BEGIN
  SELECT * INTO v_stats FROM public.get_dashboard_stats_live() LIMIT 1;
  SELECT public.get_dashboard_churn_stats() INTO v_churn_stats;

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
      'churn_stats', COALESCE(v_churn_stats, '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb),
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

NOTIFY pgrst, 'reload schema';
