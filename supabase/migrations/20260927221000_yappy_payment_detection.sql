-- Phase 3a: inbox evidence and manual reconciliation. No payment is applied here.
CREATE TABLE public.yappy_mail_sync_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  mailbox text NOT NULL DEFAULT '',
  uid_validity bigint CHECK (uid_validity > 0),
  last_uid bigint NOT NULL DEFAULT 0 CHECK (last_uid >= 0),
  last_synced_at timestamptz,
  last_error_code text,
  sync_locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.yappy_mail_sync_state(id) VALUES (true);
CREATE TRIGGER set_yappy_mail_sync_state_updated_at BEFORE UPDATE ON public.yappy_mail_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.yappy_mail_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.yappy_mail_sync_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.yappy_mail_sync_state TO service_role;

-- The view omits UID state and lock details; the mailbox is masked in the UI.
CREATE POLICY yappy_mail_sync_state_admin_read ON public.yappy_mail_sync_state FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active));
GRANT SELECT (mailbox, last_synced_at, last_error_code) ON public.yappy_mail_sync_state TO authenticated;
CREATE VIEW public.v_yappy_mail_sync_status
WITH (security_invoker = true) AS
SELECT mailbox, last_synced_at, last_error_code,
  CASE WHEN last_error_code = 'auth_failed' THEN 'error' ELSE 'configurado' END AS status
FROM public.yappy_mail_sync_state;
REVOKE ALL ON public.v_yappy_mail_sync_status FROM PUBLIC, anon;
GRANT SELECT ON public.v_yappy_mail_sync_status TO authenticated, service_role;

CREATE TABLE public.yappy_mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid_validity bigint NOT NULL CHECK (uid_validity > 0),
  imap_uid bigint NOT NULL CHECK (imap_uid > 0),
  internet_message_id text,
  received_at timestamptz NOT NULL,
  from_address text NOT NULL,
  subject text,
  dmarc_pass boolean,
  parser_version integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('extraido', 'invalido', 'duplicado', 'descartado')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uid_validity, imap_uid)
);
CREATE INDEX idx_yappy_mail_messages_received ON public.yappy_mail_messages(received_at DESC);
ALTER TABLE public.yappy_mail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY yappy_mail_messages_admin_read ON public.yappy_mail_messages FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active));
REVOKE ALL ON public.yappy_mail_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.yappy_mail_messages TO authenticated;
GRANT SELECT ON public.yappy_mail_messages TO service_role;

CREATE TABLE public.yappy_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code text NOT NULL UNIQUE CHECK (confirmation_code = upper(btrim(confirmation_code))),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  payer_name_short text NOT NULL,
  payer_phone_last4 text NOT NULL CHECK (payer_phone_last4 ~ '^[0-9]{4}$'),
  paid_at timestamptz NOT NULL,
  mail_message_id uuid NOT NULL UNIQUE REFERENCES public.yappy_mail_messages(id) ON DELETE RESTRICT,
  match_status text NOT NULL DEFAULT 'sin_match' CHECK (match_status IN ('match_unico', 'ambiguo', 'sin_match', 'registrado', 'descartado')),
  candidate_venta_ids text[] NOT NULL DEFAULT '{}',
  matched_venta_id text REFERENCES public.ventas(id) ON DELETE RESTRICT,
  resolved_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_yappy_payments_paid_at ON public.yappy_payments(paid_at DESC);
CREATE TRIGGER set_yappy_payments_updated_at BEFORE UPDATE ON public.yappy_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.yappy_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY yappy_payments_admin_read ON public.yappy_payments FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active));
REVOKE ALL ON public.yappy_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.yappy_payments TO authenticated;
GRANT SELECT ON public.yappy_payments TO service_role;

CREATE FUNCTION public.match_yappy_payment(p_payment_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_payment public.yappy_payments%ROWTYPE;
  v_candidates text[];
  v_status text;
  v_days_before constant integer := 15;
  v_days_after constant integer := 7;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_payment FROM public.yappy_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF v_payment.match_status IN ('registrado', 'descartado') THEN RETURN v_payment.match_status; END IF;
  SELECT coalesce(array_agg(v.id ORDER BY v.id), '{}') INTO v_candidates
  FROM public.ventas v
  JOIN public.terceros t ON t.id = v.cliente_id
  JOIN LATERAL (
    SELECT vp.fecha_fin, vp.total_original, vp.moneda_original
    FROM public.venta_periodos vp WHERE vp.venta_id = v.id
    ORDER BY vp.numero_periodo DESC LIMIT 1
  ) last_period ON true
  WHERE v.estado = 'activo' AND t.active
    AND right(regexp_replace(t.telefono, '[^0-9]', '', 'g'), 4) = v_payment.payer_phone_last4
    AND last_period.moneda_original = 'USD'
    AND last_period.total_original = v_payment.amount
    AND last_period.fecha_fin BETWEEN
      ((v_payment.paid_at AT TIME ZONE 'America/Panama')::date - v_days_before)
      AND ((v_payment.paid_at AT TIME ZONE 'America/Panama')::date + v_days_after);
  v_status := CASE cardinality(v_candidates) WHEN 0 THEN 'sin_match' WHEN 1 THEN 'match_unico' ELSE 'ambiguo' END;
  UPDATE public.yappy_payments SET candidate_venta_ids = v_candidates, match_status = v_status
  WHERE id = p_payment_id;
  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.match_yappy_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_yappy_payment(uuid) TO service_role;

-- Personal mailbox privacy boundary: no technical mail row or payment row is
-- written until a matching active customer with an active sale is found.
CREATE FUNCTION public.ingest_yappy_payment(
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
  RETURN QUERY SELECT 'nuevo'::text, v_payment_id, v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_yappy_payment(bigint, bigint, text, timestamptz, text, boolean, integer, text, numeric, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_yappy_payment(bigint, bigint, text, timestamptz, text, boolean, integer, text, numeric, text, text, timestamptz, text) TO service_role;

-- Invalid formats retain only technical UID, time and failure code.
CREATE FUNCTION public.record_invalid_yappy_mail(
  p_uid_validity bigint, p_imap_uid bigint, p_received_at timestamptz,
  p_parser_version integer, p_failure_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_failure_reason IS NULL OR p_failure_reason NOT IN ('monto', 'confirmacion', 'telefono', 'fecha', 'nombre', 'mime_invalid', 'reenviado')
    OR p_uid_validity <= 0 OR p_imap_uid <= 0 THEN RAISE EXCEPTION 'invalid mail input'; END IF;
  INSERT INTO public.yappy_mail_messages(uid_validity, imap_uid, received_at,
    from_address, parser_version, status, failure_reason)
  VALUES (p_uid_validity, p_imap_uid, p_received_at, 'notificaciones@yappy.com.pa',
    p_parser_version, CASE WHEN p_failure_reason = 'reenviado' THEN 'descartado' ELSE 'invalido' END, p_failure_reason)
  ON CONFLICT (uid_validity, imap_uid) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.record_invalid_yappy_mail(bigint, bigint, timestamptz, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_invalid_yappy_mail(bigint, bigint, timestamptz, integer, text) TO service_role;

CREATE FUNCTION public.resolve_yappy_payment(p_payment_id uuid, p_venta_id text, p_note text DEFAULT NULL) RETURNS text
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
  RETURN 'registrado';
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_yappy_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_yappy_payment(uuid, text, text) TO authenticated;

CREATE FUNCTION public.dismiss_yappy_payment(p_payment_id uuid, p_note text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_payment public.yappy_payments%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR (SELECT private.auth_role()) <> 'admin'
    OR NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active)
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF nullif(btrim(p_note), '') IS NULL OR char_length(p_note) > 1000 THEN RAISE EXCEPTION 'invalid note'; END IF;
  SELECT * INTO v_payment FROM public.yappy_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF v_payment.match_status = 'descartado' THEN RETURN 'descartado'; END IF;
  IF v_payment.match_status = 'registrado' THEN RAISE EXCEPTION 'payment already resolved'; END IF;
  UPDATE public.yappy_payments SET match_status = 'descartado', resolved_by = auth.uid(),
    resolved_at = now(), resolution_note = btrim(p_note) WHERE id = p_payment_id;
  RETURN 'descartado';
END;
$$;
REVOKE ALL ON FUNCTION public.dismiss_yappy_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_yappy_payment(uuid, text) TO authenticated;

-- Atomic lease: PostgREST's conditional update alone cannot compare against database now().
CREATE FUNCTION public.claim_yappy_mail_sync() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id boolean;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.yappy_mail_sync_state SET sync_locked_until = now() + interval '5 minutes'
  WHERE id AND (sync_locked_until IS NULL OR sync_locked_until < now())
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_yappy_mail_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_yappy_mail_sync() TO service_role;

-- Safe sale labels for candidate cards and manual lookup; never exposes account credentials.
CREATE VIEW public.v_yappy_candidate_ventas
WITH (security_invoker = true) AS
SELECT v.id, concat_ws(' ', t.nombre, t.apellido) AS cliente, s.nombre AS servicio,
  v.perfil_numero, v.perfil_nombre, p.fecha_fin, p.total_original, p.moneda_original
FROM public.ventas v
JOIN public.terceros t ON t.id = v.cliente_id
JOIN public.servicios s ON s.id = v.servicio_id
JOIN LATERAL (
  SELECT vp.fecha_fin, vp.total_original, vp.moneda_original
  FROM public.venta_periodos vp WHERE vp.venta_id = v.id ORDER BY vp.numero_periodo DESC LIMIT 1
) p ON true
WHERE v.estado = 'activo' AND t.active AND (SELECT private.auth_role()) = 'admin'
  AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active);
REVOKE ALL ON public.v_yappy_candidate_ventas FROM PUBLIC, anon;
GRANT SELECT ON public.v_yappy_candidate_ventas TO authenticated, service_role;

-- Same vault pattern as trigger_executive_push: secret and URL are provisioned
-- after migration via vault.create_secret, never embedded in source control.
-- vault.create_secret('<YAPPY_SYNC_SECRET>', 'yappy_sync_secret');
-- vault.create_secret('https://system.movietimepty.top/api/yappy/sync', 'yappy_sync_url');
CREATE FUNCTION public.trigger_yappy_sync() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_secret text; v_url text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'yappy_sync_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'yappy_sync_url' LIMIT 1;
  IF v_secret IS NULL OR v_url IS NULL THEN RAISE EXCEPTION 'yappy sync vault configuration missing'; END IF;
  SELECT net.http_post(url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 240000) INTO v_request_id;
  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_yappy_sync() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('yappy-sync-tick', '*/10 * * * *', $cron$SELECT public.trigger_yappy_sync();$cron$);

