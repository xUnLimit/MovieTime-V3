-- Outbox de eventos de dominio del lado servidor (fundacion).
-- Los eventos se escriben dentro de la misma transaccion que el cambio de negocio y un despachador
-- (endpoint + pg_cron) los reclama con SKIP LOCKED. Los payloads nunca contienen contrasenas,
-- codigos ni telefonos completos: solo ids, estados e importes.
-- Nota sobre venta.creada: create_venta_with_initial_payment es SECURITY INVOKER y el invocador
-- (authenticated) no puede ejecutar emit_domain_event, asi que se emite con un trigger AFTER INSERT
-- SECURITY DEFINER sobre ventas en lugar de redefinir esa funcion.

CREATE TABLE public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type ~ '^[a-z_]{1,40}\.[a-z_]{1,60}$'),
  aggregate_type text NOT NULL CHECK (aggregate_type ~ '^[a-z_]{1,40}$'),
  aggregate_id text NOT NULL CHECK (char_length(aggregate_id) BETWEEN 1 AND 128),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 8192),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  locked_until timestamptz
);
CREATE INDEX domain_events_pending_idx ON public.domain_events (occurred_at, id) WHERE processed_at IS NULL;
CREATE INDEX domain_events_aggregate_idx ON public.domain_events (aggregate_type, aggregate_id);

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY domain_events_admin_read ON public.domain_events FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active));
REVOKE ALL ON public.domain_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.domain_events TO authenticated;
GRANT SELECT ON public.domain_events TO service_role;

-- Solo se llama desde otras funciones SECURITY DEFINER (propietario) o triggers.
CREATE FUNCTION public.emit_domain_event(
  p_type text, p_aggregate_type text, p_aggregate_id text, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.domain_events (type, aggregate_type, aggregate_id, payload)
  VALUES (p_type, p_aggregate_type, p_aggregate_id, coalesce(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.emit_domain_event(text, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.claim_domain_events(p_limit integer, p_lock_seconds integer)
RETURNS TABLE(id uuid, type text, aggregate_type text, aggregate_id text, payload jsonb,
  occurred_at timestamptz, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT e.id FROM public.domain_events e
    WHERE e.processed_at IS NULL AND e.attempts < 8
      AND (e.locked_until IS NULL OR e.locked_until <= now())
    ORDER BY e.occurred_at, e.id
    LIMIT least(greatest(coalesce(p_limit, 0), 0), 100)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.domain_events e
    SET attempts = e.attempts + 1,
        locked_until = now() + make_interval(secs => least(greatest(coalesce(p_lock_seconds, 60), 10), 900))
    FROM picked WHERE e.id = picked.id
    RETURNING e.*
  )
  SELECT c.id, c.type, c.aggregate_type, c.aggregate_id, c.payload, c.occurred_at, c.attempts
  FROM claimed c ORDER BY c.occurred_at, c.id;
END;
$$;

-- p_error NULL: procesado. Con etiqueta: se libera con espera creciente para el siguiente intento.
CREATE FUNCTION public.finish_domain_event(p_id uuid, p_error text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_updated uuid;
BEGIN
  IF p_error IS NOT NULL AND p_error !~ '^[A-Z_]{1,64}$' THEN
    RAISE EXCEPTION 'invalid domain event finish';
  END IF;
  IF p_error IS NULL THEN
    UPDATE public.domain_events e
      SET processed_at = now(), last_error = NULL, locked_until = NULL
      WHERE e.id = p_id AND e.processed_at IS NULL RETURNING e.id INTO v_updated;
  ELSE
    UPDATE public.domain_events e
      SET last_error = p_error,
          locked_until = now() + (power(2, greatest(e.attempts, 1) - 1) * interval '1 minute')
      WHERE e.id = p_id AND e.processed_at IS NULL RETURNING e.id INTO v_updated;
  END IF;
  RETURN v_updated IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_domain_events(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_domain_event(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_domain_events(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_domain_event(uuid, text) TO service_role;

-- Triggers para cambios que no pasan por un RPC. Funciones de trigger: no ejecutables por nadie.
CREATE FUNCTION public.emit_venta_creada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.emit_domain_event('venta.creada', 'venta', NEW.id, jsonb_build_object(
    'venta_id', NEW.id, 'cliente_id', NEW.cliente_id, 'servicio_id', NEW.servicio_id,
    'categoria_id', NEW.categoria_id, 'estado', NEW.estado));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.emit_venta_creada() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER emit_venta_creada AFTER INSERT ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.emit_venta_creada();

CREATE FUNCTION public.emit_venta_transferida() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.emit_domain_event('venta.transferida', 'venta', NEW.id, jsonb_build_object(
    'venta_id', NEW.id, 'from_servicio_id', OLD.servicio_id, 'to_servicio_id', NEW.servicio_id));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.emit_venta_transferida() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER emit_venta_transferida AFTER UPDATE OF servicio_id ON public.ventas
  FOR EACH ROW WHEN (OLD.servicio_id IS DISTINCT FROM NEW.servicio_id)
  EXECUTE FUNCTION public.emit_venta_transferida();

-- Solo indica que cambio (banderas); nunca el correo ni la contrasena.
CREATE FUNCTION public.emit_servicio_credenciales_cambiadas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.emit_domain_event('servicio.credenciales_cambiadas', 'servicio', NEW.id, jsonb_build_object(
    'servicio_id', NEW.id,
    'correo_cambiado', OLD.correo IS DISTINCT FROM NEW.correo,
    'contrasena_cambiada', OLD.contrasena IS DISTINCT FROM NEW.contrasena));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.emit_servicio_credenciales_cambiadas() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER emit_servicio_credenciales_cambiadas AFTER UPDATE OF correo, contrasena ON public.servicios
  FOR EACH ROW WHEN (OLD.correo IS DISTINCT FROM NEW.correo OR OLD.contrasena IS DISTINCT FROM NEW.contrasena)
  EXECUTE FUNCTION public.emit_servicio_credenciales_cambiadas();

-- Crear en Vault: whatsapp_auto_notices_secret (ya existente) y domain_events_dispatch_url
-- (HTTPS absoluto a /api/domain-events/dispatch).
CREATE FUNCTION public.trigger_domain_events_dispatch() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_secret text; v_url text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = 'whatsapp_auto_notices_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name = 'domain_events_dispatch_url' LIMIT 1;
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 55000) INTO v_request_id;
  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_domain_events_dispatch() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('domain-events-dispatch-tick', '* * * * *',
  $cron$SELECT public.trigger_domain_events_dispatch();$cron$);

-- ---------------------------------------------------------------------------
-- RPC transaccionales redefinidos: cuerpo identico a la ultima definicion
-- (20260523183000_rpc_idempotency_keys.sql y 20260927221000_yappy_payment_detection.sql)
-- con una sola adicion: la llamada a emit_domain_event dentro de la misma transaccion.
-- CREATE OR REPLACE conserva firmas, propietario y grants existentes.
-- ---------------------------------------------------------------------------

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

  PERFORM public.emit_domain_event('venta.pago_registrado', 'venta', p_venta_id, jsonb_build_object(
    'venta_id', p_venta_id, 'pago_id', v_pago_id, 'periodo_id', v_periodo_id,
    'numero_periodo', v_numero_periodo, 'total_usd', p_total_usd, 'moneda_original', p_moneda_original));

  RETURN v_pago_id;
END;
$;

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

  PERFORM public.emit_domain_event('venta.reembolsada', 'venta', p_venta_id, jsonb_build_object(
    'venta_id', p_venta_id, 'pago_id', v_pago_id, 'periodo_id', v_periodo_id,
    'monto_usd', p_monto_usd, 'moneda_original', p_moneda_original, 'cortada', COALESCE(p_cortar, false)));

  RETURN v_pago_id;
END;
$;

CREATE OR REPLACE FUNCTION public.resolve_yappy_payment(p_payment_id uuid, p_venta_id text, p_note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_payment public.yappy_payments%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR (SELECT private.auth_role()) <> 'admin'
    OR NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active)
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 1000 THEN RAISE EXCEPTION 'note too long'; END IF;
  SELECT * INTO v_payment FROM public.yappy_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF v_payment.match_status = 'registrado' AND v_payment.matched_venta_id = p_venta_id THEN RETURN 'registrado'; END IF;
  IF v_payment.match_status IN ('registrado', 'descartado') THEN RAISE EXCEPTION 'payment already resolved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ventas WHERE id = p_venta_id) THEN RAISE EXCEPTION 'sale not found'; END IF;
  UPDATE public.yappy_payments SET match_status = 'registrado', matched_venta_id = p_venta_id,
    resolved_by = auth.uid(), resolved_at = now(), resolution_note = nullif(btrim(p_note), '')
  WHERE id = p_payment_id;
  PERFORM public.emit_domain_event('yappy.pago_resuelto', 'yappy_payment', p_payment_id::text, jsonb_build_object(
    'payment_id', p_payment_id, 'venta_id', p_venta_id, 'amount', v_payment.amount, 'resolved_by', auth.uid()));
  RETURN 'registrado';
END;
$;

CREATE OR REPLACE FUNCTION public.ingest_yappy_payment(
  p_uid_validity bigint, p_imap_uid bigint, p_internet_message_id text,
  p_received_at timestamptz, p_subject text, p_dmarc_pass boolean,
  p_parser_version integer, p_confirmation_code text, p_amount numeric,
  p_payer_name_short text, p_payer_phone_last4 text, p_paid_at timestamptz,
  p_reject_reason text DEFAULT NULL
) RETURNS TABLE(outcome text, payment_id uuid, match_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_mail_id uuid; v_payment_id uuid; v_status text;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_uid_validity <= 0 OR p_imap_uid <= 0 OR p_payer_phone_last4 !~ '^[0-9]{4}$'
    OR p_amount <= 0 OR p_confirmation_code IS NULL OR btrim(p_confirmation_code) = ''
  THEN RAISE EXCEPTION 'invalid payment input'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.terceros t
    JOIN public.ventas v ON v.cliente_id = t.id
    WHERE t.active AND v.estado = 'activo'
      AND right(regexp_replace(t.telefono, '[^0-9]', '', 'g'), 4) = p_payer_phone_last4
  ) THEN
    RETURN QUERY SELECT 'ignorado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  SELECT m.id INTO v_mail_id FROM public.yappy_mail_messages m
    WHERE m.uid_validity = p_uid_validity AND m.imap_uid = p_imap_uid;
  IF v_mail_id IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  INSERT INTO public.yappy_mail_messages(uid_validity, imap_uid, internet_message_id,
    received_at, from_address, subject, dmarc_pass, parser_version, status, failure_reason)
  VALUES (p_uid_validity, p_imap_uid, p_internet_message_id, p_received_at,
    'notificaciones@yappy.com.pa', p_subject, p_dmarc_pass, p_parser_version,
    CASE WHEN p_reject_reason IS NULL THEN 'extraido'
      WHEN p_reject_reason = 'dmarc_failed' THEN 'invalido' ELSE 'descartado' END, p_reject_reason)
  RETURNING id INTO v_mail_id;
  IF p_reject_reason IS NOT NULL THEN
    RETURN QUERY SELECT 'nuevo'::text, NULL::uuid,
      CASE WHEN p_reject_reason = 'dmarc_failed' THEN 'invalido' ELSE 'descartado' END::text;
    RETURN;
  END IF;
  INSERT INTO public.yappy_payments(confirmation_code, amount, payer_name_short,
    payer_phone_last4, paid_at, mail_message_id)
  VALUES (upper(btrim(p_confirmation_code)), p_amount, p_payer_name_short,
    p_payer_phone_last4, p_paid_at, v_mail_id)
  ON CONFLICT (confirmation_code) DO NOTHING RETURNING id INTO v_payment_id;
  IF v_payment_id IS NULL THEN
    UPDATE public.yappy_mail_messages SET status = 'duplicado',
      failure_reason = 'confirmation_code_exists' WHERE id = v_mail_id;
    RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  v_status := public.match_yappy_payment(v_payment_id);
  PERFORM public.emit_domain_event('yappy.pago_detectado', 'yappy_payment', v_payment_id::text, jsonb_build_object(
    'payment_id', v_payment_id, 'match_status', v_status, 'amount', p_amount));
  RETURN QUERY SELECT 'nuevo'::text, v_payment_id, v_status;
END;
$$;

NOTIFY pgrst, 'reload schema';
