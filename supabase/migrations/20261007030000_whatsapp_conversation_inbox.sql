-- One durable inbox, enqueued in the same transaction as webhook ingestion.
-- Existing messages are intentionally not replayed during expansion.
-- Identity was retained by the restoration. Reuse its generated wa_id.
CREATE INDEX terceros_active_wa_id ON public.terceros(wa_id) WHERE active;

-- The old conversation table survived the rollback; expand it and preserve rows.
ALTER TABLE public.whatsapp_conversation_state
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'bot' CHECK (mode IN ('bot', 'human')),
  ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN operator_id UUID REFERENCES public.usuarios(id),
  ADD COLUMN active_process TEXT,
  ADD COLUMN order_id UUID,
  ADD COLUMN handoff_reason TEXT,
  ADD COLUMN context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  ADD COLUMN lease_token UUID,
  ADD COLUMN locked_until TIMESTAMPTZ,
  ALTER COLUMN flow_version DROP NOT NULL,
  ALTER COLUMN node_id SET DEFAULT 'menu',
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '72 hours');
UPDATE public.whatsapp_conversation_state SET mode = 'human', handoff_reason = 'previous_handoff' WHERE owner = 'humano';
ALTER TABLE public.whatsapp_conversation_state DROP CONSTRAINT whatsapp_conversation_state_wa_id_check;
ALTER TABLE public.whatsapp_conversation_state ADD CONSTRAINT whatsapp_conversation_state_wa_id_check CHECK (wa_id ~ '^[0-9]{5,20}$');
CREATE TABLE public.whatsapp_automation_inbox (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wa_message_id TEXT NOT NULL UNIQUE REFERENCES public.whatsapp_inbound_messages(wa_message_id),
  wa_id TEXT NOT NULL REFERENCES public.whatsapp_conversation_state(wa_id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'leased', 'done', 'review')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_token UUID,
  fence BIGINT,
  last_error_code TEXT,
  completed_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.usuarios(id),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX whatsapp_automation_inbox_pending ON public.whatsapp_automation_inbox(available_at, id)
  WHERE status IN ('queued', 'leased');
CREATE INDEX whatsapp_automation_inbox_conversation ON public.whatsapp_automation_inbox(wa_id, id);
ALTER TABLE public.whatsapp_conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_automation_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_conversation_state, public.whatsapp_automation_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_conversation_state, public.whatsapp_automation_inbox TO authenticated;
GRANT ALL ON public.whatsapp_conversation_state, public.whatsapp_automation_inbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.whatsapp_automation_inbox_id_seq TO service_role;
CREATE POLICY conversation_admin_read ON public.whatsapp_conversation_state FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY inbox_admin_read ON public.whatsapp_automation_inbox FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

CREATE FUNCTION private.enqueue_whatsapp_automation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.whatsapp_conversation_state(wa_id) VALUES (NEW.from_wa_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.whatsapp_automation_inbox(wa_message_id, wa_id)
    VALUES (NEW.wa_message_id, NEW.from_wa_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enqueue_whatsapp_automation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enqueue_whatsapp_automation AFTER INSERT ON public.whatsapp_inbound_messages
  FOR EACH ROW EXECUTE FUNCTION private.enqueue_whatsapp_automation();

CREATE FUNCTION public.claim_whatsapp_automation(p_lease_seconds INTEGER DEFAULT 90) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.whatsapp_conversation_state; j public.whatsapp_automation_inbox; token UUID := gen_random_uuid();
BEGIN
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 300 THEN RAISE EXCEPTION 'Invalid lease'; END IF;
  -- Lock the conversation first. This also serializes operator changes and fences stale workers.
  SELECT cs.* INTO c FROM public.whatsapp_conversation_state cs
    WHERE cs.mode = 'bot' AND (cs.locked_until IS NULL OR cs.locked_until < now())
    AND EXISTS (SELECT 1 FROM public.whatsapp_automation_inbox i WHERE i.wa_id = cs.wa_id
      AND i.status IN ('queued', 'leased') AND i.available_at <= now()
      AND NOT EXISTS (SELECT 1 FROM public.whatsapp_automation_inbox earlier
        WHERE earlier.wa_id = i.wa_id AND earlier.id < i.id AND earlier.status <> 'done'))
    ORDER BY cs.updated_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO j FROM public.whatsapp_automation_inbox WHERE wa_id = c.wa_id AND status <> 'done' ORDER BY id LIMIT 1;
  IF j.attempts >= 5 THEN
    UPDATE public.whatsapp_automation_inbox SET status = 'review', last_error_code = 'LEASE_EXHAUSTED' WHERE id = j.id;
    UPDATE public.whatsapp_conversation_state SET mode = 'human', handoff_reason = 'retry_exhausted',
      lease_token = NULL, locked_until = NULL, updated_at = now() WHERE wa_id = c.wa_id;
    RETURN NULL;
  END IF;
  UPDATE public.whatsapp_conversation_state SET version = version + 1, lease_token = token,
    locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    WHERE wa_id = c.wa_id RETURNING * INTO c;
  UPDATE public.whatsapp_automation_inbox SET status = 'leased', attempts = attempts + 1,
    lease_token = token, fence = c.version WHERE id = j.id RETURNING * INTO j;
  RETURN jsonb_build_object('id', j.id, 'attempts', j.attempts, 'token', token, 'fence', c.version,
    'conversation', to_jsonb(c), 'message', (SELECT to_jsonb(m) FROM public.whatsapp_inbound_messages m WHERE m.wa_message_id = j.wa_message_id));
END;
$$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_automation(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_automation(INTEGER) TO service_role;

CREATE FUNCTION public.check_whatsapp_automation_lease(p_wa_id TEXT, p_token UUID, p_fence BIGINT) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.whatsapp_conversation_state WHERE wa_id = p_wa_id AND mode = 'bot'
    AND lease_token = p_token AND version = p_fence AND locked_until > now());
$$;
REVOKE ALL ON FUNCTION public.check_whatsapp_automation_lease(TEXT, UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_whatsapp_automation_lease(TEXT, UUID, BIGINT) TO service_role;

CREATE FUNCTION public.checkpoint_whatsapp_automation(p_wa_id TEXT, p_token UUID, p_fence BIGINT,
  p_context JSONB, p_process TEXT, p_order_id UUID, p_flow_version INTEGER) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p_context) <> 'object' OR octet_length(p_context::text) > 65536 THEN RAISE EXCEPTION 'Invalid context'; END IF;
  UPDATE public.whatsapp_conversation_state SET context = p_context, active_process = p_process,
    order_id = p_order_id, flow_version = coalesce(flow_version, p_flow_version), updated_at = now()
    WHERE wa_id = p_wa_id AND mode = 'bot' AND lease_token = p_token AND version = p_fence AND locked_until > now();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.checkpoint_whatsapp_automation(TEXT, UUID, BIGINT, JSONB, TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkpoint_whatsapp_automation(TEXT, UUID, BIGINT, JSONB, TEXT, UUID, INTEGER) TO service_role;

CREATE FUNCTION public.finish_whatsapp_automation(p_id BIGINT, p_token UUID, p_fence BIGINT,
  p_outcome TEXT, p_context JSONB DEFAULT NULL, p_process TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL, p_flow_version INTEGER DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.whatsapp_conversation_state; j public.whatsapp_automation_inbox;
BEGIN
  IF p_outcome NOT IN ('done', 'retry', 'review', 'handoff') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
  SELECT cs.* INTO c FROM public.whatsapp_conversation_state cs JOIN public.whatsapp_automation_inbox i ON i.wa_id = cs.wa_id
    WHERE i.id = p_id FOR UPDATE OF cs;
  IF NOT FOUND OR c.lease_token IS DISTINCT FROM p_token OR c.version <> p_fence OR c.locked_until <= now() OR c.mode <> 'bot' THEN RETURN FALSE; END IF;
  SELECT * INTO j FROM public.whatsapp_automation_inbox WHERE id = p_id;
  IF j.status <> 'leased' OR j.lease_token IS DISTINCT FROM p_token THEN RETURN FALSE; END IF;
  UPDATE public.whatsapp_automation_inbox SET
    status = CASE WHEN p_outcome IN ('done', 'handoff') THEN 'done' WHEN p_outcome = 'review' OR attempts >= 5 THEN 'review' ELSE 'queued' END,
    available_at = now() + make_interval(secs => least(900, 15 * (2 ^ least(attempts, 6))::integer)),
    completed_at = CASE WHEN p_outcome IN ('done', 'handoff') THEN now() END,
    last_error_code = CASE WHEN p_outcome = 'retry' THEN 'PROCESSING_FAILED' WHEN p_outcome = 'review' THEN 'DELIVERY_UNCERTAIN' ELSE NULL END,
    lease_token = NULL WHERE id = p_id;
  UPDATE public.whatsapp_conversation_state SET lease_token = NULL, locked_until = NULL,
    context = coalesce(p_context, context), active_process = coalesce(p_process, active_process),
    order_id = coalesce(p_order_id, order_id), flow_version = coalesce(flow_version, p_flow_version),
    mode = CASE WHEN p_outcome IN ('review', 'handoff') OR (p_outcome = 'retry' AND j.attempts >= 5) THEN 'human' ELSE mode END,
    handoff_reason = CASE WHEN p_outcome = 'handoff' THEN 'requested' WHEN p_outcome = 'review' THEN 'delivery_uncertain'
      WHEN p_outcome = 'retry' AND j.attempts >= 5 THEN 'retry_exhausted' ELSE handoff_reason END,
    updated_at = now() WHERE wa_id = c.wa_id;
  IF p_outcome IN ('done', 'handoff') THEN
    UPDATE public.whatsapp_inbound_messages SET processed_at = now() WHERE wa_message_id = j.wa_message_id;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_whatsapp_automation(BIGINT, UUID, BIGINT, TEXT, JSONB, TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_whatsapp_automation(BIGINT, UUID, BIGINT, TEXT, JSONB, TEXT, UUID, INTEGER) TO service_role;

CREATE FUNCTION public.set_whatsapp_conversation_mode(p_wa_id TEXT, p_mode TEXT, p_version BIGINT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.whatsapp_conversation_state;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_wa_id IS NULL OR p_mode IS NULL OR p_version IS NULL OR p_version < 0
    OR p_wa_id !~ '^[0-9]{5,20}$' OR p_mode NOT IN ('bot', 'human') THEN RAISE EXCEPTION 'Invalid conversation'; END IF;
  INSERT INTO public.whatsapp_conversation_state(wa_id) VALUES (p_wa_id) ON CONFLICT DO NOTHING;
  SELECT * INTO c FROM public.whatsapp_conversation_state WHERE wa_id = p_wa_id FOR UPDATE;
  IF c.version <> p_version THEN RETURN FALSE; END IF;
  -- Uncertain external delivery requires resolution before resuming automatic replies.
  IF p_mode = 'bot' AND EXISTS (SELECT 1 FROM public.whatsapp_automation_inbox WHERE wa_id = p_wa_id AND status = 'review') THEN RETURN FALSE; END IF;
  UPDATE public.whatsapp_conversation_state SET mode = p_mode, version = version + 1, lease_token = NULL,
    locked_until = NULL, operator_id = CASE WHEN p_mode = 'human' THEN auth.uid() END,
    handoff_reason = CASE WHEN p_mode = 'human' THEN 'operator' END, updated_at = now() WHERE wa_id = p_wa_id;
  UPDATE public.whatsapp_automation_inbox SET status = 'queued', lease_token = NULL WHERE wa_id = p_wa_id AND status = 'leased';
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.set_whatsapp_conversation_mode(TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_whatsapp_conversation_mode(TEXT, TEXT, BIGINT) TO authenticated;

CREATE FUNCTION public.resolve_whatsapp_automation_review(p_wa_id TEXT, p_version BIGINT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.whatsapp_conversation_state;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.whatsapp_conversation_state WHERE wa_id = p_wa_id FOR UPDATE;
  IF NOT FOUND OR p_version IS NULL OR c.version <> p_version OR c.mode <> 'human' THEN RETURN FALSE; END IF;
  WITH completed AS (
    UPDATE public.whatsapp_automation_inbox SET status = 'done', completed_at = now(), resolved_by = auth.uid(), resolved_at = now()
      WHERE wa_id = p_wa_id AND status = 'review' RETURNING wa_message_id
  ) UPDATE public.whatsapp_inbound_messages SET processed_at = now()
      WHERE wa_message_id IN (SELECT wa_message_id FROM completed);
  UPDATE public.whatsapp_conversation_state SET version = version + 1, handoff_reason = 'operator', updated_at = now() WHERE wa_id = p_wa_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_whatsapp_automation_review(TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_whatsapp_automation_review(TEXT, BIGINT) TO authenticated;
