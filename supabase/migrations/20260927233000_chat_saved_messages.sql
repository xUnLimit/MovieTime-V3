-- Shared library for chat messages. This table is independent of the
-- notification templates used by scheduled business workflows.
CREATE FUNCTION public.chat_saved_message_options_valid(payload JSONB, message_kind TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  item JSONB;
  item_title TEXT;
  seen_titles TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF jsonb_typeof(payload) <> 'array' THEN RETURN FALSE; END IF;
  IF message_kind = 'text' THEN RETURN jsonb_array_length(payload) = 0; END IF;

  FOR item IN SELECT jsonb_array_elements(payload) LOOP
    IF jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item -> 'title') <> 'string'
      OR jsonb_typeof(item -> 'description') <> 'string' THEN
      RETURN FALSE;
    END IF;
    item_title := btrim(item ->> 'title');
    IF char_length(item_title) NOT BETWEEN 1 AND CASE WHEN message_kind = 'buttons' THEN 20 ELSE 24 END
      OR lower(item_title) = ANY(seen_titles)
      OR char_length(item ->> 'description') > CASE WHEN message_kind = 'buttons' THEN 0 ELSE 72 END THEN
      RETURN FALSE;
    END IF;
    seen_titles := array_append(seen_titles, lower(item_title));
  END LOOP;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_saved_message_options_valid(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_saved_message_options_valid(JSONB, TEXT) TO authenticated, service_role;

CREATE TABLE public.chat_saved_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'buttons', 'list')),
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4096),
  button_label TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT chat_saved_messages_options_array CHECK (jsonb_typeof(options) = 'array'),
  CONSTRAINT chat_saved_messages_options_valid CHECK (public.chat_saved_message_options_valid(options, kind)),
  CONSTRAINT chat_saved_messages_payload_shape CHECK (
    (kind = 'text' AND options = '[]'::jsonb AND button_label IS NULL)
    OR (kind = 'buttons' AND char_length(body) <= 1024 AND jsonb_array_length(options) BETWEEN 1 AND 3 AND button_label IS NULL)
    OR (kind = 'list' AND char_length(body) <= 1024 AND jsonb_array_length(options) BETWEEN 1 AND 10
      AND char_length(btrim(coalesce(button_label, ''))) BETWEEN 1 AND 20)
  )
);

CREATE INDEX chat_saved_messages_updated_idx ON public.chat_saved_messages(updated_at DESC);

CREATE TRIGGER set_chat_saved_messages_updated_at
  BEFORE UPDATE ON public.chat_saved_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.chat_saved_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_saved_messages_admin_select ON public.chat_saved_messages
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY chat_saved_messages_admin_insert ON public.chat_saved_messages
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.auth_role()) = 'admin' AND created_by = (SELECT auth.uid()));
CREATE POLICY chat_saved_messages_admin_update ON public.chat_saved_messages
  FOR UPDATE TO authenticated USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY chat_saved_messages_admin_delete ON public.chat_saved_messages
  FOR DELETE TO authenticated USING ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON public.chat_saved_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.chat_saved_messages TO authenticated;
GRANT UPDATE (title, kind, body, button_label, options) ON public.chat_saved_messages TO authenticated;
