-- ============================================================================
-- Placeholder migration.
--
-- Originally contained a per-record UPDATE that restored the pre-discount
-- forecast price for a specific Prime Video sale. The fix has been moved to
-- scripts/data-fixes/2026-05-05_prime_video_forecast_snapshot.sql so that it
-- never runs on environments that do not contain the legacy Firebase IDs.
--
-- This file is kept (rather than deleted) so that the migration log on the
-- production database remains consistent.
-- ============================================================================

SELECT 1;
