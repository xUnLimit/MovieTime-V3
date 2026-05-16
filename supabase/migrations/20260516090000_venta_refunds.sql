-- ============================================================================
-- Venta refunds.
-- Keeps refunds in pagos_venta as financial ledger rows with estado=reembolsado.
-- ============================================================================

ALTER TYPE public.accion_log_enum ADD VALUE IF NOT EXISTS 'reembolso' AFTER 'renovacion';

ALTER TABLE public.pagos_venta
  ADD COLUMN IF NOT EXISTS destino_reembolso TEXT;

CREATE OR REPLACE FUNCTION public.create_venta_refund(
  p_venta_id TEXT,
  p_monto_original NUMERIC,
  p_moneda_original TEXT,
  p_monto_usd NUMERIC,
  p_exchange_rate NUMERIC,
  p_metodo_pago_id TEXT,
  p_metodo_pago_nombre_snapshot TEXT,
  p_destino_reembolso TEXT DEFAULT NULL,
  p_fecha_reembolso TIMESTAMPTZ DEFAULT now(),
  p_nota TEXT DEFAULT NULL,
  p_cortar BOOLEAN DEFAULT false,
  p_motivo_corte TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_periodo_id TEXT;
  v_pago_id TEXT;
  v_disponible_usd NUMERIC;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF COALESCE(p_monto_original, 0) <= 0 OR COALESCE(p_monto_usd, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto del reembolso debe ser mayor a 0.';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_destino_reembolso, '')), '') IS NULL THEN
    RAISE EXCEPTION 'La cuenta destino del cliente es obligatoria.';
  END IF;

  IF COALESCE(p_cortar, false) AND NULLIF(BTRIM(COALESCE(p_motivo_corte, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El motivo de corte es obligatorio.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_venta_id, 1));

  SELECT id
    INTO v_periodo_id
  FROM public.venta_periodos
  WHERE venta_id = p_venta_id
  ORDER BY numero_periodo DESC, fecha_fin DESC, created_at DESC
  LIMIT 1;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'La venta no tiene periodo asociado.';
  END IF;

  SELECT
    COALESCE(SUM(monto_usd) FILTER (WHERE estado = 'registrado'), 0)
      - COALESCE(SUM(monto_usd) FILTER (WHERE estado = 'reembolsado'), 0)
    INTO v_disponible_usd
  FROM public.pagos_venta
  WHERE venta_id = p_venta_id;

  IF p_monto_usd > COALESCE(v_disponible_usd, 0) + 0.0001 THEN
    RAISE EXCEPTION 'El reembolso supera el saldo disponible de la venta.';
  END IF;

  INSERT INTO public.pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    destino_reembolso,
    notas,
    created_by,
    anulada_at,
    anulada_by,
    motivo_anulacion
  )
  VALUES (
    v_periodo_id,
    p_venta_id,
    COALESCE(p_fecha_reembolso, now()),
    'reembolsado'::pago_estado_enum,
    p_monto_original,
    p_moneda_original,
    p_monto_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(BTRIM(p_destino_reembolso), ''),
    NULLIF(p_nota, ''),
    p_created_by,
    now(),
    p_created_by,
    COALESCE(NULLIF(p_motivo_corte, ''), NULLIF(p_nota, ''), 'Reembolso de venta')
  )
  RETURNING id INTO v_pago_id;

  IF COALESCE(p_cortar, false) THEN
    UPDATE public.ventas
    SET
      estado = 'inactivo'::venta_estado_enum,
      cortada_at = COALESCE(cortada_at, now()),
      cortada_by = COALESCE(cortada_by, p_created_by),
      motivo_corte = NULLIF(p_motivo_corte, ''),
      updated_at = now()
    WHERE id = p_venta_id;
  END IF;

  RETURN v_pago_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_venta_refund(
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN, TEXT, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_venta_refund(
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN, TEXT, UUID
) TO authenticated;

CREATE OR REPLACE VIEW public.v_categoria_financial_metrics
WITH (security_invoker = true)
AS
WITH finance AS (
  SELECT
    'ingresos'::text AS kind,
    CASE
      WHEN pv.estado = 'reembolsado' THEN -pv.monto_usd::numeric
      ELSE pv.monto_usd::numeric
    END AS amount_usd,
    v.categoria_id
  FROM public.pagos_venta pv
  JOIN public.ventas v ON v.id = pv.venta_id
  WHERE pv.estado IN ('registrado', 'reembolsado')

  UNION ALL

  SELECT
    'gastos'::text AS kind,
    ps.monto_usd::numeric AS amount_usd,
    s.categoria_id
  FROM public.pagos_servicio ps
  JOIN public.servicios s ON s.id = ps.servicio_id
  WHERE ps.estado = 'registrado'
)
SELECT
  c.id AS categoria_id,
  c.nombre AS categoria_nombre,
  COALESCE(SUM(f.amount_usd) FILTER (WHERE f.kind = 'ingresos'), 0) AS ingresos_usd,
  COALESCE(SUM(f.amount_usd) FILTER (WHERE f.kind = 'gastos'), 0) AS gastos_usd,
  COALESCE(SUM(f.amount_usd) FILTER (WHERE f.kind = 'ingresos'), 0)
    - COALESCE(SUM(f.amount_usd) FILTER (WHERE f.kind = 'gastos'), 0) AS ganancia_usd
FROM public.categorias c
LEFT JOIN finance f ON f.categoria_id = c.id
GROUP BY c.id, c.nombre;

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
      COALESCE(
        CASE WHEN pv.estado = 'reembolsado' THEN pv.fecha_pago::date ELSE vp.fecha_inicio END,
        pv.fecha_pago::date
      ) AS fecha,
      CASE
        WHEN pv.estado = 'reembolsado' THEN -pv.monto_usd::numeric
        ELSE pv.monto_usd::numeric
      END AS amount_usd,
      v.categoria_id,
      COALESCE(c.nombre, v.categoria_id) AS categoria_nombre
    FROM pagos_venta pv
    JOIN venta_periodos vp ON vp.id = pv.venta_periodo_id
    JOIN ventas v ON v.id = pv.venta_id
    LEFT JOIN categorias c ON c.id = v.categoria_id
    WHERE pv.estado IN ('registrado', 'reembolsado')

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
