-- Media attachments on inbound WhatsApp messages (payment receipts, audio,
-- documents). Only Meta's media id is stored; the file itself is fetched on
-- demand through an admin-only proxy, so no customer files live in the database.
-- Expand-only: new nullable columns and view columns appended at the end.

ALTER TABLE public.whatsapp_inbound_messages
  ADD COLUMN IF NOT EXISTS media_id TEXT,
  ADD COLUMN IF NOT EXISTS media_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS media_filename TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_messages_media_id
  ON public.whatsapp_inbound_messages(media_id)
  WHERE media_id IS NOT NULL;

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
  m.media_filename
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
  ) AS status,
  NULL::text AS media_id,
  NULL::text AS media_mime_type,
  NULL::text AS media_filename
FROM public.whatsapp_outbound_messages o;

REVOKE ALL ON public.v_whatsapp_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_whatsapp_messages TO authenticated;
