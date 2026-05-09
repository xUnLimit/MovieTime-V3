-- ============================================================================
-- Executive push disabled by default
-- - Keep the scheduler opt-in. Existing config rows created before the UI
--   decision should not start enabled by accident.
-- ============================================================================

ALTER TABLE public.config
  ALTER COLUMN executive_push_enabled SET DEFAULT false;

UPDATE public.config
SET
  executive_push_enabled = false,
  executive_push_last_sent_date = NULL,
  executive_push_last_sent_at = NULL
WHERE id = 'global'
  AND executive_push_updated_by IS NULL;
