-- WhatsApp chat inbox: outbound messages, read markers and conversation views.
-- Outbound rows are written only by the server (service role) before calling
-- the Cloud API; the client-generated idempotency key makes a retried send
-- return the original row instead of messaging the customer twice.

CREATE TABLE IF NOT EXISTS public.whatsapp_outbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL UNIQUE,
  to_wa_id TEXT NOT NULL,
  message_kind TEXT NOT NULL,
  text_body TEXT,
  template_name TEXT,
  template_params JSONB NOT NULL DEFAULT '[]'::jsonb,
  send_status TEXT NOT NULL DEFAULT 'pending',
  wa_message_id TEXT UNIQUE,
  error_code INTEGER,
  error_title TEXT,
  sent_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT whatsapp_outbound_messages_kind_valid CHECK (message_kind IN ('text', 'template')),
  CONSTRAINT whatsapp_outbound_messages_status_valid CHECK (send_status IN ('pending', 'accepted', 'failed')),
  CONSTRAINT whatsapp_outbound_messages_text_body_length CHECK (
    text_body IS NULL OR char_length(text_body) <= 4096
  ),
  CONSTRAINT whatsapp_outbound_messages_payload_shape CHECK (
    (message_kind = 'text' AND text_body IS NOT NULL AND template_name IS NULL)
    OR (message_kind = 'template' AND template_name IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_messages_to_created
  ON public.whatsapp_outbound_messages(to_wa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_messages_sent_by
  ON public.whatsapp_outbound_messages(sent_by);

DROP TRIGGER IF EXISTS set_whatsapp_outbound_messages_updated_at ON public.whatsapp_outbound_messages;
CREATE TRIGGER set_whatsapp_outbound_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_outbound_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.whatsapp_outbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_outbound_messages_admin_read ON public.whatsapp_outbound_messages;
CREATE POLICY whatsapp_outbound_messages_admin_read ON public.whatsapp_outbound_messages
  FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON public.whatsapp_outbound_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_outbound_messages TO authenticated;

-- One read marker per conversation; admins mark chats as read from the UI.
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_reads (
  wa_id TEXT PRIMARY KEY,
  last_read_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS set_whatsapp_conversation_reads_updated_at ON public.whatsapp_conversation_reads;
CREATE TRIGGER set_whatsapp_conversation_reads_updated_at
  BEFORE UPDATE ON public.whatsapp_conversation_reads
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.whatsapp_conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_conversation_reads_admin_read ON public.whatsapp_conversation_reads;
CREATE POLICY whatsapp_conversation_reads_admin_read ON public.whatsapp_conversation_reads
  FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS whatsapp_conversation_reads_admin_insert ON public.whatsapp_conversation_reads;
CREATE POLICY whatsapp_conversation_reads_admin_insert ON public.whatsapp_conversation_reads
  FOR INSERT
  WITH CHECK ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS whatsapp_conversation_reads_admin_update ON public.whatsapp_conversation_reads;
CREATE POLICY whatsapp_conversation_reads_admin_update ON public.whatsapp_conversation_reads
  FOR UPDATE
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON public.whatsapp_conversation_reads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_conversation_reads TO authenticated;

-- Timeline of every message in both directions. Outbound status is the latest
-- delivery status reported by Meta, falling back to the local send status.
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
  'received'::text AS status
FROM public.whatsapp_inbound_messages m
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
  ) AS status
FROM public.whatsapp_outbound_messages o;

-- One row per customer number with the latest activity, the 24h customer
-- service window anchor, unread count and the matching tercero (by digits,
-- accepting numbers stored without the Panama country code).
CREATE OR REPLACE VIEW public.v_whatsapp_conversations
WITH (security_invoker = true)
AS
WITH last_message AS (
  SELECT DISTINCT ON (wa_id)
    wa_id,
    direction AS last_direction,
    COALESCE(text_body, template_name, message_kind) AS last_preview,
    occurred_at AS last_message_at
  FROM public.v_whatsapp_messages
  ORDER BY wa_id, occurred_at DESC
),
inbound AS (
  SELECT
    from_wa_id AS wa_id,
    max(sent_at) AS last_inbound_at,
    (array_agg(contact_name ORDER BY sent_at DESC) FILTER (WHERE contact_name IS NOT NULL))[1] AS contact_name
  FROM public.whatsapp_inbound_messages
  GROUP BY from_wa_id
)
SELECT
  lm.wa_id,
  lm.last_direction,
  lm.last_preview,
  lm.last_message_at,
  i.last_inbound_at,
  i.contact_name,
  (
    SELECT count(*)
    FROM public.whatsapp_inbound_messages u
    WHERE u.from_wa_id = lm.wa_id
      AND u.sent_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)
  )::integer AS unread_count,
  t.id AS tercero_id,
  CASE WHEN t.id IS NULL THEN NULL ELSE trim(t.nombre || ' ' || t.apellido) END AS tercero_nombre
FROM last_message lm
LEFT JOIN inbound i ON i.wa_id = lm.wa_id
LEFT JOIN public.whatsapp_conversation_reads r ON r.wa_id = lm.wa_id
LEFT JOIN LATERAL (
  SELECT te.id, te.nombre, te.apellido
  FROM public.terceros te
  WHERE te.active
    AND (
      regexp_replace(te.telefono, '\D', '', 'g') = lm.wa_id
      OR '507' || regexp_replace(te.telefono, '\D', '', 'g') = lm.wa_id
    )
  ORDER BY te.created_at
  LIMIT 1
) t ON true;

REVOKE ALL ON public.v_whatsapp_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_whatsapp_messages TO authenticated;
REVOKE ALL ON public.v_whatsapp_conversations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_whatsapp_conversations TO authenticated;
