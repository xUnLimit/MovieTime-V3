-- Add structured metadata to activity logs while keeping detalles/cambios backward-compatible.

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_activity_log_metadata_gin
  ON activity_log USING GIN (metadata);
