-- Reserve each notice action once before its side effects. A failed action remains
-- visible for manual review and is never retried by another webhook delivery.
CREATE TABLE public.whatsapp_notice_replies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notice_id uuid NOT NULL REFERENCES public.whatsapp_notices(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('RENOVAR', 'NO_CONTINUAR', 'DATOS')),
  inbound_wa_message_id text NOT NULL UNIQUE,
  handled_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'accepted', 'failed')),
  UNIQUE (notice_id, action)
);

ALTER TABLE public.whatsapp_notice_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_notice_replies_admin_read ON public.whatsapp_notice_replies
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = (SELECT auth.uid()) AND u.active));
REVOKE ALL ON public.whatsapp_notice_replies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_notice_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_notice_replies TO service_role;
