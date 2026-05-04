-- ============================================================================
-- 002_core_tables.sql
-- Tablas base: profiles, currencies, exchange_rates, metodos_pago, categorias,
-- planes_tipos, planes, usuarios, servicios.
-- Las financieras (servicio_periodos, pagos_*, ventas, venta_periodos, gastos)
-- viven en 003_financial_tables.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: extiende auth.users.
-- ----------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin','operador')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- currencies: catalogo de monedas soportadas.
-- ----------------------------------------------------------------------------
CREATE TABLE currencies (
  code TEXT PRIMARY KEY,
  nombre TEXT,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- ----------------------------------------------------------------------------
-- exchange_rates: tasa actual / cache. No conserva historial,
-- cada hecho financiero guarda la tasa usada en su propio registro.
-- ----------------------------------------------------------------------------
CREATE TABLE exchange_rates (
  currency_pair TEXT PRIMARY KEY,
  rate NUMERIC(20,8) NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'open.er-api.com'
);

-- ----------------------------------------------------------------------------
-- metodos_pago: catalogo de metodos. asociado_a segrega usuario vs servicio.
-- ----------------------------------------------------------------------------
CREATE TABLE metodos_pago (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL,
  tipo metodo_pago_tipo_enum NOT NULL,
  banco TEXT,
  pais TEXT NOT NULL DEFAULT 'PA',
  moneda TEXT NOT NULL REFERENCES currencies(code),
  titular TEXT NOT NULL,
  tipo_cuenta tipo_cuenta_enum,
  identificador TEXT NOT NULL,
  alias TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  asociado_a asociado_a_enum,
  email TEXT,
  contrasena TEXT,
  numero_tarjeta TEXT,
  fecha_expiracion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- categorias: sin arrays embebidos, sin counters, sin icon_url ni color.
-- ----------------------------------------------------------------------------
CREATE TABLE categorias (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL,
  tipo categoria_tipo_enum NOT NULL,
  tipo_categoria categoria_tipo_cat_enum,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- planes_tipos: extraido de Categoria.tiposPlanes[].
-- UNIQUE (id, categoria_id) habilita FK compuesta desde planes/servicios.
-- ----------------------------------------------------------------------------
CREATE TABLE planes_tipos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nombre TEXT NOT NULL,
  orden INTEGER,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (categoria_id, nombre),
  UNIQUE (id, categoria_id)
);

-- ----------------------------------------------------------------------------
-- planes: extraido de Categoria.planes[]. precio = precio actual; el historial
-- comercial vive en venta_periodos.
-- ----------------------------------------------------------------------------
CREATE TABLE planes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  plan_tipo_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  ciclo_pago ciclo_pago_enum NOT NULL,
  orden INTEGER,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (categoria_id, plan_tipo_id, nombre),
  FOREIGN KEY (plan_tipo_id, categoria_id)
    REFERENCES planes_tipos(id, categoria_id)
    ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- usuarios: sin metodoPagoNombre, moneda, ni serviciosActivos.
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  tipo usuario_tipo_enum NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  metodo_pago_id TEXT REFERENCES metodos_pago(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- servicios: la cuenta/recurso que MovieTime administra.
-- No es la fuente historica de costos (eso vive en servicio_periodos).
-- perfiles_ocupados se recalcula desde ventas activas via trigger.
-- ----------------------------------------------------------------------------
CREATE TABLE servicios (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  plan_tipo_id TEXT,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  contrasena TEXT NOT NULL,
  perfiles_disponibles INTEGER NOT NULL DEFAULT 0 CHECK (perfiles_disponibles >= 0),
  perfiles_ocupados INTEGER NOT NULL DEFAULT 0 CHECK (perfiles_ocupados >= 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  en_reposo BOOLEAN NOT NULL DEFAULT false,
  dias_reposo INTEGER CHECK (dias_reposo BETWEEN 1 AND 35),
  fecha_inicio_reposo DATE,
  fecha_fin_reposo DATE,
  cortado_at TIMESTAMPTZ,
  cortado_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  motivo_corte TEXT,
  archivado_at TIMESTAMPTZ,
  archivado_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  motivo_archivado TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CHECK (perfiles_ocupados <= perfiles_disponibles),
  CHECK ((activo = true AND cortado_at IS NULL) OR activo = false),
  FOREIGN KEY (plan_tipo_id, categoria_id)
    REFERENCES planes_tipos(id, categoria_id)
    ON DELETE RESTRICT
);
