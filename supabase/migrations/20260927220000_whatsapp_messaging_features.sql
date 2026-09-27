-- WhatsApp messaging features: quoted replies, reactions, interactive replies,
-- location/contact cards and outbound media. Expand-only for the running app:
-- new nullable columns, widened checks (the previous app only writes text and
-- template rows, which stay valid) and view columns appended at the end.

ALTER TABLE public.whatsapp_inbound_messages
  ADD COLUMN IF NOT EXISTS context_wa_message_id TEXT,
  ADD COLUMN IF NOT EXISTS reaction_emoji TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.whatsapp_outbound_messages
  ADD COLUMN IF NOT EXISTS context_wa_message_id TEXT,
  ADD COLUMN IF NOT EXISTS media_id TEXT,
  ADD COLUMN IF NOT EXISTS media_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS media_filename TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.whatsapp_outbound_messages
  DROP CONSTRAINT IF EXISTS whatsapp_outbound_messages_kind_valid;
ALTER TABLE public.whatsapp_outbound_messages
  ADD CONSTRAINT whatsapp_outbound_messages_kind_valid CHECK (
    message_kind IN ('text', 'template', 'image', 'document', 'audio', 'reaction', 'interactive', 'location', 'contacts')
  );

ALTER TABLE public.whatsapp_outbound_messages
  DROP CONSTRAINT IF EXISTS whatsapp_outbound_messages_payload_shape;
ALTER TABLE public.whatsapp_outbound_messages
  ADD CONSTRAINT whatsapp_outbound_messages_payload_shape CHECK (
    (message_kind = 'text' AND text_body IS NOT NULL AND template_name IS NULL)
    OR (message_kind = 'template' AND template_name IS NOT NULL)
    OR (message_kind IN ('image', 'document', 'audio') AND media_id IS NOT NULL)
    OR (message_kind = 'reaction' AND context_wa_message_id IS NOT NULL)
    OR (message_kind IN ('interactive', 'location', 'contacts'))
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_messages_wa_message_id_context
  ON public.whatsapp_inbound_messages(context_wa_message_id)
  WHERE context_wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_messages_media_id
  ON public.whatsapp_outbound_messages(media_id)
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
  m.media_filename,
  m.wa_message_id,
  m.context_wa_message_id,
  m.reaction_emoji,
  m.payload,
  '[]'::jsonb AS template_params
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
  o.media_id,
  o.media_mime_type,
  o.media_filename,
  o.wa_message_id,
  o.context_wa_message_id,
  CASE WHEN o.message_kind = 'reaction' THEN o.payload ->> 'emoji' END AS reaction_emoji,
  o.payload,
  o.template_params
FROM public.whatsapp_outbound_messages o;

-- Las reacciones no cuentan como ultimo mensaje ni como no leidas, igual que en WhatsApp.
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
  WHERE message_kind <> 'reaction'
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
      AND u.message_type <> 'reaction'
      AND u.sent_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)
  )::integer AS unread_count,
  t.id AS tercero_id,
  CASE WHEN t.id IS NULL THEN NULL ELSE trim(t.nombre || ' ' || t.apellido) END AS tercero_nombre,
  (
    SELECT min(v.ultima_fecha_fin)
    FROM public.v_ventas_full v
    WHERE t.id IS NOT NULL
      AND v.cliente_id = t.id
      AND v.estado = 'activo'
      AND v.archivado_at IS NULL
  ) AS proxima_fecha_fin
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
