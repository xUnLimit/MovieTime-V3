-- ============================================================================
-- Expose refund destination in pagos_venta read model and backfill refund notes.
-- ============================================================================

UPDATE public.pagos_venta
SET notas = CASE
  WHEN NULLIF(BTRIM(COALESCE(notas, '')), '') IS NULL
    THEN 'Cuenta destino del cliente: ' || destino_reembolso
  WHEN notas NOT ILIKE '%Cuenta destino del cliente:%'
    THEN 'Cuenta destino del cliente: ' || destino_reembolso || E'\n\n' || notas
  ELSE notas
END
WHERE estado = 'reembolsado'
  AND NULLIF(BTRIM(COALESCE(destino_reembolso, '')), '') IS NOT NULL;

CREATE OR REPLACE VIEW public.v_pagos_venta_full
WITH (security_invoker = true)
AS
SELECT
  pv.id,
  pv.venta_periodo_id,
  pv.venta_id,
  pv.fecha_pago,
  pv.estado,
  pv.monto_original,
  pv.moneda_original,
  pv.monto_usd,
  pv.exchange_rate,
  pv.metodo_pago_id,
  pv.metodo_pago_nombre_snapshot,
  pv.notas,
  pv.created_at,
  pv.created_by,
  pv.anulada_at,
  pv.anulada_by,
  pv.motivo_anulacion,
  v.cliente_id,
  t.nombre || ' ' || t.apellido AS cliente_nombre,
  v.servicio_id,
  s.nombre AS servicio_nombre,
  v.categoria_id,
  c.nombre AS categoria_nombre,
  vp.numero_periodo,
  vp.fecha_inicio AS periodo_inicio,
  vp.fecha_fin AS periodo_fin,
  vp.ciclo_pago AS periodo_ciclo_pago,
  vp.precio_original,
  vp.descuento,
  pv.destino_reembolso
FROM public.pagos_venta pv
JOIN public.venta_periodos vp ON vp.id = pv.venta_periodo_id
JOIN public.ventas v ON v.id = pv.venta_id
LEFT JOIN public.terceros t ON t.id = v.cliente_id
LEFT JOIN public.servicios s ON s.id = v.servicio_id
LEFT JOIN public.categorias c ON c.id = v.categoria_id;

NOTIFY pgrst, 'reload schema';
