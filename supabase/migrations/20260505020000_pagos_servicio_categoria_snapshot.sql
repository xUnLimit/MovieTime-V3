-- ============================================================================
-- Preserve the category snapshot of service payments.
--
-- Firestore pagosServicio stored categoriaId on the payment. A service can later
-- move to another category, but historical profitability must remain attached
-- to the category that was present when the payment was registered.
-- ============================================================================

ALTER TABLE pagos_servicio
  ADD COLUMN IF NOT EXISTS categoria_id_snapshot TEXT REFERENCES categorias(id) ON DELETE SET NULL;

UPDATE pagos_servicio ps
SET categoria_id_snapshot = s.categoria_id
FROM servicios s
WHERE s.id = ps.servicio_id
  AND ps.categoria_id_snapshot IS NULL;

-- Per-record corrections that depend on legacy Firebase IDs live in
-- scripts/data-fixes/2026-05-05_pagos_servicio_categoria_snapshot.sql
-- and must be applied manually against the MovieTime production dataset.

CREATE INDEX IF NOT EXISTS idx_pagos_servicio_categoria_snapshot
  ON pagos_servicio(categoria_id_snapshot)
  WHERE categoria_id_snapshot IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_pagos_servicio_categoria_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.categoria_id_snapshot IS NULL THEN
    SELECT s.categoria_id
      INTO NEW.categoria_id_snapshot
    FROM servicios s
    WHERE s.id = NEW.servicio_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pagos_servicio_categoria_snapshot ON pagos_servicio;
CREATE TRIGGER trg_set_pagos_servicio_categoria_snapshot
BEFORE INSERT ON pagos_servicio
FOR EACH ROW
EXECUTE FUNCTION public.set_pagos_servicio_categoria_snapshot();

DROP VIEW IF EXISTS v_pagos_servicio_full;

CREATE VIEW v_pagos_servicio_full
WITH (security_invoker = true)
AS
SELECT
  ps.*,
  s.nombre AS servicio_nombre,
  COALESCE(ps.categoria_id_snapshot, s.categoria_id) AS categoria_id,
  c.nombre AS categoria_nombre,
  sp.numero_periodo,
  sp.fecha_inicio AS periodo_inicio,
  sp.fecha_vencimiento AS periodo_vencimiento,
  sp.ciclo_pago
FROM pagos_servicio ps
JOIN servicio_periodos sp ON sp.id = ps.servicio_periodo_id
JOIN servicios s ON s.id = ps.servicio_id
LEFT JOIN categorias c ON c.id = COALESCE(ps.categoria_id_snapshot, s.categoria_id);

CREATE OR REPLACE FUNCTION public.rebuild_dashboard_financial_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_ingresos_total NUMERIC;
  v_gastos_total NUMERIC;
  v_ingresos_por_mes JSONB;
  v_ingresos_por_dia JSONB;
  v_ingresos_por_categoria JSONB;
  v_ingresos_categorias_por_mes JSONB;
BEGIN
  WITH legacy_base AS (
    SELECT
      CASE
        WHEN lor.source_collection = 'pagosVenta' THEN 'ingresos'
        ELSE 'gastos'
      END AS kind,
      COALESCE(NULLIF(lor.payload ->> 'fechaInicio', ''), NULLIF(lor.payload ->> 'fecha', ''), NULLIF(lor.payload ->> 'createdAt', ''))::timestamptz::date AS fecha,
      COALESCE((lor.payload ->> 'monto')::numeric, (lor.payload ->> 'total')::numeric, 0) AS amount_original,
      UPPER(COALESCE(NULLIF(lor.payload ->> 'moneda', ''), 'USD')) AS currency,
      NULLIF(lor.payload ->> 'categoriaId', '') AS categoria_id
    FROM legacy_orphan_records lor
    WHERE lor.resolved_at IS NULL
      AND lor.source_collection IN ('pagosVenta', 'pagosServicio')
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
  daily AS (
    SELECT
      to_char(fecha, 'YYYY-MM-DD') AS dia,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS ingresos,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance
    WHERE date_trunc('month', fecha::timestamp) = date_trunc('month', current_date::timestamp)
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
  )
  SELECT
    (SELECT ingresos_total FROM totals),
    (SELECT gastos_total FROM totals),
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
    ), '[]'::jsonb)
  INTO
    v_ingresos_total,
    v_gastos_total,
    v_ingresos_por_mes,
    v_ingresos_por_dia,
    v_ingresos_por_categoria,
    v_ingresos_categorias_por_mes;

  INSERT INTO dashboard_stats (
    id,
    ingresos_total,
    gastos_total,
    ingresos_por_mes,
    ingresos_por_dia,
    ingresos_por_categoria,
    ingresos_categorias_por_mes,
    updated_at
  )
  VALUES (
    'singleton',
    v_ingresos_total,
    v_gastos_total,
    v_ingresos_por_mes,
    v_ingresos_por_dia,
    v_ingresos_por_categoria,
    v_ingresos_categorias_por_mes,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    ingresos_total = EXCLUDED.ingresos_total,
    gastos_total = EXCLUDED.gastos_total,
    ingresos_por_mes = EXCLUDED.ingresos_por_mes,
    ingresos_por_dia = EXCLUDED.ingresos_por_dia,
    ingresos_por_categoria = EXCLUDED.ingresos_por_categoria,
    ingresos_categorias_por_mes = EXCLUDED.ingresos_categorias_por_mes,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_dashboard_financial_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_dashboard_financial_stats() TO authenticated;
