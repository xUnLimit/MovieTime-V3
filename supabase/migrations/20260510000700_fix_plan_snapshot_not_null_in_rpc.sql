-- ============================================================================
-- 20260510000700_fix_plan_snapshot_not_null_in_rpc.sql
--
-- The plan_nombre_snapshot / plan_tipo_nombre_snapshot columns on venta_periodos
-- are NOT NULL (enforced in migration _000300). The auto-fill trigger only runs
-- when plan_id IS NOT NULL, so ventas without a plan (plan_id = NULL) received
-- a raw NULLIF(p_plan_nombre_snapshot, '') = NULL and violated the constraint.
--
-- Fix: wrap each snapshot expression in COALESCE(NULLIF(...), '') so that ventas
-- without a plan get an empty string instead of NULL, matching the DEFAULT '' on
-- those columns and satisfying the NOT NULL constraint.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_venta_payment(
  p_venta_id TEXT,
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero_periodo INTEGER;
  v_periodo_id TEXT;
  v_pago_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_venta_id, 0));

  SELECT COALESCE(MAX(numero_periodo), 0) + 1
    INTO v_numero_periodo
  FROM venta_periodos
  WHERE venta_id = p_venta_id;

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
    p_venta_id,
    v_numero_periodo,
    CASE WHEN v_numero_periodo = 1 THEN 'inicial'::periodo_tipo_enum ELSE 'renovacion'::periodo_tipo_enum END,
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
    p_venta_id,
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
  )
  RETURNING id INTO v_pago_id;

  RETURN v_pago_id;
END;
$$;
