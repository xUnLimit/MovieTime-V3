-- ============================================================================
-- V2 dashboard rebuild
--
-- SQL is the single source of truth for dashboard stats. This version also
-- rebuilds user-growth arrays, uses Panama local dates, and serializes rebuilds
-- with an advisory transaction lock.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rebuild_dashboard_financial_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_ingresos_total NUMERIC;
  v_gastos_total NUMERIC;
  v_usuarios_por_mes JSONB;
  v_usuarios_por_dia JSONB;
  v_ingresos_por_mes JSONB;
  v_ingresos_por_dia JSONB;
  v_ingresos_por_categoria JSONB;
  v_ingresos_categorias_por_mes JSONB;
  v_ventas_pronostico JSONB;
  v_servicios_pronostico JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dashboard_stats_rebuild'));

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
    FROM legacy_orphan_records lor
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
    FROM usuarios u
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
    (SELECT ingresos_total FROM totals),
    (SELECT gastos_total FROM totals),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('mes', mes, 'clientes', clientes, 'revendedores', revendedores)
        ORDER BY mes
      )
      FROM user_monthly
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('dia', dia, 'clientes', clientes, 'revendedores', revendedores)
        ORDER BY dia
      )
      FROM user_daily
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('mes', mes, 'ingresos', ingresos, 'gastos', gastos)
        ORDER BY mes
      )
      FROM monthly
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('dia', dia, 'ingresos', ingresos, 'gastos', gastos)
        ORDER BY dia
      )
      FROM daily
    ), '[]'::jsonb),
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
    ), '[]'::jsonb),
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
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'categoriaId', categoria_id,
          'fechaInicio', to_char(fecha_inicio, 'YYYY-MM-DD') || 'T00:00:00',
          'fechaFin', to_char(fecha_fin, 'YYYY-MM-DD') || 'T00:00:00',
          'cicloPago', ciclo_pago,
          'precioFinal', precio_final,
          'moneda', moneda
        )
        ORDER BY id
      )
      FROM venta_forecast
      WHERE fecha_fin IS NOT NULL
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'fechaVencimiento', to_char(fecha_vencimiento, 'YYYY-MM-DD') || 'T00:00:00',
          'cicloPago', ciclo_pago,
          'costoServicio', costo_servicio,
          'moneda', moneda
        )
        ORDER BY id
      )
      FROM servicio_forecast
      WHERE fecha_vencimiento IS NOT NULL
    ), '[]'::jsonb)
  INTO
    v_ingresos_total,
    v_gastos_total,
    v_usuarios_por_mes,
    v_usuarios_por_dia,
    v_ingresos_por_mes,
    v_ingresos_por_dia,
    v_ingresos_por_categoria,
    v_ingresos_categorias_por_mes,
    v_ventas_pronostico,
    v_servicios_pronostico;

  INSERT INTO dashboard_stats (
    id,
    ingresos_total,
    gastos_total,
    usuarios_por_mes,
    usuarios_por_dia,
    ingresos_por_mes,
    ingresos_por_dia,
    ingresos_por_categoria,
    ingresos_categorias_por_mes,
    ventas_pronostico,
    servicios_pronostico,
    updated_at
  )
  VALUES (
    'singleton',
    v_ingresos_total,
    v_gastos_total,
    v_usuarios_por_mes,
    v_usuarios_por_dia,
    v_ingresos_por_mes,
    v_ingresos_por_dia,
    v_ingresos_por_categoria,
    v_ingresos_categorias_por_mes,
    v_ventas_pronostico,
    v_servicios_pronostico,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    ingresos_total = EXCLUDED.ingresos_total,
    gastos_total = EXCLUDED.gastos_total,
    usuarios_por_mes = EXCLUDED.usuarios_por_mes,
    usuarios_por_dia = EXCLUDED.usuarios_por_dia,
    ingresos_por_mes = EXCLUDED.ingresos_por_mes,
    ingresos_por_dia = EXCLUDED.ingresos_por_dia,
    ingresos_por_categoria = EXCLUDED.ingresos_por_categoria,
    ingresos_categorias_por_mes = EXCLUDED.ingresos_categorias_por_mes,
    ventas_pronostico = EXCLUDED.ventas_pronostico,
    servicios_pronostico = EXCLUDED.servicios_pronostico,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_dashboard_financial_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_dashboard_financial_stats() TO authenticated;
