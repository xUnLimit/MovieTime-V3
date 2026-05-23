-- ============================================================================
-- Feature flags foundation
-- - Read-only client access for authenticated users
-- - Write access remains server/admin-only until an admin UI is designed
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9][a-z0-9_:-]{1,120}$'),
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS trg_touch_feature_flags ON public.feature_flags;
CREATE TRIGGER trg_touch_feature_flags
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_select_authenticated ON public.feature_flags;

CREATE POLICY feature_flags_select_authenticated ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (public.is_authenticated());

GRANT SELECT ON public.feature_flags TO authenticated;
