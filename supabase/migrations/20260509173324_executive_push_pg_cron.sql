-- ============================================================================
-- 20260509173324_executive_push_pg_cron.sql
-- Replaces GitHub Actions scheduler with pg_cron + pg_net for the daily
-- executive push. GitHub Actions ignores sub-hourly cron expressions on
-- low-activity repos (~1 run per 60-90 min instead of every 5 min), so the
-- push could land hours after executive_push_send_time. pg_cron runs inside
-- Postgres with ±60 second precision and pg_net dispatches the HTTP request
-- asynchronously.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ----------------------------------------------------------------------------
-- One-time manual setup (run AFTER this migration is applied, in Supabase
-- SQL Editor — these are secrets and must NOT be versioned):
--
--   SELECT vault.create_secret(
--     '<MISMO_VALOR_QUE_PUSH_CRON_SECRET_EN_VERCEL>',
--     'executive_push_cron_secret'
--   );
--   SELECT vault.create_secret(
--     'https://system.movietimepty.top/api/push/daily',
--     'executive_push_daily_url'
--   );
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_executive_push()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_secret     text;
  v_url        text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'executive_push_cron_secret'
  LIMIT 1;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'executive_push_daily_url'
  LIMIT 1;

  IF v_secret IS NULL OR v_url IS NULL THEN
    RAISE EXCEPTION 'executive_push secrets not configured in vault. Run vault.create_secret for executive_push_cron_secret and executive_push_daily_url.';
  END IF;

  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    ),
    body                  := '{}'::jsonb,
    timeout_milliseconds  := 240000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_executive_push() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_executive_push() FROM anon, authenticated;

-- Idempotent (re)scheduling: drop any prior version of the job before scheduling.
DO $$
BEGIN
  PERFORM cron.unschedule('executive-push-tick');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'executive-push-tick',
  '* * * * *',
  $cron$SELECT public.trigger_executive_push();$cron$
);
