-- WhatsApp Cloud API webhook inbox.
-- Stores inbound customer messages and outbound delivery statuses received from
-- Meta. Rows are written only by the server (service role) after the webhook
-- signature is verified; authenticated admins can read them. Meta retries
-- deliveries, so the natural message ids are unique to keep ingestion idempotent.

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id TEXT NOT NULL UNIQUE,
  phone_number_id TEXT NOT NULL,
  from_wa_id TEXT NOT NULL,
  contact_name TEXT,
  message_type TEXT NOT NULL,
  text_body TEXT,
  sent_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  processed_at TIMESTAMPTZ,
  CONSTRAINT whatsapp_inbound_messages_text_body_length CHECK (
    text_body IS NULL OR char_length(text_body) <= 4096
  )
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_messages_from_sent
  ON public.whatsapp_inbound_messages(from_wa_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_messages_unprocessed
  ON public.whatsapp_inbound_messages(received_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_inbound_messages_admin_read ON public.whatsapp_inbound_messages;
CREATE POLICY whatsapp_inbound_messages_admin_read ON public.whatsapp_inbound_messages
  FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON public.whatsapp_inbound_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_inbound_messages TO authenticated;

CREATE TABLE IF NOT EXISTS public.whatsapp_message_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient_wa_id TEXT NOT NULL,
  status_at TIMESTAMPTZ NOT NULL,
  error_code INTEGER,
  error_title TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT whatsapp_message_statuses_status_valid CHECK (
    status IN ('sent', 'delivered', 'read', 'failed')
  ),
  CONSTRAINT whatsapp_message_statuses_unique_transition UNIQUE (wa_message_id, status)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_statuses_recipient
  ON public.whatsapp_message_statuses(recipient_wa_id, status_at DESC);

ALTER TABLE public.whatsapp_message_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_message_statuses_admin_read ON public.whatsapp_message_statuses;
CREATE POLICY whatsapp_message_statuses_admin_read ON public.whatsapp_message_statuses
  FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON public.whatsapp_message_statuses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_message_statuses TO authenticated;
