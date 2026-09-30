-- Pin and archive flags for the chat inbox. One row per conversation, written
-- from the UI by admins. An archived chat comes back to the inbox on its own
-- when the customer writes again (a message newer than archived_at), so the
-- view computes "archived" instead of a trigger clearing the flag.
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_flags (
  wa_id TEXT PRIMARY KEY CHECK (wa_id ~ '^[0-9]{8,15}$'),
  pinned_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS set_whatsapp_conversation_flags_updated_at ON public.whatsapp_conversation_flags;
CREATE TRIGGER set_whatsapp_conversation_flags_updated_at
  BEFORE UPDATE ON public.whatsapp_conversation_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.whatsapp_conversation_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_conversation_flags_admin_read ON public.whatsapp_conversation_flags;
CREATE POLICY whatsapp_conversation_flags_admin_read ON public.whatsapp_conversation_flags
  FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS whatsapp_conversation_flags_admin_insert ON public.whatsapp_conversation_flags;
CREATE POLICY whatsapp_conversation_flags_admin_insert ON public.whatsapp_conversation_flags
  FOR INSERT
  WITH CHECK ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS whatsapp_conversation_flags_admin_update ON public.whatsapp_conversation_flags;
CREATE POLICY whatsapp_conversation_flags_admin_update ON public.whatsapp_conversation_flags
  FOR UPDATE
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON public.whatsapp_conversation_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_conversation_flags TO authenticated;

-- Same view as before plus pinned_at and archived, appended at the end so the
-- previous application version keeps working (expand step).
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
  ) AS proxima_fecha_fin,
  (
    SELECT array_agg(DISTINCT v.categoria_nombre ORDER BY v.categoria_nombre)
    FROM public.v_ventas_full v
    WHERE t.id IS NOT NULL
      AND v.cliente_id = t.id
      AND v.estado = 'activo'
      AND v.archivado_at IS NULL
      AND v.categoria_nombre IS NOT NULL
  ) AS categorias_activas,
  f.pinned_at,
  (f.archived_at IS NOT NULL AND (i.last_inbound_at IS NULL OR i.last_inbound_at <= f.archived_at)) AS archived
FROM last_message lm
LEFT JOIN inbound i ON i.wa_id = lm.wa_id
LEFT JOIN public.whatsapp_conversation_reads r ON r.wa_id = lm.wa_id
LEFT JOIN public.whatsapp_conversation_flags f ON f.wa_id = lm.wa_id
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

REVOKE ALL ON public.v_whatsapp_conversations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_whatsapp_conversations TO authenticated;
