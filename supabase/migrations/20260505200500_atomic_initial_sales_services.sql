-- ============================================================================
-- Atomic initial creation helpers.
-- Creates base entity + initial period + initial payment in one database
-- transaction, preventing orphan ventas/servicios when the payment insert fails.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_venta_with_initial_payment(
  p_cliente_id TEXT,
  p_servicio_id TEXT,
  p_categoria_id TEXT,
  p_estado venta_estado_enum,
  p_perfil_numero INTEGER,
  p_perfil_nombre TEXT,
  p_codigo TEXT,
  p_notas TEXT,
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_ciclo_pago ciclo_pago_enum,
  p_precio_original NUMERIC,
  p_descuento NUMERIC,
  p_total_original NUMERIC,
  p_moneda_original TEXT,
  p_total_usd NUMERIC,
  p_exchange_rate NUMERIC,
  p_metodo_pago_id TEXT,
  p_metodo_pago_nombre_snapshot TEXT,
  p_fecha_pago TIMESTAMPTZ DEFAULT now(),
  p_pago_notas TEXT DEFAULT NULL,
  p_plan_id TEXT DEFAULT NULL,
  p_plan_nombre_snapshot TEXT DEFAULT NULL,
  p_plan_tipo_nombre_snapshot TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_venta_id TEXT;
  v_periodo_id TEXT;
BEGIN
  INSERT INTO ventas (
    cliente_id,
    servicio_id,
    categoria_id,
    estado,
    perfil_numero,
    perfil_nombre,
    codigo,
    notas,
    created_by
  )
  VALUES (
    NULLIF(p_cliente_id, ''),
    p_servicio_id,
    p_categoria_id,
    COALESCE(p_estado, 'activo'::venta_estado_enum),
    p_perfil_numero,
    NULLIF(p_perfil_nombre, ''),
    NULLIF(p_codigo, ''),
    NULLIF(p_notas, ''),
    p_created_by
  )
  RETURNING id INTO v_venta_id;

  INSERT INTO venta_periodos (
    venta_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_fin,
    ciclo_pago,
    plan_id,
    plan_nombre_snapshot,
    plan_tipo_nombre_snapshot,
    precio_original,
    descuento,
    total_original,
    moneda_original,
    total_usd,
    exchange_rate,
    created_by
  )
  VALUES (
    v_venta_id,
    1,
    'inicial'::periodo_tipo_enum,
    p_fecha_inicio,
    p_fecha_fin,
    p_ciclo_pago,
    NULLIF(p_plan_id, ''),
    NULLIF(p_plan_nombre_snapshot, ''),
    NULLIF(p_plan_tipo_nombre_snapshot, ''),
    p_precio_original,
    COALESCE(p_descuento, 0),
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    p_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    v_venta_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    p_created_by
  );

  RETURN v_venta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_servicio_with_initial_payment(
  p_categoria_id TEXT,
  p_plan_tipo_id TEXT,
  p_nombre TEXT,
  p_correo TEXT,
  p_contrasena TEXT,
  p_perfiles_disponibles INTEGER,
  p_perfiles_ocupados INTEGER,
  p_activo BOOLEAN,
  p_en_reposo BOOLEAN,
  p_dias_reposo INTEGER,
  p_fecha_inicio_reposo DATE,
  p_fecha_fin_reposo DATE,
  p_notas TEXT,
  p_fecha_inicio DATE,
  p_fecha_vencimiento DATE,
  p_ciclo_pago ciclo_pago_enum,
  p_costo_original NUMERIC,
  p_moneda_original TEXT,
  p_costo_usd NUMERIC,
  p_exchange_rate NUMERIC,
  p_renovacion_automatica BOOLEAN,
  p_metodo_pago_id TEXT,
  p_metodo_pago_nombre_snapshot TEXT,
  p_fecha_pago TIMESTAMPTZ DEFAULT now(),
  p_pago_notas TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_servicio_id TEXT;
  v_periodo_id TEXT;
BEGIN
  INSERT INTO servicios (
    categoria_id,
    plan_tipo_id,
    nombre,
    correo,
    contrasena,
    perfiles_disponibles,
    perfiles_ocupados,
    activo,
    en_reposo,
    dias_reposo,
    fecha_inicio_reposo,
    fecha_fin_reposo,
    notas,
    created_by
  )
  VALUES (
    p_categoria_id,
    NULLIF(p_plan_tipo_id, ''),
    p_nombre,
    p_correo,
    p_contrasena,
    COALESCE(p_perfiles_disponibles, 0),
    COALESCE(p_perfiles_ocupados, 0),
    COALESCE(p_activo, true),
    COALESCE(p_en_reposo, false),
    p_dias_reposo,
    p_fecha_inicio_reposo,
    p_fecha_fin_reposo,
    NULLIF(p_notas, ''),
    p_created_by
  )
  RETURNING id INTO v_servicio_id;

  INSERT INTO servicio_periodos (
    servicio_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_vencimiento,
    ciclo_pago,
    costo_original,
    moneda_original,
    costo_usd,
    exchange_rate,
    renovacion_automatica,
    created_by
  )
  VALUES (
    v_servicio_id,
    1,
    'inicial'::periodo_tipo_enum,
    p_fecha_inicio,
    p_fecha_vencimiento,
    p_ciclo_pago,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    COALESCE(p_renovacion_automatica, false),
    p_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_servicio (
    servicio_periodo_id,
    servicio_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    categoria_id_snapshot,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    v_servicio_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    p_categoria_id,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    p_created_by
  );

  RETURN v_servicio_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_venta_with_initial_payment(
  TEXT,
  TEXT,
  TEXT,
  venta_estado_enum,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  DATE,
  DATE,
  ciclo_pago_enum,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_servicio_with_initial_payment(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  BOOLEAN,
  BOOLEAN,
  INTEGER,
  DATE,
  DATE,
  TEXT,
  DATE,
  DATE,
  ciclo_pago_enum,
  NUMERIC,
  TEXT,
  NUMERIC,
  NUMERIC,
  BOOLEAN,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  UUID
) TO authenticated;
