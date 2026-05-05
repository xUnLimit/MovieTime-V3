-- ============================================================================
-- 005_indexes.sql
-- Indices minimos para no degradar UX. Indices unicos parciales reemplazan
-- contadores denormalizados (ej. perfil ocupado por una sola venta activa).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- servicios
-- ----------------------------------------------------------------------------
CREATE INDEX idx_servicios_operativos
  ON servicios(categoria_id, activo)
  WHERE archivado_at IS NULL;

CREATE INDEX idx_servicios_activos_no_archivados
  ON servicios(activo)
  WHERE archivado_at IS NULL AND activo = true;

-- ----------------------------------------------------------------------------
-- ventas
-- Una venta activa por (servicio, perfil) para evitar doble asignacion.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX idx_ventas_servicio_perfil_activo
  ON ventas(servicio_id, perfil_numero)
  WHERE estado = 'activo'
    AND perfil_numero IS NOT NULL
    AND archivado_at IS NULL;

CREATE INDEX idx_ventas_cliente_operativas
  ON ventas(cliente_id, estado)
  WHERE archivado_at IS NULL;

CREATE INDEX idx_ventas_servicio
  ON ventas(servicio_id)
  WHERE archivado_at IS NULL;

-- ----------------------------------------------------------------------------
-- venta_periodos
-- ----------------------------------------------------------------------------
CREATE INDEX idx_venta_periodos_venta_numero
  ON venta_periodos(venta_id, numero_periodo DESC);

CREATE INDEX idx_venta_periodos_fecha_fin
  ON venta_periodos(fecha_fin);

-- ----------------------------------------------------------------------------
-- servicio_periodos
-- ----------------------------------------------------------------------------
CREATE INDEX idx_servicio_periodos_servicio_numero
  ON servicio_periodos(servicio_id, numero_periodo DESC);

CREATE INDEX idx_servicio_periodos_fecha_vencimiento
  ON servicio_periodos(fecha_vencimiento);

-- ----------------------------------------------------------------------------
-- pagos_venta
-- ----------------------------------------------------------------------------
CREATE INDEX idx_pagos_venta_periodo
  ON pagos_venta(venta_periodo_id);

CREATE INDEX idx_pagos_venta_venta
  ON pagos_venta(venta_id);

CREATE INDEX idx_pagos_venta_fecha
  ON pagos_venta(fecha_pago DESC)
  WHERE estado = 'registrado';

-- ----------------------------------------------------------------------------
-- pagos_servicio
-- ----------------------------------------------------------------------------
CREATE INDEX idx_pagos_servicio_periodo
  ON pagos_servicio(servicio_periodo_id);

CREATE INDEX idx_pagos_servicio_servicio
  ON pagos_servicio(servicio_id);

CREATE INDEX idx_pagos_servicio_fecha
  ON pagos_servicio(fecha_pago DESC)
  WHERE estado = 'registrado';

-- ----------------------------------------------------------------------------
-- gastos
-- ----------------------------------------------------------------------------
CREATE INDEX idx_gastos_fecha
  ON gastos(fecha DESC);

CREATE INDEX idx_gastos_tipo
  ON gastos(tipo_gasto_id);

-- ----------------------------------------------------------------------------
-- usuarios
-- ----------------------------------------------------------------------------
CREATE INDEX idx_usuarios_tipo_active
  ON usuarios(tipo, active);

CREATE INDEX idx_usuarios_metodo_pago
  ON usuarios(metodo_pago_id)
  WHERE metodo_pago_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- categorias / planes
-- ----------------------------------------------------------------------------
CREATE INDEX idx_planes_tipos_categoria
  ON planes_tipos(categoria_id, activo);

CREATE INDEX idx_planes_categoria_tipo
  ON planes(categoria_id, plan_tipo_id, activo);

-- ----------------------------------------------------------------------------
-- metodos_pago
-- ----------------------------------------------------------------------------
CREATE INDEX idx_metodos_pago_asociado_activo
  ON metodos_pago(asociado_a, activo);

-- ----------------------------------------------------------------------------
-- notificaciones
-- ----------------------------------------------------------------------------
CREATE INDEX idx_notificaciones_pendientes
  ON notificaciones(scheduled_for, prioridad)
  WHERE leida = false AND dismissed_at IS NULL;

CREATE INDEX idx_notificaciones_entidad_tipo
  ON notificaciones(entidad, tipo);

CREATE INDEX idx_notificaciones_venta_venta
  ON notificaciones_venta(venta_id);

CREATE INDEX idx_notificaciones_servicio_servicio
  ON notificaciones_servicio(servicio_id);

CREATE INDEX idx_notificaciones_reposo_servicio
  ON notificaciones_reposo(servicio_id);

-- ----------------------------------------------------------------------------
-- activity_log
-- ----------------------------------------------------------------------------
CREATE INDEX idx_activity_log_timestamp
  ON activity_log(timestamp DESC);

CREATE INDEX idx_activity_log_entidad
  ON activity_log(entidad, entidad_id);

-- ----------------------------------------------------------------------------
-- legacy_orphan_records
-- ----------------------------------------------------------------------------
CREATE INDEX idx_legacy_orphan_unresolved
  ON legacy_orphan_records(source_collection)
  WHERE resolved_at IS NULL;
