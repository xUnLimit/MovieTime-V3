-- ============================================================================
-- Reduce executive push scheduler frequency.
-- The service still enforces the configured window and interval; this only
-- reduces Vercel/Supabase tick traffic from every minute to every 5 minutes.
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('executive-push-tick');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'executive-push-tick',
  '*/5 * * * *',
  $cron$SELECT public.trigger_executive_push();$cron$
);
