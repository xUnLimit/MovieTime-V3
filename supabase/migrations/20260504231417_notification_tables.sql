-- ============================================================================
-- 004_notification_tables.sql
-- Tablas de notificaciones, activity_log, templates, config, dashboard_stats,
-- legacy_orphan_records.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notificaciones (base) + tablas detalle por entidad.
-- dedupe_key permite idempotencia en sync-notifications.
-- ----------------------------------------------------------------------------
CREATE TABLE notificaciones (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dedupe_key TEXT UNIQUE NOT NULL,
  entidad notificacion_entidad_enum NOT NULL,
  tipo TEXT NOT NULL,
  prioridad notificacion_prioridad_enum NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT,
  dias_restantes INTEGER,
  scheduled_for DATE,
  leida BOOLEAN NOT NULL DEFAULT false,
  resaltada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE TABLE notificaciones_venta (
  notificacion_id TEXT PRIMARY KEY REFERENCES notificaciones(id) ON DELETE CASCADE,
  venta_id TEXT NOT NULL REFERENCES ventas(id) ON DELETE RESTRICT,
  venta_periodo_id TEXT REFERENCES venta_periodos(id) ON DELETE SET NULL,
  cliente_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  servicio_id TEXT REFERENCES servicios(id) ON DELETE SET NULL,
  categoria_id TEXT REFERENCES categorias(id) ON DELETE SET NULL,
  cliente_nombre_snapshot TEXT NOT NULL,
  cliente_telefono_snapshot TEXT,
  servicio_nombre_snapshot TEXT NOT NULL,
  servicio_correo_snapshot TEXT,
  servicio_contrasena_snapshot TEXT,
  categoria_nombre_snapshot TEXT,
  perfil_nombre_snapshot TEXT,
  codigo_snapshot TEXT,
  fecha_inicio_snapshot DATE,
  fecha_fin_snapshot DATE,
  ciclo_pago_snapshot ciclo_pago_enum,
  precio_final_snapshot NUMERIC(12,2),
  moneda_snapshot TEXT,
  metodo_pago_nombre_snapshot TEXT
);

CREATE TABLE notificaciones_servicio (
  notificacion_id TEXT PRIMARY KEY REFERENCES notificaciones(id) ON DELETE CASCADE,
  servicio_id TEXT NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  servicio_periodo_id TEXT REFERENCES servicio_periodos(id) ON DELETE SET NULL,
  categoria_id TEXT REFERENCES categorias(id) ON DELETE SET NULL,
  servicio_nombre_snapshot TEXT NOT NULL,
  servicio_correo_snapshot TEXT,
  servicio_contrasena_snapshot TEXT,
  categoria_nombre_snapshot TEXT,
  fecha_inicio_snapshot DATE,
  fecha_vencimiento_snapshot DATE,
  ciclo_pago_snapshot ciclo_pago_enum,
  costo_servicio_snapshot NUMERIC(12,2),
  moneda_snapshot TEXT,
  metodo_pago_nombre_snapshot TEXT,
  renovacion_automatica_snapshot BOOLEAN
);

CREATE TABLE notificaciones_reposo (
  notificacion_id TEXT PRIMARY KEY REFERENCES notificaciones(id) ON DELETE CASCADE,
  servicio_id TEXT NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  categoria_id TEXT REFERENCES categorias(id) ON DELETE SET NULL,
  servicio_nombre_snapshot TEXT NOT NULL,
  servicio_correo_snapshot TEXT,
  servicio_contrasena_snapshot TEXT,
  categoria_nombre_snapshot TEXT,
  dias_reposo_snapshot INTEGER,
  fecha_inicio_reposo_snapshot DATE,
  fecha_fin_reposo_snapshot DATE
);

-- ----------------------------------------------------------------------------
-- activity_log: auditoria. entidad_id sin FK porque debe sobrevivir al borrado.
-- ----------------------------------------------------------------------------
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  usuario_email TEXT NOT NULL,
  accion accion_log_enum NOT NULL,
  entidad entidad_log_enum NOT NULL,
  entidad_id TEXT NOT NULL,
  entidad_nombre TEXT NOT NULL,
  detalles TEXT NOT NULL,
  cambios JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- templates + template_placeholders.
-- ----------------------------------------------------------------------------
CREATE TABLE templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL,
  tipo tipo_template_enum NOT NULL,
  contenido TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_placeholders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  placeholder TEXT NOT NULL,
  UNIQUE (template_id, placeholder)
);

-- ----------------------------------------------------------------------------
-- config: singleton 'global'. Sin config_dias_notificacion (deprecado).
-- ----------------------------------------------------------------------------
CREATE TABLE config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  notificaciones_dias_anticipacion INTEGER NOT NULL DEFAULT 7
    CHECK (notificaciones_dias_anticipacion BETWEEN 1 AND 60),
  hora_envio INTEGER NOT NULL DEFAULT 9
    CHECK (hora_envio BETWEEN 0 AND 23),
  whatsapp_prefijo TEXT NOT NULL DEFAULT '+507',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- dashboard_stats: cache regenerable, NO fuente de verdad.
-- ----------------------------------------------------------------------------
CREATE TABLE dashboard_stats (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  gastos_total NUMERIC(16,4) NOT NULL DEFAULT 0,
  ingresos_total NUMERIC(16,4) NOT NULL DEFAULT 0,
  usuarios_por_mes JSONB NOT NULL DEFAULT '[]',
  usuarios_por_dia JSONB NOT NULL DEFAULT '[]',
  ingresos_por_mes JSONB NOT NULL DEFAULT '[]',
  ingresos_por_dia JSONB NOT NULL DEFAULT '[]',
  ingresos_por_categoria JSONB NOT NULL DEFAULT '[]',
  ingresos_categorias_por_mes JSONB NOT NULL DEFAULT '[]',
  ventas_pronostico JSONB NOT NULL DEFAULT '[]',
  servicios_pronostico JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- legacy_orphan_records: huerfanos detectados durante migracion Firestore.
-- Fuera del flujo operacional; solo para preservacion/auditoria.
-- ----------------------------------------------------------------------------
CREATE TABLE legacy_orphan_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_collection TEXT NOT NULL,
  source_id TEXT NOT NULL,
  orphan_reason TEXT NOT NULL,
  payload JSONB NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  UNIQUE (source_collection, source_id)
);
