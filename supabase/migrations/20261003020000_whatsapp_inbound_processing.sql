-- Cola confiable de procesamiento de mensajes entrantes de WhatsApp.
-- Expand: columnas nuevas con defaults, compatibles con la version anterior de la app.
ALTER TABLE public.whatsapp_inbound_messages
  ADD COLUMN processing_attempts integer NOT NULL DEFAULT 0 CHECK (processing_attempts >= 0),
  ADD COLUMN processing_error text,
  ADD COLUMN processing_locked_until timestamptz;

-- Los mensajes anteriores ya fueron atendidos (o descartados) por after(): no se reprocesan nunca.
UPDATE public.whatsapp_inbound_messages SET processed_at = received_at WHERE processed_at IS NULL;

CREATE INDEX whatsapp_inbound_pending_idx
  ON public.whatsapp_inbound_messages (received_at, processing_locked_until)
  WHERE processed_at IS NULL;

-- Reclama un lote de mensajes sin procesar. El primer intento corresponde a after() del webhook:
-- solo se reclaman filas con mas de 1 minuto. SKIP LOCKED evita que dos workers tomen la misma fila.
CREATE FUNCTION public.claim_whatsapp_inbound_batch(p_limit integer, p_lock_seconds integer)
RETURNS TABLE(
  id uuid, wa_message_id text, phone_number_id text, from_wa_id text, contact_name text,
  message_type text, text_body text, sent_at timestamptz, media_id text, media_mime_type text,
  media_filename text, context_wa_message_id text, reaction_emoji text, payload jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT m.id FROM public.whatsapp_inbound_messages m
    WHERE m.processed_at IS NULL
      AND m.received_at <= now() - interval '1 minute'
      AND m.processing_attempts < 5
      AND (m.processing_locked_until IS NULL OR m.processing_locked_until <= now())
    ORDER BY m.received_at, m.id
    LIMIT least(greatest(coalesce(p_limit, 0), 0), 100)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.whatsapp_inbound_messages m
    SET processing_attempts = m.processing_attempts + 1,
        processing_locked_until = now() + make_interval(secs => least(greatest(coalesce(p_lock_seconds, 60), 10), 900))
    FROM picked WHERE m.id = picked.id
    RETURNING m.*
  )
  SELECT c.id, c.wa_message_id, c.phone_number_id, c.from_wa_id, c.contact_name,
    c.message_type, c.text_body, c.sent_at, c.media_id, c.media_mime_type,
    c.media_filename, c.context_wa_message_id, c.reaction_emoji, c.payload
  FROM claimed c ORDER BY c.received_at, c.id;
END;
$$;

-- p_error NULL: procesado (o ignorado de forma terminal). Con etiqueta: se libera con espera creciente.
CREATE FUNCTION public.finish_whatsapp_inbound(p_id uuid, p_error text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_updated uuid;
BEGIN
  IF p_error IS NOT NULL AND p_error !~ '^[A-Z_]{1,64}$' THEN
    RAISE EXCEPTION 'invalid inbound finish';
  END IF;
  IF p_error IS NULL THEN
    UPDATE public.whatsapp_inbound_messages m
      SET processed_at = now(), processing_error = NULL, processing_locked_until = NULL
      WHERE m.id = p_id AND m.processed_at IS NULL RETURNING m.id INTO v_updated;
  ELSE
    UPDATE public.whatsapp_inbound_messages m
      SET processing_error = p_error,
          processing_locked_until = now() + (greatest(m.processing_attempts, 1) * interval '1 minute')
      WHERE m.id = p_id AND m.processed_at IS NULL RETURNING m.id INTO v_updated;
  END IF;
  RETURN v_updated IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_inbound_batch(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_whatsapp_inbound(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_inbound_batch(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_whatsapp_inbound(uuid, text) TO service_role;

-- Crear en Vault (ademas de los de notice-replies): whatsapp_auto_notices_secret (mismo valor que
-- WHATSAPP_AUTO_NOTICES_SECRET) y whatsapp_inbound_retry_url (HTTPS absoluto a /api/whatsapp/inbound/retry).
CREATE FUNCTION public.trigger_whatsapp_inbound_retries() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_secret text; v_url text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = 'whatsapp_auto_notices_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name = 'whatsapp_inbound_retry_url' LIMIT 1;
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 240000) INTO v_request_id;
  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_whatsapp_inbound_retries() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('whatsapp-inbound-retry-tick', '*/2 * * * *',
  $cron$SELECT public.trigger_whatsapp_inbound_retries();$cron$);
