-- Adds the client's active service categories (Netflix, Crunchyroll, ...) to
-- the conversations view, so the chat inbox can auto-tag and filter by them
-- without the admin ever setting a label by hand.
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
  ) AS categorias_activas
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

REVOKE ALL ON public.v_whatsapp_conversations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_whatsapp_conversations TO authenticated;
