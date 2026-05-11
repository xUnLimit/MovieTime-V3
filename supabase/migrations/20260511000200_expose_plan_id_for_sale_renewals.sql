-- ============================================================================
-- 20260511000200_expose_plan_id_for_sale_renewals.sql
--
-- Renewal flows need the latest venta_periodos.plan_id so the frontend can
-- preserve the selected plan when creating the next payment period.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_ventas_full
WITH (security_invoker = true)
AS
SELECT
  v.*,
  u.nombre || ' ' || u.apellido AS cliente_nombre,
  u.telefono AS cliente_telefono,
  s.nombre AS servicio_nombre,
  s.correo AS servicio_correo,
  c.nombre AS categoria_nombre,
  vp_last.id AS ultimo_periodo_id,
  vp_last.numero_periodo AS ultimo_numero_periodo,
  vp_last.fecha_inicio AS ultima_fecha_inicio,
  vp_last.fecha_fin AS ultima_fecha_fin,
  vp_last.ciclo_pago AS ultimo_ciclo_pago,
  vp_last.total_original AS ultimo_total_original,
  vp_last.moneda_original AS ultima_moneda,
  vp_last.total_usd AS ultimo_total_usd,
  vp_last.plan_nombre_snapshot AS ultimo_plan_nombre,
  vp_last.plan_tipo_nombre_snapshot AS ultimo_plan_tipo_nombre,
  s.contrasena AS servicio_contrasena,
  pv_last.metodo_pago_id AS ultimo_metodo_pago_id,
  pv_last.metodo_pago_nombre_snapshot AS ultimo_metodo_pago_nombre,
  vp_last.precio_original AS ultimo_precio_original,
  vp_last.descuento AS ultimo_descuento,
  GREATEST(COALESCE(vp_last.numero_periodo, 1) - 1, 0) AS renovaciones,
  vp_last.plan_id AS ultimo_plan_id
FROM public.ventas v
LEFT JOIN public.usuarios u ON u.id = v.cliente_id
LEFT JOIN public.servicios s ON s.id = v.servicio_id
LEFT JOIN public.categorias c ON c.id = v.categoria_id
LEFT JOIN LATERAL (
  SELECT vp.*
  FROM public.venta_periodos vp
  WHERE vp.venta_id = v.id
  ORDER BY vp.numero_periodo DESC
  LIMIT 1
) vp_last ON true
LEFT JOIN LATERAL (
  SELECT pv.*
  FROM public.pagos_venta pv
  WHERE pv.venta_id = v.id
    AND pv.estado = 'registrado'
  ORDER BY pv.fecha_pago DESC, pv.created_at DESC
  LIMIT 1
) pv_last ON true
WHERE v.archivado_at IS NULL;
