-- Durable collection and explicit customer reports. Existing RPC contracts remain compatible.
ALTER TABLE public.whatsapp_bot_waits
  ADD COLUMN collect_minutes INTEGER NOT NULL DEFAULT 0 CHECK (collect_minutes BETWEEN 0 AND 60),
  ADD COLUMN collect_started_at TIMESTAMPTZ;
ALTER TABLE public.whatsapp_automation_inbox
  ADD COLUMN collect_key TIMESTAMPTZ,
  ADD COLUMN collect_until TIMESTAMPTZ,
  ADD COLUMN collection_root_id BIGINT REFERENCES public.whatsapp_automation_inbox(id),
  ADD COLUMN combined_text TEXT;
CREATE INDEX whatsapp_inbox_collection ON public.whatsapp_automation_inbox(wa_id, collect_key, id) WHERE collect_key IS NOT NULL;
CREATE INDEX whatsapp_inbox_collection_root ON public.whatsapp_automation_inbox(collection_root_id) WHERE collection_root_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.enqueue_whatsapp_automation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.whatsapp_conversation_state; w public.whatsapp_bot_waits; deadline TIMESTAMPTZ;
BEGIN
  INSERT INTO public.whatsapp_conversation_state(wa_id) VALUES (NEW.from_wa_id) ON CONFLICT DO NOTHING;
  -- Same lock order as claim and operator takeover. Arrival decides ownership atomically.
  SELECT * INTO c FROM public.whatsapp_conversation_state WHERE wa_id = NEW.from_wa_id FOR UPDATE;
  IF c.mode = 'human' THEN
    INSERT INTO public.whatsapp_automation_inbox(wa_message_id, wa_id, status, completed_at)
      VALUES (NEW.wa_message_id, NEW.from_wa_id, 'done', now()) ON CONFLICT DO NOTHING;
    UPDATE public.whatsapp_inbound_messages SET processed_at = now() WHERE wa_message_id = NEW.wa_message_id;
    RETURN NEW;
  END IF;
  IF NEW.message_type = 'text' AND NEW.text_body IS NOT NULL THEN
    SELECT * INTO w FROM public.whatsapp_bot_waits WHERE wa_id = NEW.from_wa_id AND expires_at > now() AND collect_minutes > 0 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.whatsapp_bot_waits SET collect_started_at = coalesce(collect_started_at, now()),
        expires_at = greatest(expires_at, coalesce(collect_started_at, now()) + make_interval(mins => collect_minutes) + interval '1 hour')
        WHERE wa_id = NEW.from_wa_id RETURNING * INTO w;
      deadline := w.collect_started_at + make_interval(mins => w.collect_minutes);
      IF now() <= deadline THEN
        INSERT INTO public.whatsapp_automation_inbox(wa_message_id, wa_id, available_at, collect_key, collect_until)
          VALUES (NEW.wa_message_id, NEW.from_wa_id, deadline, w.created_at, deadline) ON CONFLICT DO NOTHING;
        RETURN NEW;
      END IF;
    END IF;
  END IF;
  INSERT INTO public.whatsapp_automation_inbox(wa_message_id, wa_id) VALUES (NEW.wa_message_id, NEW.from_wa_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Handoff closes automatic work, including messages that were queued before the handoff.
-- On resume old work is history; only subsequent arrivals can activate the bot.
CREATE FUNCTION private.close_human_whatsapp_work() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.mode = 'human' OR OLD.mode = 'human' THEN
    WITH completed AS (
      UPDATE public.whatsapp_automation_inbox SET status = 'done', completed_at = now(), lease_token = NULL
        WHERE wa_id = NEW.wa_id AND status IN ('queued', 'leased') RETURNING wa_message_id
    ) UPDATE public.whatsapp_inbound_messages SET processed_at = now() WHERE wa_message_id IN (SELECT wa_message_id FROM completed);
    DELETE FROM public.whatsapp_bot_waits WHERE wa_id = NEW.wa_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.close_human_whatsapp_work() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER close_human_whatsapp_work AFTER UPDATE OF mode ON public.whatsapp_conversation_state
  FOR EACH ROW WHEN (OLD.mode IS DISTINCT FROM NEW.mode) EXECUTE FUNCTION private.close_human_whatsapp_work();

CREATE TABLE public.customer_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id TEXT NOT NULL REFERENCES public.whatsapp_conversation_state(wa_id),
  source_message_id TEXT NOT NULL UNIQUE REFERENCES public.whatsapp_inbound_messages(wa_message_id),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 65536),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.usuarios(id)
);
CREATE INDEX customer_reports_status_created ON public.customer_reports(status, created_at DESC);
CREATE INDEX customer_reports_wa_id ON public.customer_reports(wa_id);
CREATE INDEX customer_reports_updated_by ON public.customer_reports(updated_by) WHERE updated_by IS NOT NULL;
ALTER TABLE public.customer_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.customer_reports TO authenticated;
GRANT ALL ON public.customer_reports TO service_role;
CREATE POLICY customer_reports_admin_read ON public.customer_reports FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

CREATE FUNCTION public.create_customer_report(p_wa_id TEXT, p_message_id TEXT, p_description TEXT, p_token UUID, p_fence BIGINT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.whatsapp_conversation_state; report_id UUID;
BEGIN
  SELECT * INTO c FROM public.whatsapp_conversation_state WHERE wa_id = p_wa_id FOR UPDATE;
  IF NOT FOUND OR c.mode <> 'bot' OR c.lease_token IS DISTINCT FROM p_token OR c.version IS DISTINCT FROM p_fence OR c.locked_until <= now() THEN
    RAISE EXCEPTION 'Invalid automation lease';
  END IF;
  IF p_description IS NULL OR length(btrim(p_description)) NOT BETWEEN 1 AND 65536 OR NOT EXISTS (
    SELECT 1 FROM public.whatsapp_automation_inbox WHERE wa_id = p_wa_id AND wa_message_id = p_message_id
      AND status = 'leased' AND lease_token = p_token AND fence = p_fence
  ) THEN RAISE EXCEPTION 'Invalid report'; END IF;
  INSERT INTO public.customer_reports(wa_id, source_message_id, description) VALUES(p_wa_id, p_message_id, p_description)
    ON CONFLICT(source_message_id) DO UPDATE SET source_message_id = EXCLUDED.source_message_id RETURNING id INTO report_id;
  RETURN report_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_customer_report(TEXT,TEXT,TEXT,UUID,BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_report(TEXT,TEXT,TEXT,UUID,BIGINT) TO service_role;

CREATE FUNCTION public.update_customer_report(p_id UUID, p_status TEXT, p_version INTEGER) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_id IS NULL OR p_status IS NULL OR p_status NOT IN ('open','in_progress','resolved') OR p_version IS NULL OR p_version < 0 THEN RAISE EXCEPTION 'Invalid report'; END IF;
  UPDATE public.customer_reports SET status = p_status, version = version + 1, updated_at = now(), updated_by = auth.uid()
    WHERE id = p_id AND version = p_version;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.update_customer_report(UUID,TEXT,INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_report(UUID,TEXT,INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_automation(p_lease_seconds INTEGER DEFAULT 90) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.whatsapp_conversation_state; j public.whatsapp_automation_inbox; token UUID := gen_random_uuid(); combined TEXT;
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
  -- Freeze one batch before delivery. Retries reuse the same root and text.
  IF j.collect_until IS NOT NULL AND j.combined_text IS NULL THEN
    SELECT left(string_agg(m.text_body, E'\n\n' ORDER BY i.id), 65536) INTO combined
      FROM public.whatsapp_automation_inbox i JOIN public.whatsapp_inbound_messages m ON m.wa_message_id = i.wa_message_id
      WHERE i.wa_id = c.wa_id AND i.collect_key = j.collect_key AND i.status = 'queued';
    UPDATE public.whatsapp_automation_inbox SET collection_root_id = j.id
      WHERE wa_id = c.wa_id AND collect_key = j.collect_key AND status = 'queued' AND id <> j.id;
    UPDATE public.whatsapp_automation_inbox SET combined_text = combined WHERE id = j.id RETURNING * INTO j;
  END IF;
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
    'conversation', to_jsonb(c), 'message', (SELECT to_jsonb(m) || CASE WHEN j.combined_text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('text_body', j.combined_text) END FROM public.whatsapp_inbound_messages m WHERE m.wa_message_id = j.wa_message_id));
END;
$$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_automation(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_automation(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_whatsapp_automation(p_id BIGINT, p_token UUID, p_fence BIGINT,
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
  IF p_outcome IN ('done', 'handoff') THEN
    WITH completed AS (
      UPDATE public.whatsapp_automation_inbox SET status = 'done', completed_at = now()
        WHERE collection_root_id = j.id RETURNING wa_message_id
    ) UPDATE public.whatsapp_inbound_messages SET processed_at = now()
        WHERE wa_message_id IN (SELECT wa_message_id FROM completed);
  END IF;
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


-- Register the new admin RPC and RLS table in the existing audit contract.
-- Registra whatsapp_bot_waits (espera de la respuesta escrita del cliente) en la auditoria de seguridad: RLS activa y sin acceso para anon ni authenticated.
BEGIN;
CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo'),
      ('yappy_mail_sync_state'), ('yappy_mail_messages'), ('yappy_payments'),
      ('netflix_code_claims'), ('whatsapp_bot_config'), ('whatsapp_bot_versions'), ('whatsapp_bot_events'),
      ('pedidos'), ('pedido_items'), ('pedido_pagos'), ('pedido_operaciones'), ('pedido_excedentes'), ('pedido_exceso_resoluciones'), ('pedido_resoluciones'), ('mt_order_deliveries'),
      ('reservas_perfil'), ('intereses'), ('domain_events'), ('whatsapp_conversation_state'), ('whatsapp_automation_inbox'),
      ('mt_service_access'), ('mt_automation_settings'), ('mt_ai_budget'), ('mt_integration_deliveries'), ('mt_integration_limits'), ('mt_interest_deliveries'),
      ('mt_commerce_copy'),
      ('whatsapp_bot_waits'), ('customer_reports')
  ),
  allowed_authenticated_security_definer(function_name) AS (
    VALUES
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('get_dashboard_stats_snapshot'),
      ('get_dashboard_churn_stats'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments'),
      ('create_venta_refund'),
      ('upsert_notification_aggregate'),
      ('resolve_yappy_payment'),
      ('dismiss_yappy_payment'),
      ('hide_whatsapp_message'),
      ('is_authenticated'),
      ('publish_whatsapp_bot_version'),
      ('set_whatsapp_bot_enabled'),
      ('mt_panel_checkout'), ('mt_list_orders'), ('mt_order_command'), ('mt_reconcile_order'), ('mt_resolve_excess'),
      ('set_whatsapp_conversation_mode'), ('resolve_whatsapp_automation_review'), ('mt_set_service_access'), ('mt_update_automation_settings'), ('mt_manage_interest'),
      ('mt_claim_order_delivery'), ('mt_order_delivery_access'), ('mt_finish_order_delivery'), ('mt_retry_order_delivery'),
      ('mt_order_resolution_quote'), ('mt_resolve_order'),
      ('mt_set_commerce_copy'),
      ('update_customer_report'), ('mt_delete_order'), ('mt_register_order_payment'), ('mt_mark_order_delivered')
  ),
  required_authenticated_rpcs(function_name) AS (
    VALUES
      ('create_venta_with_initial_payment'),
      ('create_servicio_with_initial_payment'),
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('get_dashboard_stats_snapshot'),
      ('get_dashboard_churn_stats'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments'),
      ('create_venta_refund'),
      ('upsert_notification_aggregate'),
      ('hide_whatsapp_message'),
      ('mt_panel_checkout'), ('mt_list_orders'), ('mt_order_command'), ('mt_reconcile_order'), ('mt_resolve_excess'),
      ('set_whatsapp_conversation_mode'), ('resolve_whatsapp_automation_review'), ('mt_set_service_access'), ('mt_update_automation_settings'), ('mt_manage_interest'),
      ('mt_claim_order_delivery'), ('mt_order_delivery_access'), ('mt_finish_order_delivery'), ('mt_retry_order_delivery'),
      ('mt_order_resolution_quote'), ('mt_resolve_order'),
      ('mt_set_commerce_copy'),
      ('update_customer_report'), ('mt_delete_order'), ('mt_register_order_payment'), ('mt_mark_order_delivered')
  ),
  public_functions AS (
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  )
  SELECT jsonb_build_object(
    'rls_disabled_app_tables', (
      SELECT count(*) FROM app_tables AS t
      JOIN pg_class AS c ON c.relname = t.table_name
      JOIN pg_namespace AS n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r' AND c.relrowsecurity = false
    ),
    'security_definer_missing_search_path', (
      SELECT count(*) FROM public_functions
      WHERE prosecdef = true
        AND NOT EXISTS (
          SELECT 1 FROM unnest(COALESCE(proconfig, ARRAY[]::TEXT[])) AS cfg
          WHERE cfg LIKE 'search_path=%'
        )
    ),
    'security_definer_executable_by_anon', (
      SELECT count(*) FROM public_functions
      WHERE prosecdef = true AND has_function_privilege('anon', oid, 'EXECUTE')
    ),
    'unapproved_security_definer_executable_by_authenticated', (
      SELECT count(*) FROM public_functions AS pf
      WHERE prosecdef = true
        AND has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1 FROM allowed_authenticated_security_definer AS allowed
          WHERE allowed.function_name = pf.proname
        )
    ),
    'required_rpc_missing_authenticated_execute', (
      SELECT count(*) FROM required_authenticated_rpcs AS required
      WHERE NOT EXISTS (
        SELECT 1 FROM public_functions AS pf
        WHERE pf.proname = required.function_name
          AND has_function_privilege('authenticated', pf.oid, 'EXECUTE')
      )
    ),
    'required_rpc_executable_by_anon', (
      SELECT count(*) FROM required_authenticated_rpcs AS required
      JOIN public_functions AS pf ON pf.proname = required.function_name
      WHERE has_function_privilege('anon', pf.oid, 'EXECUTE')
    )
  );
$function$
;
REVOKE ALL ON FUNCTION public.run_security_audit_validations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_audit_validations() TO service_role, postgres;
COMMIT;
