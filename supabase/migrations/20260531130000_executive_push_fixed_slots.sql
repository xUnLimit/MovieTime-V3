-- ============================================================================
-- Executive push fixed slots.
--
-- "Cada N horas" now means fixed slots from the configured window start
-- (06:00, 10:00, 14:00, 18:00...) instead of drifting from the actual
-- last successful delivery timestamp.
-- ============================================================================

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS executive_push_last_sent_slot TEXT;

DO $$
DECLARE
  v_config public.config%ROWTYPE;
  v_timezone TEXT;
  v_local_sent TIMESTAMP;
  v_sent_date TEXT;
  v_sent_minutes INTEGER;
  v_window_start_minutes INTEGER;
  v_window_end_minutes INTEGER;
  v_interval_hours INTEGER;
  v_step_minutes INTEGER;
  v_scheduled_minutes INTEGER;
  v_scheduled_extended_minutes INTEGER;
  v_slot_date TEXT;
BEGIN
  SELECT *
  INTO v_config
  FROM public.config
  WHERE id = 'global';

  IF NOT FOUND
    OR v_config.executive_push_last_sent_at IS NULL
    OR v_config.executive_push_last_sent_slot IS NOT NULL
    OR COALESCE(v_config.executive_push_window_start, '') !~ '^\d{2}:\d{2}$'
    OR COALESCE(v_config.executive_push_window_end, '') !~ '^\d{2}:\d{2}$'
  THEN
    RETURN;
  END IF;

  v_timezone := COALESCE(NULLIF(v_config.executive_push_timezone, ''), 'America/Bogota');
  v_interval_hours := COALESCE(v_config.executive_push_interval_hours, 24);
  IF v_interval_hours < 1 OR v_interval_hours > 24 THEN
    RETURN;
  END IF;

  v_window_start_minutes := split_part(v_config.executive_push_window_start, ':', 1)::INTEGER * 60
    + split_part(v_config.executive_push_window_start, ':', 2)::INTEGER;
  v_window_end_minutes := split_part(v_config.executive_push_window_end, ':', 1)::INTEGER * 60
    + split_part(v_config.executive_push_window_end, ':', 2)::INTEGER;

  IF v_window_start_minutes < 0 OR v_window_start_minutes > 1439
    OR v_window_end_minutes < 0 OR v_window_end_minutes > 1439
    OR v_window_start_minutes = v_window_end_minutes
  THEN
    RETURN;
  END IF;

  v_local_sent := v_config.executive_push_last_sent_at AT TIME ZONE v_timezone;
  v_sent_date := to_char(v_local_sent::date, 'YYYY-MM-DD');
  v_sent_minutes := EXTRACT(HOUR FROM v_local_sent)::INTEGER * 60
    + EXTRACT(MINUTE FROM v_local_sent)::INTEGER;
  v_step_minutes := v_interval_hours * 60;

  IF v_window_start_minutes < v_window_end_minutes THEN
    IF v_sent_minutes < v_window_start_minutes OR v_sent_minutes >= v_window_end_minutes THEN
      RETURN;
    END IF;

    v_scheduled_minutes := v_window_start_minutes
      + floor((v_sent_minutes - v_window_start_minutes)::numeric / v_step_minutes)::INTEGER * v_step_minutes;
    v_slot_date := v_sent_date;
  ELSE
    v_scheduled_extended_minutes := v_window_start_minutes
      + floor((
          CASE
            WHEN v_sent_minutes >= v_window_start_minutes THEN v_sent_minutes
            ELSE v_sent_minutes + 1440
          END - v_window_start_minutes
        )::numeric / v_step_minutes)::INTEGER * v_step_minutes;

    v_scheduled_minutes := v_scheduled_extended_minutes % 1440;
    v_slot_date := CASE
      WHEN v_scheduled_extended_minutes >= 1440 THEN v_sent_date
      WHEN v_sent_minutes < v_window_end_minutes THEN to_char((v_local_sent::date - INTERVAL '1 day')::date, 'YYYY-MM-DD')
      ELSE v_sent_date
    END;
  END IF;

  UPDATE public.config
  SET executive_push_last_sent_slot =
    v_slot_date || 'T' ||
    lpad((v_scheduled_minutes / 60)::TEXT, 2, '0') || ':' ||
    lpad((v_scheduled_minutes % 60)::TEXT, 2, '0')
  WHERE id = 'global';
END;
$$;

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
  v_current_extended_minutes INTEGER;
  v_window_start_minutes INTEGER;
  v_window_end_minutes INTEGER;
  v_interval_hours INTEGER;
  v_step_minutes INTEGER;
  v_scheduled_minutes INTEGER;
  v_scheduled_extended_minutes INTEGER;
  v_slot_date TEXT;
  v_slot_key TEXT;
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

  v_step_minutes := v_interval_hours * 60;

  IF v_window_start_minutes < v_window_end_minutes THEN
    v_scheduled_minutes := v_window_start_minutes
      + floor((v_current_minutes - v_window_start_minutes)::numeric / v_step_minutes)::INTEGER * v_step_minutes;
    v_slot_date := v_today;
  ELSE
    v_current_extended_minutes := CASE
      WHEN v_current_minutes >= v_window_start_minutes THEN v_current_minutes
      ELSE v_current_minutes + 1440
    END;
    v_scheduled_extended_minutes := v_window_start_minutes
      + floor((v_current_extended_minutes - v_window_start_minutes)::numeric / v_step_minutes)::INTEGER * v_step_minutes;
    v_scheduled_minutes := v_scheduled_extended_minutes % 1440;
    v_slot_date := CASE
      WHEN v_scheduled_extended_minutes >= 1440 THEN v_today
      WHEN v_current_minutes < v_window_end_minutes THEN to_char((v_local_now::date - INTERVAL '1 day')::date, 'YYYY-MM-DD')
      ELSE v_today
    END;
  END IF;

  v_slot_key := v_slot_date || 'T' ||
    lpad((v_scheduled_minutes / 60)::TEXT, 2, '0') || ':' ||
    lpad((v_scheduled_minutes % 60)::TEXT, 2, '0');

  IF v_config.executive_push_last_sent_slot = v_slot_key THEN
    RETURN NULL;
  END IF;

  v_last_sent_at := v_config.executive_push_last_sent_at;
  IF v_config.executive_push_last_sent_slot IS NULL
    AND v_last_sent_at IS NOT NULL
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
      'interval_hours', v_interval_hours,
      'scheduled_minutes', v_scheduled_minutes,
      'slot_key', v_slot_key
    )
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_executive_push_due() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_executive_push_due() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
