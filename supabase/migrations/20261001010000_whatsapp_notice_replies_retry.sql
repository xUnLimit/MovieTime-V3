-- La version anterior sigue pudiendo insertar respuestas con result = pending.
ALTER TABLE public.whatsapp_notice_replies
  ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN locked_until timestamptz,
  ADD COLUMN next_attempt_at timestamptz,
  ADD COLUMN last_error text;

ALTER TABLE public.whatsapp_notice_replies DROP CONSTRAINT whatsapp_notice_replies_result_check;
ALTER TABLE public.whatsapp_notice_replies ADD CONSTRAINT whatsapp_notice_replies_result_check
  CHECK (result IN ('pending', 'processing', 'accepted', 'failed', 'uncertain'));

-- Una fila `pending` de la version anterior pudo haber enviado ya el mensaje (credenciales incluidas) antes de morir:
-- reintentarla podria duplicarlo. Se marcan como inciertas (revision manual) y esta version nunca escribe `pending`.
UPDATE public.whatsapp_notice_replies
  SET result = 'uncertain', last_error = 'LEGACY_PENDING'
  WHERE result = 'pending';

CREATE INDEX whatsapp_notice_replies_retry_idx
  ON public.whatsapp_notice_replies (next_attempt_at, locked_until, id)
  WHERE result IN ('processing', 'failed');
CREATE INDEX whatsapp_inbound_notice_buttons_idx
  ON public.whatsapp_inbound_messages (sent_at, wa_message_id)
  WHERE message_type = 'button';

CREATE FUNCTION public.claim_whatsapp_notice_reply(
  p_notice_id uuid, p_action text, p_inbound_wa_message_id text
) RETURNS TABLE(reply_id bigint, attempts integer, outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_reply public.whatsapp_notice_replies%ROWTYPE;
BEGIN
  IF p_action NOT IN ('RENOVAR', 'NO_CONTINUAR', 'DATOS')
    OR p_inbound_wa_message_id IS NULL OR length(p_inbound_wa_message_id) > 256 THEN
    RAISE EXCEPTION 'invalid notice reply claim';
  END IF;

  INSERT INTO public.whatsapp_notice_replies
    (notice_id, action, inbound_wa_message_id, result, attempts, locked_until)
  VALUES (p_notice_id, p_action, p_inbound_wa_message_id,
    'processing', 1, now() + interval '5 minutes')
  ON CONFLICT (notice_id, action) DO NOTHING
  RETURNING * INTO v_reply;
  IF FOUND THEN
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'claimed'::text;
    RETURN;
  END IF;

  SELECT * INTO v_reply FROM public.whatsapp_notice_replies r
    WHERE r.notice_id = p_notice_id AND r.action = p_action FOR UPDATE;
  IF v_reply.inbound_wa_message_id <> p_inbound_wa_message_id OR v_reply.result = 'accepted' THEN
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'duplicate'::text;
  ELSIF v_reply.result IN ('uncertain', 'pending') THEN
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'uncertain'::text;
  ELSIF v_reply.attempts >= 5 THEN
    IF v_reply.result = 'processing' AND v_reply.locked_until <= now() THEN
      UPDATE public.whatsapp_notice_replies r SET result = 'failed',
        locked_until = NULL, next_attempt_at = NULL, last_error = 'ATTEMPTS_EXHAUSTED'
        WHERE r.id = v_reply.id;
    END IF;
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'exhausted'::text;
  ELSIF (v_reply.result = 'processing' AND v_reply.locked_until > now())
    OR (v_reply.result = 'failed' AND v_reply.next_attempt_at > now()) THEN
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'busy'::text;
  ELSE
    UPDATE public.whatsapp_notice_replies r SET result = 'processing',
      attempts = r.attempts + 1, locked_until = now() + interval '5 minutes',
      next_attempt_at = NULL, last_error = NULL
      WHERE r.id = v_reply.id RETURNING * INTO v_reply;
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'claimed'::text;
  END IF;
END;
$$;

CREATE FUNCTION public.finish_whatsapp_notice_reply(
  p_reply_id bigint, p_attempt integer, p_result text, p_error_label text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_updated bigint;
BEGIN
  IF p_result NOT IN ('accepted', 'failed', 'uncertain')
    OR (p_error_label IS NOT NULL AND p_error_label !~ '^[A-Z_]{1,64}$') THEN
    RAISE EXCEPTION 'invalid notice reply finish';
  END IF;
  UPDATE public.whatsapp_notice_replies r SET result = p_result,
    handled_at = now(), locked_until = NULL, last_error = p_error_label,
    next_attempt_at = CASE WHEN p_result = 'failed' AND r.attempts < 5
      THEN now() + (power(2, r.attempts - 1) * interval '1 minute') ELSE NULL END
    WHERE r.id = p_reply_id AND r.attempts = p_attempt AND r.result = 'processing'
    RETURNING r.id INTO v_updated;
  RETURN v_updated IS NOT NULL;
END;
$$;

CREATE FUNCTION public.list_retryable_whatsapp_notice_replies(p_limit integer)
RETURNS TABLE(reply_id bigint, notice_id uuid, action text, inbound_wa_message_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH candidates AS (
    SELECT r.id AS reply_id, r.notice_id, r.action, r.inbound_wa_message_id,
      0 AS priority, r.id AS sort_id
    FROM public.whatsapp_notice_replies r
    WHERE (r.result = 'processing' AND r.locked_until <= now())
      OR (r.result = 'failed' AND r.attempts < 5 AND r.next_attempt_at <= now())
    UNION ALL
    -- Recupera tambien un after() que fallo antes de crear la fila de respuesta.
    SELECT NULL::bigint, n.id, split_part(i.payload->>'payload', ':', 1), i.wa_message_id,
      1, 0::bigint
    FROM public.whatsapp_inbound_messages i
    JOIN public.whatsapp_notices n ON n.id = CASE
      WHEN i.payload->>'payload' ~ '^(RENOVAR|NO_CONTINUAR|DATOS):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN split_part(i.payload->>'payload', ':', 2)::uuid ELSE NULL END
      AND n.status = 'accepted' AND n.wa_id = i.from_wa_id
      AND (i.context_wa_message_id IS NULL OR i.context_wa_message_id = n.wa_message_id)
    WHERE i.message_type = 'button' AND i.payload->>'type' = 'template_button'
      AND i.sent_at >= now() - interval '30 days'
      AND i.payload->>'payload' ~ '^(RENOVAR|NO_CONTINUAR|DATOS):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND n.created_at >= now() - interval '30 days'
      AND ((split_part(i.payload->>'payload', ':', 1) = 'DATOS'
          AND n.tipo IN ('actualizacion_credenciales', 'transferencia_servicio'))
        OR (split_part(i.payload->>'payload', ':', 1) = 'NO_CONTINUAR'
          AND n.tipo IN ('notificacion_regular', 'dia_pago'))
        OR (split_part(i.payload->>'payload', ':', 1) = 'RENOVAR'
          AND n.tipo IN ('notificacion_regular', 'dia_pago', 'cancelacion')))
      AND NOT EXISTS (SELECT 1 FROM public.whatsapp_notice_replies r
        WHERE r.notice_id = n.id AND r.action = split_part(i.payload->>'payload', ':', 1))
  )
  SELECT c.reply_id, c.notice_id, c.action, c.inbound_wa_message_id
  FROM candidates c ORDER BY c.priority, c.sort_id, c.inbound_wa_message_id
  LIMIT least(greatest(coalesce(p_limit, 0), 0), 100);
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_notice_reply(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_whatsapp_notice_reply(bigint, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_retryable_whatsapp_notice_replies(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_notice_reply(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_whatsapp_notice_reply(bigint, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_retryable_whatsapp_notice_replies(integer) TO service_role;

-- Crear en Vault: whatsapp_auto_notices_secret (mismo valor que WHATSAPP_AUTO_NOTICES_SECRET)
-- y whatsapp_notice_replies_retry_url (HTTPS absoluto a /api/whatsapp/notice-replies/retry).
CREATE FUNCTION public.trigger_notice_reply_retries() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_secret text; v_url text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = 'whatsapp_auto_notices_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name = 'whatsapp_notice_replies_retry_url' LIMIT 1;
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 240000) INTO v_request_id;
  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_notice_reply_retries() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('whatsapp-notice-replies-retry-tick', '*/2 * * * *',
  $cron$SELECT public.trigger_notice_reply_retries();$cron$);
