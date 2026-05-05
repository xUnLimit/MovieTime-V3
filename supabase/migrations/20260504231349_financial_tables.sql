-- ============================================================================
-- 003_financial_tables.sql
-- Tablas financieras: servicio_periodos, pagos_servicio, ventas, venta_periodos,
-- pagos_venta, tipos_gasto, gastos.
-- Todo hecho financiero conserva monto_original / moneda_original / monto_usd /
-- exchange_rate (o sus equivalentes total_*, costo_*).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- servicio_periodos: cada compra o renovacion del servicio.
-- ----------------------------------------------------------------------------
CREATE TABLE servicio_periodos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  servicio_id TEXT NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  numero_periodo INTEGER NOT NULL,
  tipo periodo_tipo_enum NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  ciclo_pago ciclo_pago_enum NOT NULL,
  costo_original NUMERIC(12,2) NOT NULL CHECK (costo_original >= 0),
  moneda_original TEXT NOT NULL REFERENCES currencies(code),
  costo_usd NUMERIC(16,4) NOT NULL CHECK (costo_usd >= 0),
  exchange_rate NUMERIC(20,8),
  renovacion_automatica BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (servicio_id, numero_periodo),
  CHECK (fecha_vencimiento >= fecha_inicio)
);

-- ----------------------------------------------------------------------------
-- pagos_servicio: pago real al proveedor. Puede haber varios pagos por periodo
-- (parciales, correcciones). El estado financiero se calcula con vistas.
-- ----------------------------------------------------------------------------
CREATE TABLE pagos_servicio (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  servicio_periodo_id TEXT NOT NULL REFERENCES servicio_periodos(id) ON DELETE RESTRICT,
  servicio_id TEXT NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado pago_estado_enum NOT NULL DEFAULT 'registrado',
  monto_original NUMERIC(12,2) NOT NULL CHECK (monto_original >= 0),
  moneda_original TEXT NOT NULL REFERENCES currencies(code),
  monto_usd NUMERIC(16,4) NOT NULL CHECK (monto_usd >= 0),
  exchange_rate NUMERIC(20,8),
  metodo_pago_id TEXT REFERENCES metodos_pago(id) ON DELETE SET NULL,
  metodo_pago_nombre_snapshot TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  anulada_at TIMESTAMPTZ,
  anulada_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  motivo_anulacion TEXT,
  CHECK (
    (estado = 'registrado' AND anulada_at IS NULL)
    OR (estado IN ('anulado','reembolsado') AND anulada_at IS NOT NULL)
  )
);

-- ----------------------------------------------------------------------------
-- ventas: asignacion del cliente a servicio/perfil.
-- categoria_id es snapshot del momento de creacion; se llena por trigger
-- desde servicios.categoria_id en BEFORE INSERT.
-- ----------------------------------------------------------------------------
CREATE TABLE ventas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cliente_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  servicio_id TEXT NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  estado venta_estado_enum NOT NULL DEFAULT 'activo',
  perfil_numero INTEGER,
  perfil_nombre TEXT,
  codigo TEXT,
  cortada_at TIMESTAMPTZ,
  cortada_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  motivo_corte TEXT,
  archivado_at TIMESTAMPTZ,
  archivado_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  motivo_archivado TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CHECK (
    (estado = 'activo' AND cortada_at IS NULL)
    OR estado = 'inactivo'
  )
);

-- ----------------------------------------------------------------------------
-- venta_periodos: cada periodo vendido o renovado.
-- ----------------------------------------------------------------------------
CREATE TABLE venta_periodos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  venta_id TEXT NOT NULL REFERENCES ventas(id) ON DELETE RESTRICT,
  numero_periodo INTEGER NOT NULL,
  tipo periodo_tipo_enum NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  ciclo_pago ciclo_pago_enum NOT NULL,
  plan_id TEXT REFERENCES planes(id) ON DELETE SET NULL,
  plan_nombre_snapshot TEXT,
  plan_tipo_nombre_snapshot TEXT,
  precio_original NUMERIC(12,2) NOT NULL CHECK (precio_original >= 0),
  descuento NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0 AND descuento <= 100),
  total_original NUMERIC(12,2) NOT NULL CHECK (total_original >= 0),
  moneda_original TEXT NOT NULL REFERENCES currencies(code),
  total_usd NUMERIC(16,4) NOT NULL CHECK (total_usd >= 0),
  exchange_rate NUMERIC(20,8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (venta_id, numero_periodo),
  CHECK (fecha_fin >= fecha_inicio)
);

-- ----------------------------------------------------------------------------
-- pagos_venta: cobro real al cliente. Puede haber varios pagos por periodo.
-- ----------------------------------------------------------------------------
CREATE TABLE pagos_venta (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  venta_periodo_id TEXT NOT NULL REFERENCES venta_periodos(id) ON DELETE RESTRICT,
  venta_id TEXT NOT NULL REFERENCES ventas(id) ON DELETE RESTRICT,
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado pago_estado_enum NOT NULL DEFAULT 'registrado',
  monto_original NUMERIC(12,2) NOT NULL CHECK (monto_original >= 0),
  moneda_original TEXT NOT NULL REFERENCES currencies(code),
  monto_usd NUMERIC(16,4) NOT NULL CHECK (monto_usd >= 0),
  exchange_rate NUMERIC(20,8),
  metodo_pago_id TEXT REFERENCES metodos_pago(id) ON DELETE SET NULL,
  metodo_pago_nombre_snapshot TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  anulada_at TIMESTAMPTZ,
  anulada_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  motivo_anulacion TEXT,
  CHECK (
    (estado = 'registrado' AND anulada_at IS NULL)
    OR (estado IN ('anulado','reembolsado') AND anulada_at IS NOT NULL)
  )
);

-- ----------------------------------------------------------------------------
-- tipos_gasto: catalogo de tipos.
-- ----------------------------------------------------------------------------
CREATE TABLE tipos_gasto (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- gastos: sin tipoGastoNombre denormalizado.
-- ----------------------------------------------------------------------------
CREATE TABLE gastos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tipo_gasto_id TEXT NOT NULL REFERENCES tipos_gasto(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  monto_original NUMERIC(12,2) NOT NULL CHECK (monto_original >= 0),
  moneda_original TEXT NOT NULL REFERENCES currencies(code),
  monto_usd NUMERIC(16,4) NOT NULL CHECK (monto_usd >= 0),
  exchange_rate NUMERIC(20,8),
  detalle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);
