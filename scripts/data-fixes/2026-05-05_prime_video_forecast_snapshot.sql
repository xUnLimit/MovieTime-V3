-- ============================================================================
-- Data fix: restore Prime Video pre-discount forecast price.
--
-- Firebase dashboard_stats.ventasPronostico kept this sale at the pre-discount
-- price (2.00) while the registered payment amount remains 1.80. Real income
-- totals continue to come from pagos_venta.monto_usd; this only affects the
-- monthly expected income forecast.
--
-- Run once against the MovieTime production dataset.
-- ============================================================================

UPDATE venta_periodos
SET precio_original = 2.00
WHERE id = (
  SELECT venta_periodo_id
  FROM pagos_venta
  WHERE id = 'OUJrzjK0zVKignHI2Uey'
);
