-- ============================================================================
-- Atomic payment operations.
-- Keeps period/payment writes in one database transaction and serializes period
-- numbering per venta/servicio to avoid duplicate numero_periodo races.
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

CREATE OR REPLACE FUNCTION public.create_servicio_payment(
  p_servicio_id TEXT,
  p_categoria_id_snapshot TEXT,
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

  PERFORM pg_advisory_xact_lock(hashtextextended(p_servicio_id, 0));

  SELECT COALESCE(MAX(numero_periodo), 0) + 1
    INTO v_numero_periodo
  FROM servicio_periodos
  WHERE servicio_id = p_servicio_id;

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
    p_servicio_id,
    v_numero_periodo,
    CASE WHEN v_numero_periodo = 1 THEN 'inicial'::periodo_tipo_enum ELSE 'renovacion'::periodo_tipo_enum END,
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
    p_servicio_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    NULLIF(p_categoria_id_snapshot, ''),
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    p_created_by
  )
  RETURNING id INTO v_pago_id;

  RETURN v_pago_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_venta_payment_and_period(
  p_pago_id TEXT,
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
  p_pago_notas TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT venta_periodo_id
    INTO v_periodo_id
  FROM pagos_venta
  WHERE id = p_pago_id
  FOR UPDATE;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'pago_venta % not found', p_pago_id;
  END IF;

  UPDATE pagos_venta
  SET monto_original = p_total_original,
      moneda_original = p_moneda_original,
      monto_usd = p_total_usd,
      exchange_rate = p_exchange_rate,
      metodo_pago_id = NULLIF(p_metodo_pago_id, ''),
      metodo_pago_nombre_snapshot = NULLIF(p_metodo_pago_nombre_snapshot, ''),
      notas = NULLIF(p_pago_notas, '')
  WHERE id = p_pago_id;

  UPDATE venta_periodos
  SET fecha_inicio = p_fecha_inicio,
      fecha_fin = p_fecha_fin,
      ciclo_pago = p_ciclo_pago,
      precio_original = p_precio_original,
      descuento = COALESCE(p_descuento, 0),
      total_original = p_total_original,
      moneda_original = p_moneda_original,
      total_usd = p_total_usd,
      exchange_rate = p_exchange_rate
  WHERE id = v_periodo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_servicio_payment_and_period(
  p_pago_id TEXT,
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
  p_pago_notas TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT servicio_periodo_id
    INTO v_periodo_id
  FROM pagos_servicio
  WHERE id = p_pago_id
  FOR UPDATE;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'pago_servicio % not found', p_pago_id;
  END IF;

  UPDATE pagos_servicio
  SET monto_original = p_costo_original,
      moneda_original = p_moneda_original,
      monto_usd = p_costo_usd,
      exchange_rate = p_exchange_rate,
      metodo_pago_id = NULLIF(p_metodo_pago_id, ''),
      metodo_pago_nombre_snapshot = NULLIF(p_metodo_pago_nombre_snapshot, ''),
      notas = NULLIF(p_pago_notas, '')
  WHERE id = p_pago_id;

  UPDATE servicio_periodos
  SET fecha_inicio = p_fecha_inicio,
      fecha_vencimiento = p_fecha_vencimiento,
      ciclo_pago = p_ciclo_pago,
      costo_original = p_costo_original,
      moneda_original = p_moneda_original,
      costo_usd = p_costo_usd,
      exchange_rate = p_exchange_rate,
      renovacion_automatica = COALESCE(p_renovacion_automatica, false)
  WHERE id = v_periodo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_venta_payment_and_empty_period(p_pago_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT venta_periodo_id
    INTO v_periodo_id
  FROM pagos_venta
  WHERE id = p_pago_id
  FOR UPDATE;

  IF v_periodo_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM pagos_venta WHERE id = p_pago_id;

  IF NOT EXISTS (SELECT 1 FROM pagos_venta WHERE venta_periodo_id = v_periodo_id) THEN
    DELETE FROM venta_periodos WHERE id = v_periodo_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_servicio_payment_and_empty_period(p_pago_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT servicio_periodo_id
    INTO v_periodo_id
  FROM pagos_servicio
  WHERE id = p_pago_id
  FOR UPDATE;

  IF v_periodo_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM pagos_servicio WHERE id = p_pago_id;

  IF NOT EXISTS (SELECT 1 FROM pagos_servicio WHERE servicio_periodo_id = v_periodo_id) THEN
    DELETE FROM servicio_periodos WHERE id = v_periodo_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_venta_categoria_from_servicio()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_categoria_id TEXT;
BEGIN
  SELECT categoria_id
    INTO v_categoria_id
  FROM servicios
  WHERE id = NEW.servicio_id;

  IF v_categoria_id IS NULL THEN
    RAISE EXCEPTION 'Servicio % no tiene categoria valida', NEW.servicio_id;
  END IF;

  NEW.categoria_id = v_categoria_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_venta_categoria_update ON ventas;
CREATE TRIGGER trg_sync_venta_categoria_update
  BEFORE INSERT OR UPDATE OF servicio_id, categoria_id ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_venta_categoria_from_servicio();

GRANT EXECUTE ON FUNCTION public.create_venta_payment(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_servicio_payment(
  TEXT, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_venta_payment_and_period(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, TEXT, TEXT, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_servicio_payment_and_period(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, TEXT, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.delete_venta_payment_and_empty_period(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_servicio_payment_and_empty_period(TEXT) TO authenticated;
