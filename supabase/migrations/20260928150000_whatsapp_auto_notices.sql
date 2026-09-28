-- hora_envio is an integer hour (0..23), already defaulting to 9. Preserve configured values.
ALTER TABLE public.config
  ADD COLUMN whatsapp_auto_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN whatsapp_auto_daily_cap integer NOT NULL DEFAULT 200
    CHECK (whatsapp_auto_daily_cap BETWEEN 1 AND 1000);

CREATE TABLE public.auto_notice_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  sent integer NOT NULL DEFAULT 0 CHECK (sent >= 0),
  failed integer NOT NULL DEFAULT 0 CHECK (failed >= 0),
  skipped integer NOT NULL DEFAULT 0 CHECK (skipped >= 0),
  already_sent integer NOT NULL DEFAULT 0 CHECK (already_sent >= 0),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.auto_notice_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_notice_runs_admin_read ON public.auto_notice_runs FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active));
REVOKE ALL ON public.auto_notice_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.auto_notice_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.auto_notice_runs TO service_role;

CREATE INDEX whatsapp_notices_auto_cap_idx ON public.whatsapp_notices (created_at DESC, wa_id)
  WHERE status = 'accepted' AND origin IN ('auto', 'manual');

-- Provision both Vault secrets manually after migration, never in source control:
-- SELECT vault.create_secret('<WHATSAPP_AUTO_NOTICES_SECRET>', 'whatsapp_auto_notices_secret');
-- SELECT vault.create_secret('<HTTPS_AUTO_NOTICES_ENDPOINT>', 'whatsapp_auto_notices_url');
CREATE FUNCTION public.trigger_auto_notices() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_secret text; v_url text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_auto_notices_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'whatsapp_auto_notices_url' LIMIT 1;
  -- Sin secretos en vault el automatico no esta configurado: salir sin error para no ensuciar cron.
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 240000) INTO v_request_id;
  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_auto_notices() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('whatsapp-auto-notices-tick', '5 * * * *', $cron$SELECT public.trigger_auto_notices();$cron$);
