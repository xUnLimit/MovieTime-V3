-- ============================================================================
-- List read-model fields used by server-side pagination/search.
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
  GREATEST(COALESCE(vp_last.numero_periodo, 1) - 1, 0) AS renovaciones
FROM ventas v
LEFT JOIN usuarios u ON u.id = v.cliente_id
LEFT JOIN servicios s ON s.id = v.servicio_id
LEFT JOIN categorias c ON c.id = v.categoria_id
LEFT JOIN LATERAL (
  SELECT vp.*
  FROM venta_periodos vp
  WHERE vp.venta_id = v.id
  ORDER BY vp.numero_periodo DESC
  LIMIT 1
) vp_last ON true
LEFT JOIN LATERAL (
  SELECT pv.*
  FROM pagos_venta pv
  WHERE pv.venta_id = v.id
    AND pv.estado = 'registrado'
  ORDER BY pv.fecha_pago DESC, pv.created_at DESC
  LIMIT 1
) pv_last ON true
WHERE v.archivado_at IS NULL;

CREATE OR REPLACE VIEW public.v_servicios_full
WITH (security_invoker = true)
AS
SELECT
  s.*,
  c.nombre AS categoria_nombre,
  pt.nombre AS plan_tipo_nombre,
  sp_last.id AS ultimo_periodo_id,
  sp_last.numero_periodo AS ultimo_numero_periodo,
  sp_last.fecha_inicio AS ultima_fecha_inicio,
  sp_last.fecha_vencimiento AS ultima_fecha_vencimiento,
  sp_last.ciclo_pago AS ultimo_ciclo_pago,
  sp_last.costo_original AS ultimo_costo_original,
  sp_last.moneda_original AS ultima_moneda,
  sp_last.costo_usd AS ultimo_costo_usd,
  sp_last.renovacion_automatica AS ultima_renovacion_automatica,
  ps_last.metodo_pago_id AS ultimo_metodo_pago_id,
  ps_last.metodo_pago_nombre_snapshot AS ultimo_metodo_pago_nombre,
  GREATEST(COALESCE(sp_last.numero_periodo, 1) - 1, 0) AS renovaciones,
  GREATEST(COALESCE(s.perfiles_disponibles, 0) - COALESCE(s.perfiles_ocupados, 0), 0) AS perfiles_libres
FROM servicios s
LEFT JOIN categorias c ON c.id = s.categoria_id
LEFT JOIN planes_tipos pt ON pt.id = s.plan_tipo_id
LEFT JOIN LATERAL (
  SELECT sp.*
  FROM servicio_periodos sp
  WHERE sp.servicio_id = s.id
  ORDER BY sp.numero_periodo DESC
  LIMIT 1
) sp_last ON true
LEFT JOIN LATERAL (
  SELECT ps.*
  FROM pagos_servicio ps
  WHERE ps.servicio_id = s.id
    AND ps.estado = 'registrado'
  ORDER BY ps.fecha_pago DESC, ps.created_at DESC
  LIMIT 1
) ps_last ON true
WHERE s.archivado_at IS NULL;
