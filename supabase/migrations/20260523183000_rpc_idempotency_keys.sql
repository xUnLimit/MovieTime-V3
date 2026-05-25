-- ============================================================================
-- RPC idempotency keys for critical create/payment operations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rpc_idempotency_keys (
  idempotency_key UUID NOT NULL,
  rpc_name TEXT NOT NULL,
  result_id TEXT NOT NULL,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (created_by, rpc_name, idempotency_key)
);

ALTER TABLE public.rpc_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rpc_idempotency_keys_select_own ON public.rpc_idempotency_keys;
CREATE POLICY rpc_idempotency_keys_select_own ON public.rpc_idempotency_keys
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS rpc_idempotency_keys_insert_own ON public.rpc_idempotency_keys;
CREATE POLICY rpc_idempotency_keys_insert_own ON public.rpc_idempotency_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

REVOKE ALL ON public.rpc_idempotency_keys FROM PUBLIC;
GRANT SELECT, INSERT ON public.rpc_idempotency_keys TO authenticated;

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
  p_created_by UUID DEFAULT auth.uid(),
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_venta_id TEXT;
  v_periodo_id TEXT;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_venta_with_initial_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

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
    v_created_by
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
    v_created_by
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
    v_created_by
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_venta_with_initial_payment', v_venta_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

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
  p_created_by UUID DEFAULT auth.uid(),
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_servicio_id TEXT;
  v_periodo_id TEXT;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_servicio_with_initial_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

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
    v_created_by
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
    v_created_by
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
    v_created_by
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_servicio_with_initial_payment', v_servicio_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_servicio_id;
END;
$$;

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
  p_created_by UUID DEFAULT auth.uid(),
  p_idempotency_key UUID DEFAULT NULL
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
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_venta_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
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
    v_created_by
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
    v_created_by
  )
  RETURNING id INTO v_pago_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_venta_payment', v_pago_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

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
  p_created_by UUID DEFAULT auth.uid(),
  p_idempotency_key UUID DEFAULT NULL
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
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_servicio_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
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
    v_created_by
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
    v_created_by
  )
  RETURNING id INTO v_pago_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_servicio_payment', v_pago_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_pago_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_venta_refund(
  p_venta_id TEXT,
  p_monto_original NUMERIC,
  p_moneda_original TEXT,
  p_monto_usd NUMERIC,
  p_exchange_rate NUMERIC,
  p_metodo_pago_id TEXT,
  p_metodo_pago_nombre_snapshot TEXT,
  p_destino_reembolso TEXT DEFAULT NULL,
  p_fecha_reembolso TIMESTAMPTZ DEFAULT now(),
  p_nota TEXT DEFAULT NULL,
  p_cortar BOOLEAN DEFAULT false,
  p_motivo_corte TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid(),
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_periodo_id TEXT;
  v_pago_id TEXT;
  v_disponible_usd NUMERIC;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_venta_refund'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

  IF COALESCE(p_monto_original, 0) <= 0 OR COALESCE(p_monto_usd, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto del reembolso debe ser mayor a 0.';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_destino_reembolso, '')), '') IS NULL THEN
    RAISE EXCEPTION 'La cuenta destino del cliente es obligatoria.';
  END IF;

  IF COALESCE(p_cortar, false) AND NULLIF(BTRIM(COALESCE(p_motivo_corte, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El motivo de corte es obligatorio.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_venta_id, 1));

  SELECT id
    INTO v_periodo_id
  FROM public.venta_periodos
  WHERE venta_id = p_venta_id
  ORDER BY numero_periodo DESC, fecha_fin DESC, created_at DESC
  LIMIT 1;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'La venta no tiene periodo asociado.';
  END IF;

  SELECT
    COALESCE(SUM(monto_usd) FILTER (WHERE estado = 'registrado'), 0)
      - COALESCE(SUM(monto_usd) FILTER (WHERE estado = 'reembolsado'), 0)
    INTO v_disponible_usd
  FROM public.pagos_venta
  WHERE venta_id = p_venta_id;

  IF p_monto_usd > COALESCE(v_disponible_usd, 0) + 0.0001 THEN
    RAISE EXCEPTION 'El reembolso supera el saldo disponible de la venta.';
  END IF;

  INSERT INTO public.pagos_venta (
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
    destino_reembolso,
    notas,
    created_by,
    anulada_at,
    anulada_by,
    motivo_anulacion
  )
  VALUES (
    v_periodo_id,
    p_venta_id,
    COALESCE(p_fecha_reembolso, now()),
    'reembolsado'::pago_estado_enum,
    p_monto_original,
    p_moneda_original,
    p_monto_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(BTRIM(p_destino_reembolso), ''),
    NULLIF(p_nota, ''),
    v_created_by,
    now(),
    v_created_by,
    COALESCE(NULLIF(p_motivo_corte, ''), NULLIF(p_nota, ''), 'Reembolso de venta')
  )
  RETURNING id INTO v_pago_id;

  IF COALESCE(p_cortar, false) THEN
    UPDATE public.ventas
    SET
      estado = 'inactivo'::venta_estado_enum,
      cortada_at = COALESCE(cortada_at, now()),
      cortada_by = COALESCE(cortada_by, v_created_by),
      motivo_corte = NULLIF(p_motivo_corte, ''),
      updated_at = now()
    WHERE id = p_venta_id;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_venta_refund', v_pago_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_pago_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_venta_with_initial_payment(
  TEXT, TEXT, TEXT, venta_estado_enum, INTEGER, TEXT, TEXT, TEXT, DATE, DATE,
  ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT,
  TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_servicio_with_initial_payment(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER,
  DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC,
  NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_venta_payment(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_servicio_payment(
  TEXT, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_venta_refund(
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ,
  TEXT, BOOLEAN, TEXT, UUID, UUID
) TO authenticated;
