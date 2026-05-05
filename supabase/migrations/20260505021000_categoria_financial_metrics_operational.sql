-- ============================================================================
-- Keep /servicios category metrics aligned with the Firebase category counters.
--
-- These are operational category metrics, not the complete historical dashboard:
-- - ingresos: pagos_venta linked to current ventas.categoria_id
-- - gastos: pagos_servicio linked to current servicios.categoria_id
-- - legacy_orphan_records are intentionally excluded here
-- - pagos_servicio categoria snapshots are intentionally ignored here
-- ============================================================================

CREATE OR REPLACE VIEW v_categoria_financial_metrics
WITH (security_invoker = true)
AS
WITH finance AS (
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
    s.categoria_id
  FROM pagos_servicio ps
  JOIN servicios s ON s.id = ps.servicio_id
  WHERE ps.estado = 'registrado'
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
