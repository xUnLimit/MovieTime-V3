-- ============================================================================
-- Category financial metrics for Servicios.
--
-- Mirrors dashboard financial logic so /servicios shows the same totals:
-- normalized payments, service-payment category snapshots, and preserved legacy
-- orphan payments assigned by their original categoriaId.
-- ============================================================================

CREATE OR REPLACE VIEW v_categoria_financial_metrics
WITH (security_invoker = true)
AS
WITH legacy_base AS (
  SELECT
    CASE
      WHEN lor.source_collection = 'pagosVenta' THEN 'ingresos'
      ELSE 'gastos'
    END AS kind,
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
    CASE
      WHEN lb.currency IN ('USD', 'PAB') THEN lb.amount_original
      WHEN direct.rate IS NOT NULL AND direct.rate > 0 THEN lb.amount_original * direct.rate
      WHEN inverse.rate IS NOT NULL AND inverse.rate > 0 THEN lb.amount_original / inverse.rate
      ELSE lb.amount_original
    END AS amount_usd,
    lb.categoria_id
  FROM legacy_base lb
  LEFT JOIN exchange_rates direct ON direct.currency_pair = lb.currency || '_USD'
  LEFT JOIN exchange_rates inverse ON inverse.currency_pair = 'USD_' || lb.currency
  WHERE lb.categoria_id IS NOT NULL
),
finance AS (
  SELECT
    'ingresos'::text AS kind,
    pv.monto_usd::numeric AS amount_usd,
    v.categoria_id
  FROM pagos_venta pv
  JOIN ventas v ON v.id = pv.venta_id
  WHERE pv.estado = 'registrado'

  UNION ALL

  SELECT
    'gastos'::text AS kind,
    ps.monto_usd::numeric AS amount_usd,
    COALESCE(ps.categoria_id_snapshot, s.categoria_id) AS categoria_id
  FROM pagos_servicio ps
  JOIN servicios s ON s.id = ps.servicio_id
  WHERE ps.estado = 'registrado'

  UNION ALL

  SELECT kind, amount_usd, categoria_id
  FROM legacy_finance
)
SELECT
  c.id AS categoria_id,
  c.nombre AS categoria_nombre,
  COALESCE(SUM(f.amount_usd) FILTER (WHERE f.kind = 'ingresos'), 0) AS ingresos_usd,
  COALESCE(SUM(f.amount_usd) FILTER (WHERE f.kind = 'gastos'), 0) AS gastos_usd,
  COALESCE(SUM(f.amount_usd) FILTER (WHERE f.kind = 'ingresos'), 0)
    - COALESCE(SUM(f.amount_usd) FILTER (WHERE f.kind = 'gastos'), 0) AS ganancia_usd
FROM categorias c
LEFT JOIN finance f ON f.categoria_id = c.id
GROUP BY c.id, c.nombre;
