-- ============================================================================
-- Executive push schedule guard
-- - Guarda el ultimo dia local enviado para evitar duplicados
-- - Permite que un scheduler frecuente respete la hora configurable de la UI
-- ============================================================================

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS executive_push_last_sent_date TEXT,
  ADD COLUMN IF NOT EXISTS executive_push_last_sent_at TIMESTAMPTZ;
