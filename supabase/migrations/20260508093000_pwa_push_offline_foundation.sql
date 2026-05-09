-- ============================================================================
-- PWA push/offline foundation
-- - Extiende config con push ejecutiva diaria
-- - Registra suscripciones web push por dispositivo
-- ============================================================================

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS executive_push_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS executive_push_send_time TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS executive_push_timezone TEXT NOT NULL DEFAULT 'America/Bogota',
  ADD COLUMN IF NOT EXISTS executive_push_selected_blocks JSONB NOT NULL DEFAULT '["clientes_por_notificar","ventas_por_vencer","servicios_por_pagar_hoy","monto_a_pagar_hoy","monto_a_fondear"]'::jsonb,
  ADD COLUMN IF NOT EXISTS executive_push_block_order JSONB NOT NULL DEFAULT '["clientes_por_notificar","ventas_por_vencer","servicios_por_pagar_hoy","monto_a_pagar_hoy","monto_a_fondear"]'::jsonb,
  ADD COLUMN IF NOT EXISTS executive_push_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  user_agent TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_enabled
  ON public.push_subscriptions(enabled);

DROP TRIGGER IF EXISTS set_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER set_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_self_or_admin ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_self_or_admin ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update_self_or_admin ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_self_or_admin ON public.push_subscriptions;

CREATE POLICY push_subscriptions_select_self_or_admin ON public.push_subscriptions
  FOR SELECT
  USING (user_id = auth.uid() OR (SELECT private.auth_role()) = 'admin');

CREATE POLICY push_subscriptions_insert_self_or_admin ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR (SELECT private.auth_role()) = 'admin');

CREATE POLICY push_subscriptions_update_self_or_admin ON public.push_subscriptions
  FOR UPDATE
  USING (user_id = auth.uid() OR (SELECT private.auth_role()) = 'admin')
  WITH CHECK (user_id = auth.uid() OR (SELECT private.auth_role()) = 'admin');

CREATE POLICY push_subscriptions_delete_self_or_admin ON public.push_subscriptions
  FOR DELETE
  USING (user_id = auth.uid() OR (SELECT private.auth_role()) = 'admin');
