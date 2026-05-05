-- ============================================================================
-- Backfill venta notification payment-method snapshots.
-- ============================================================================

UPDATE notificaciones_venta nv
SET metodo_pago_nombre_snapshot = (
  SELECT pv.metodo_pago_nombre_snapshot
  FROM pagos_venta pv
  WHERE pv.venta_id = nv.venta_id
    AND pv.estado = 'registrado'
    AND pv.metodo_pago_nombre_snapshot IS NOT NULL
  ORDER BY pv.fecha_pago DESC, pv.created_at DESC
  LIMIT 1
)
WHERE (nv.metodo_pago_nombre_snapshot IS NULL OR nv.metodo_pago_nombre_snapshot = '');
