-- ============================================================================
-- Atomic executive push scheduler claim.
--
-- The cron tick remains frequent for delivery precision, but Postgres now
-- claims due work before calling Vercel. This avoids blind HTTP polling and
-- records each scheduler-owned run for auditability.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.executive_push_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'claimed',
  reason TEXT,
  request_id BIGINT,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT executive_push_runs_status_valid CHECK (
    status IN ('claimed', 'running', 'sent', 'skipped', 'failed')
  ),
  CONSTRAINT executive_push_runs_counts_non_negative CHECK (
    sent >= 0 AND failed >= 0 AND disabled >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_executive_push_runs_claimed_at
  ON public.executive_push_runs(claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_executive_push_runs_active
  ON public.executive_push_runs(status, claimed_at DESC)
  WHERE status IN ('claimed', 'running');

ALTER TABLE public.executive_push_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS executive_push_runs_admin_read ON public.executive_push_runs;
CREATE POLICY executive_push_runs_admin_read ON public.executive_push_runs
  FOR SELECT
  USING ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON public.executive_push_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.executive_push_runs TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_executive_push_due()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_config public.config%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_local_now TIMESTAMP;
  v_today TEXT;
  v_current_minutes INTEGER;
  v_window_start_minutes INTEGER;
  v_window_end_minutes INTEGER;
  v_interval_hours INTEGER;
  v_last_sent_at TIMESTAMPTZ;
  v_run_id UUID;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('executive_push_due_claim')) THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_config
  FROM public.config
  WHERE id = 'global'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.executive_push_runs(status, reason, finished_at)
    VALUES ('skipped', 'missing_config', v_now)
    RETURNING id INTO v_run_id;
    RETURN NULL;
  END IF;

  IF NOT COALESCE(v_config.executive_push_enabled, false) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.executive_push_runs
    WHERE status IN ('claimed', 'running')
      AND claimed_at > v_now - INTERVAL '20 minutes'
  ) THEN
    RETURN NULL;
  END IF;

  v_local_now := v_now AT TIME ZONE COALESCE(NULLIF(v_config.executive_push_timezone, ''), 'America/Bogota');
  v_today := to_char(v_local_now::date, 'YYYY-MM-DD');
  v_current_minutes := EXTRACT(HOUR FROM v_local_now)::INTEGER * 60
    + EXTRACT(MINUTE FROM v_local_now)::INTEGER;

  IF COALESCE(v_config.executive_push_window_start, '') !~ '^\d{2}:\d{2}$'
    OR COALESCE(v_config.executive_push_window_end, '') !~ '^\d{2}:\d{2}$'
  THEN
    INSERT INTO public.executive_push_runs(status, reason, finished_at)
    VALUES ('skipped', 'invalid_time', v_now)
    RETURNING id INTO v_run_id;
    RETURN NULL;
  END IF;

  v_window_start_minutes := split_part(v_config.executive_push_window_start, ':', 1)::INTEGER * 60
    + split_part(v_config.executive_push_window_start, ':', 2)::INTEGER;
  v_window_end_minutes := split_part(v_config.executive_push_window_end, ':', 1)::INTEGER * 60
    + split_part(v_config.executive_push_window_end, ':', 2)::INTEGER;

  IF v_window_start_minutes < 0 OR v_window_start_minutes > 1439
    OR v_window_end_minutes < 0 OR v_window_end_minutes > 1439
    OR v_window_start_minutes = v_window_end_minutes
  THEN
    INSERT INTO public.executive_push_runs(status, reason, finished_at)
    VALUES ('skipped', 'invalid_time', v_now)
    RETURNING id INTO v_run_id;
    RETURN NULL;
  END IF;

  IF NOT (
    CASE
      WHEN v_window_start_minutes < v_window_end_minutes THEN
        v_current_minutes >= v_window_start_minutes AND v_current_minutes < v_window_end_minutes
      ELSE
        v_current_minutes >= v_window_start_minutes OR v_current_minutes < v_window_end_minutes
    END
  ) THEN
    RETURN NULL;
  END IF;

  v_interval_hours := COALESCE(v_config.executive_push_interval_hours, 24);
  IF v_interval_hours < 1 OR v_interval_hours > 24 THEN
    INSERT INTO public.executive_push_runs(status, reason, finished_at)
    VALUES ('skipped', 'invalid_interval', v_now)
    RETURNING id INTO v_run_id;
    RETURN NULL;
  END IF;

  v_last_sent_at := v_config.executive_push_last_sent_at;
  IF v_last_sent_at IS NOT NULL
    AND v_now < v_last_sent_at + make_interval(hours => v_interval_hours)
  THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.executive_push_runs(status, metadata)
  VALUES (
    'claimed',
    jsonb_build_object(
      'today', v_today,
      'timezone', COALESCE(NULLIF(v_config.executive_push_timezone, ''), 'America/Bogota'),
      'current_minutes', v_current_minutes,
      'window_start_minutes', v_window_start_minutes,
      'window_end_minutes', v_window_end_minutes,
      'interval_hours', v_interval_hours
    )
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_executive_push_due() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_executive_push_due() FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.trigger_executive_push();
CREATE OR REPLACE FUNCTION public.trigger_executive_push()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret     TEXT;
  v_url        TEXT;
  v_request_id BIGINT;
  v_run_id     UUID;
BEGIN
  v_run_id := public.claim_executive_push_due();
  IF v_run_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'executive_push_cron_secret'
  LIMIT 1;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'executive_push_daily_url'
  LIMIT 1;

  IF v_secret IS NULL OR v_url IS NULL THEN
    UPDATE public.executive_push_runs
    SET
      status = 'failed',
      reason = 'missing_secrets',
      error = 'executive_push secrets not configured in vault',
      finished_at = now()
    WHERE id = v_run_id;

    RAISE EXCEPTION 'executive_push secrets not configured in vault. Run vault.create_secret for executive_push_cron_secret and executive_push_daily_url.';
  END IF;

  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    ),
    body                  := jsonb_build_object('run_id', v_run_id),
    timeout_milliseconds  := 240000
  ) INTO v_request_id;

  UPDATE public.executive_push_runs
  SET request_id = v_request_id
  WHERE id = v_run_id;

  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_executive_push() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_executive_push() FROM anon, authenticated;
