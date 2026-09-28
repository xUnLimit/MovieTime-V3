-- Hide a WhatsApp message from the admin inbox only. Meta's Cloud API has no
-- endpoint to recall or delete a message once sent (unlike the consumer app),
-- so this never reaches the customer's phone: it just marks the row so the
-- view stops returning it here. Expand-only: nullable columns plus a view
-- redefinition that keeps every existing column in place.

ALTER TABLE public.whatsapp_inbound_messages
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_outbound_messages
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_messages_hidden
  ON public.whatsapp_inbound_messages(from_wa_id)
  WHERE hidden_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_messages_hidden
  ON public.whatsapp_outbound_messages(to_wa_id)
  WHERE hidden_at IS NOT NULL;

CREATE OR REPLACE VIEW public.v_whatsapp_messages
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.from_wa_id AS wa_id,
  'inbound'::text AS direction,
  m.message_type AS message_kind,
  m.text_body,
  NULL::text AS template_name,
  m.sent_at AS occurred_at,
  'received'::text AS status,
  m.media_id,
  m.media_mime_type,
  m.media_filename,
  m.wa_message_id,
  m.context_wa_message_id,
  m.reaction_emoji,
  m.payload,
  '[]'::jsonb AS template_params
FROM public.whatsapp_inbound_messages m
WHERE m.hidden_at IS NULL
UNION ALL
SELECT
  o.id,
  o.to_wa_id AS wa_id,
  'outbound'::text AS direction,
  o.message_kind,
  o.text_body,
  o.template_name,
  o.created_at AS occurred_at,
  COALESCE(
    (
      SELECT s.status
      FROM public.whatsapp_message_statuses s
      WHERE s.wa_message_id = o.wa_message_id
      ORDER BY
        CASE s.status WHEN 'failed' THEN 4 WHEN 'read' THEN 3 WHEN 'delivered' THEN 2 ELSE 1 END DESC
      LIMIT 1
    ),
    o.send_status
  ) AS status,
  o.media_id,
  o.media_mime_type,
  o.media_filename,
  o.wa_message_id,
  o.context_wa_message_id,
  CASE WHEN o.message_kind = 'reaction' THEN o.payload ->> 'emoji' END AS reaction_emoji,
  o.payload,
  o.template_params
FROM public.whatsapp_outbound_messages o
WHERE o.hidden_at IS NULL;

-- Marks one message as hidden for the admin inbox. Admin-only by RLS role
-- check; SECURITY DEFINER because the base tables grant no UPDATE to
-- authenticated (writes go through the server for outbound, the webhook for
-- inbound). Idempotent: hiding an already-hidden or missing row is a no-op.
CREATE FUNCTION public.hide_whatsapp_message(p_message_id uuid, p_direction text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR (SELECT private.auth_role()) <> 'admin'
    OR NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active)
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_direction NOT IN ('inbound', 'outbound') THEN RAISE EXCEPTION 'invalid direction'; END IF;
  IF p_direction = 'inbound' THEN
    UPDATE public.whatsapp_inbound_messages SET hidden_at = now(), hidden_by = auth.uid()
    WHERE id = p_message_id AND hidden_at IS NULL;
  ELSE
    UPDATE public.whatsapp_outbound_messages SET hidden_at = now(), hidden_by = auth.uid()
    WHERE id = p_message_id AND hidden_at IS NULL;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.hide_whatsapp_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_whatsapp_message(uuid, text) TO authenticated;

-- Approve the new RPC in the security audit (same allowlist shape as the
-- Yappy reconciliation RPCs it sits next to).
CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo'),
      ('yappy_mail_sync_state'), ('yappy_mail_messages'), ('yappy_payments')
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
      ('hide_whatsapp_message')
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
      ('hide_whatsapp_message')
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
$$;

REVOKE ALL ON FUNCTION public.run_security_audit_validations()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_audit_validations()
  TO service_role, postgres;

NOTIFY pgrst, 'reload schema';
