-- ============================================================================
-- 007_views.sql
-- Vistas para UI (con security_invoker = true) y vistas de metricas.
-- Las vistas operativas excluyen archivados por defecto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- v_categoria_counters: reemplaza los contadores denormalizados de Firestore.
-- ----------------------------------------------------------------------------
CREATE VIEW v_categoria_counters
WITH (security_invoker = true)
AS
SELECT
  c.id AS categoria_id,
  c.nombre AS categoria_nombre,
  COUNT(s.id) FILTER (WHERE s.archivado_at IS NULL) AS total_servicios,
  COUNT(s.id) FILTER (WHERE s.archivado_at IS NULL AND s.activo = true) AS servicios_activos,
  COALESCE(
    SUM(s.perfiles_disponibles - s.perfiles_ocupados)
      FILTER (WHERE s.archivado_at IS NULL AND s.activo = true),
    0
  ) AS perfiles_disponibles_total
FROM categorias c
LEFT JOIN servicios s ON s.categoria_id = c.id
GROUP BY c.id, c.nombre;

-- ----------------------------------------------------------------------------
-- v_usuarios_servicios_activos: reemplaza usuarios.serviciosActivos.
-- ----------------------------------------------------------------------------
CREATE VIEW v_usuarios_servicios_activos
WITH (security_invoker = true)
AS
SELECT
  u.id AS usuario_id,
  u.nombre,
  u.apellido,
  u.tipo,
  COUNT(v.id) FILTER (
    WHERE v.estado = 'activo' AND v.archivado_at IS NULL
  ) AS servicios_activos
FROM usuarios u
LEFT JOIN ventas v ON v.cliente_id = u.id
GROUP BY u.id, u.nombre, u.apellido, u.tipo;

-- ----------------------------------------------------------------------------
-- v_servicios_disponibilidad
-- ----------------------------------------------------------------------------
CREATE VIEW v_servicios_disponibilidad
WITH (security_invoker = true)
AS
SELECT
  s.id AS servicio_id,
  s.nombre,
  s.categoria_id,
  s.perfiles_disponibles,
  s.perfiles_ocupados,
  (s.perfiles_disponibles - s.perfiles_ocupados) AS perfiles_libres,
  s.activo,
  s.en_reposo
FROM servicios s
WHERE s.archivado_at IS NULL;

-- ----------------------------------------------------------------------------
-- v_venta_periodos_full: periodo + estado de pago calculado.
-- ----------------------------------------------------------------------------
CREATE VIEW v_venta_periodos_full
WITH (security_invoker = true)
AS
SELECT
  vp.*,
  COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) AS pagado_usd,
  COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'reembolsado'), 0) AS reembolsado_usd,
  vp.total_usd
    - COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0)
    + COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'reembolsado'), 0)
    AS saldo_usd,
  CASE
    WHEN COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) = 0
      THEN 'pendiente'
    WHEN COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) < vp.total_usd
      THEN 'parcial'
    WHEN COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) = vp.total_usd
      THEN 'pagado'
    ELSE 'sobrepagado'
  END AS estado_pago
FROM venta_periodos vp
LEFT JOIN pagos_venta pv ON pv.venta_periodo_id = vp.id
GROUP BY vp.id;

-- ----------------------------------------------------------------------------
-- v_servicio_periodos_full
-- ----------------------------------------------------------------------------
CREATE VIEW v_servicio_periodos_full
WITH (security_invoker = true)
AS
SELECT
  sp.*,
  COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) AS pagado_usd,
  COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'reembolsado'), 0) AS reembolsado_usd,
  sp.costo_usd
    - COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0)
    + COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'reembolsado'), 0)
    AS saldo_usd,
  CASE
    WHEN COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) = 0
      THEN 'pendiente'
    WHEN COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) < sp.costo_usd
      THEN 'parcial'
    WHEN COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) = sp.costo_usd
      THEN 'pagado'
    ELSE 'sobrepagado'
  END AS estado_pago
FROM servicio_periodos sp
LEFT JOIN pagos_servicio ps ON ps.servicio_periodo_id = sp.id
GROUP BY sp.id;

-- ----------------------------------------------------------------------------
-- v_ventas_full: venta + ultimo periodo vigente + datos del cliente/servicio.
-- Excluye archivados.
-- ----------------------------------------------------------------------------
CREATE VIEW v_ventas_full
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
  vp_last.plan_tipo_nombre_snapshot AS ultimo_plan_tipo_nombre
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
WHERE v.archivado_at IS NULL;

-- ----------------------------------------------------------------------------
-- v_servicios_full: servicio + ultimo periodo vigente.
-- ----------------------------------------------------------------------------
CREATE VIEW v_servicios_full
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
  sp_last.renovacion_automatica AS ultima_renovacion_automatica
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
WHERE s.archivado_at IS NULL;

-- ----------------------------------------------------------------------------
-- v_pagos_venta_full y v_pagos_servicio_full
-- ----------------------------------------------------------------------------
CREATE VIEW v_pagos_venta_full
WITH (security_invoker = true)
AS
SELECT
  pv.*,
  v.cliente_id,
  u.nombre || ' ' || u.apellido AS cliente_nombre,
  v.servicio_id,
  s.nombre AS servicio_nombre,
  v.categoria_id,
  c.nombre AS categoria_nombre,
  vp.numero_periodo,
  vp.fecha_inicio AS periodo_inicio,
  vp.fecha_fin AS periodo_fin
FROM pagos_venta pv
JOIN venta_periodos vp ON vp.id = pv.venta_periodo_id
JOIN ventas v ON v.id = pv.venta_id
LEFT JOIN usuarios u ON u.id = v.cliente_id
LEFT JOIN servicios s ON s.id = v.servicio_id
LEFT JOIN categorias c ON c.id = v.categoria_id;

CREATE VIEW v_pagos_servicio_full
WITH (security_invoker = true)
AS
SELECT
  ps.*,
  s.nombre AS servicio_nombre,
  s.categoria_id,
  c.nombre AS categoria_nombre,
  sp.numero_periodo,
  sp.fecha_inicio AS periodo_inicio,
  sp.fecha_vencimiento AS periodo_vencimiento
FROM pagos_servicio ps
JOIN servicio_periodos sp ON sp.id = ps.servicio_periodo_id
JOIN servicios s ON s.id = ps.servicio_id
LEFT JOIN categorias c ON c.id = s.categoria_id;

-- ----------------------------------------------------------------------------
-- v_gastos_full
-- ----------------------------------------------------------------------------
CREATE VIEW v_gastos_full
WITH (security_invoker = true)
AS
SELECT
  g.*,
  tg.nombre AS tipo_gasto_nombre
FROM gastos g
JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id;

-- ----------------------------------------------------------------------------
-- Vistas de notificaciones por entidad
-- ----------------------------------------------------------------------------
CREATE VIEW v_notificaciones_venta
WITH (security_invoker = true)
AS
SELECT
  n.*,
  nv.venta_id,
  nv.venta_periodo_id,
  nv.cliente_id,
  nv.servicio_id,
  nv.categoria_id,
  nv.cliente_nombre_snapshot,
  nv.cliente_telefono_snapshot,
  nv.servicio_nombre_snapshot,
  nv.servicio_correo_snapshot,
  nv.servicio_contrasena_snapshot,
  nv.categoria_nombre_snapshot,
  nv.perfil_nombre_snapshot,
  nv.codigo_snapshot,
  nv.fecha_inicio_snapshot,
  nv.fecha_fin_snapshot,
  nv.ciclo_pago_snapshot,
  nv.precio_final_snapshot,
  nv.moneda_snapshot,
  nv.metodo_pago_nombre_snapshot
FROM notificaciones n
JOIN notificaciones_venta nv ON nv.notificacion_id = n.id
WHERE n.entidad = 'venta';

CREATE VIEW v_notificaciones_servicio
WITH (security_invoker = true)
AS
SELECT
  n.*,
  ns.servicio_id,
  ns.servicio_periodo_id,
  ns.categoria_id,
  ns.servicio_nombre_snapshot,
  ns.servicio_correo_snapshot,
  ns.servicio_contrasena_snapshot,
  ns.categoria_nombre_snapshot,
  ns.fecha_inicio_snapshot,
  ns.fecha_vencimiento_snapshot,
  ns.ciclo_pago_snapshot,
  ns.costo_servicio_snapshot,
  ns.moneda_snapshot,
  ns.metodo_pago_nombre_snapshot,
  ns.renovacion_automatica_snapshot
FROM notificaciones n
JOIN notificaciones_servicio ns ON ns.notificacion_id = n.id
WHERE n.entidad = 'servicio';

CREATE VIEW v_notificaciones_reposo
WITH (security_invoker = true)
AS
SELECT
  n.*,
  nr.servicio_id,
  nr.categoria_id,
  nr.servicio_nombre_snapshot,
  nr.servicio_correo_snapshot,
  nr.servicio_contrasena_snapshot,
  nr.categoria_nombre_snapshot,
  nr.dias_reposo_snapshot,
  nr.fecha_inicio_reposo_snapshot,
  nr.fecha_fin_reposo_snapshot
FROM notificaciones n
JOIN notificaciones_reposo nr ON nr.notificacion_id = n.id
WHERE n.entidad = 'reposo';

-- ----------------------------------------------------------------------------
-- Vistas de archivados (auditoria/historial)
-- ----------------------------------------------------------------------------
CREATE VIEW v_ventas_archivadas
WITH (security_invoker = true)
AS
SELECT
  v.*,
  u.nombre || ' ' || u.apellido AS cliente_nombre,
  s.nombre AS servicio_nombre,
  c.nombre AS categoria_nombre
FROM ventas v
LEFT JOIN usuarios u ON u.id = v.cliente_id
LEFT JOIN servicios s ON s.id = v.servicio_id
LEFT JOIN categorias c ON c.id = v.categoria_id
WHERE v.archivado_at IS NOT NULL;

CREATE VIEW v_servicios_archivados
WITH (security_invoker = true)
AS
SELECT
  s.*,
  c.nombre AS categoria_nombre
FROM servicios s
LEFT JOIN categorias c ON c.id = s.categoria_id
WHERE s.archivado_at IS NOT NULL;
