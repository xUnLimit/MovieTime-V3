-- ============================================================================
-- 20260509203000_executive_push_reminder_window.sql
-- Replaces the one-shot daily executive push guard with a configurable reminder
-- window and interval. The legacy executive_push_send_time column remains for
-- compatibility, but new scheduler logic reads the window/interval fields.
-- ============================================================================

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS executive_push_window_start TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS executive_push_window_end TEXT NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS executive_push_interval_hours INTEGER NOT NULL DEFAULT 24;

UPDATE public.config
SET
  executive_push_window_start = COALESCE(NULLIF(executive_push_send_time, ''), executive_push_window_start, '08:00'),
  executive_push_window_end = COALESCE(NULLIF(executive_push_window_end, ''), '22:00'),
  executive_push_interval_hours = COALESCE(executive_push_interval_hours, 24),
  executive_push_last_sent_date = NULL
WHERE id = 'global';
