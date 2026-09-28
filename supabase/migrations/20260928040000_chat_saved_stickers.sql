-- Shared sticker library for the chat module. Stickers are saved from
-- inbound WhatsApp messages (media already uploaded to Meta), so this table
-- only stores the Meta media id and mime type, not the binary itself.
CREATE TABLE public.chat_saved_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id TEXT NOT NULL UNIQUE CHECK (media_id ~ '^[0-9]{1,32}$'),
  mime_type TEXT NOT NULL CHECK (mime_type = 'image/webp'),
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX chat_saved_stickers_created_idx ON public.chat_saved_stickers(created_at DESC);

ALTER TABLE public.chat_saved_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_saved_stickers_admin_select ON public.chat_saved_stickers
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY chat_saved_stickers_admin_insert ON public.chat_saved_stickers
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.auth_role()) = 'admin' AND created_by = (SELECT auth.uid()));
CREATE POLICY chat_saved_stickers_admin_delete ON public.chat_saved_stickers
  FOR DELETE TO authenticated USING ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON public.chat_saved_stickers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.chat_saved_stickers TO authenticated;
