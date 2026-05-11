-- ============================================================================
-- 20260511000100_fix_plan_snapshot_in_create_venta_with_initial_payment.sql
--
-- Migration _000700 fixed plan_nombre_snapshot / plan_tipo_nombre_snapshot
-- handling in create_venta_payment, but the equivalent fix was never applied
-- to create_venta_with_initial_payment. When a venta is created without a plan
-- (plan_id = NULL or empty), NULLIF(p_plan_nombre_snapshot, '') returned NULL
-- and violated the NOT NULL constraint enforced by _000300.
--
-- Same fix as _000700: wrap each snapshot expression in COALESCE(NULLIF(...), '')
-- so ventas without a plan get an empty string, matching the DEFAULT '' on those
-- columns.
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
    COALESCE(NULLIF(p_plan_nombre_snapshot, ''), ''),
    COALESCE(NULLIF(p_plan_tipo_nombre_snapshot, ''), ''),
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
