BEGIN;
CREATE TABLE public.mt_automation_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  settings jsonb NOT NULL DEFAULT '{"aiMode":"off","model":"","dailyCalls":100,"dailyTokens":100000,"reservationMinutes":30,"maxReservations":2,"integrationsEnabled":false,"purchasesEnabled":false}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 4096)
);
INSERT INTO public.mt_automation_settings(id) VALUES (true);
ALTER TABLE public.mt_automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY mt_settings_admin_read ON public.mt_automation_settings FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');
REVOKE ALL ON public.mt_automation_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.mt_automation_settings TO authenticated, service_role;

CREATE FUNCTION public.mt_update_automation_settings(p_settings jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' OR NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = (SELECT auth.uid()) AND active)
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object'
    OR octet_length(p_settings::text) > 4096
    OR (p_settings - ARRAY['aiMode','model','dailyCalls','dailyTokens','reservationMinutes','maxReservations','integrationsEnabled','purchasesEnabled']) <> '{}'::jsonb
    OR EXISTS (SELECT 1 FROM unnest(ARRAY['dailyCalls','dailyTokens','reservationMinutes','maxReservations']) AS field
      WHERE jsonb_typeof(p_settings->field) IS DISTINCT FROM 'number')
    OR jsonb_typeof(p_settings->'aiMode') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_settings->'model') IS DISTINCT FROM 'string'
    OR p_settings->>'aiMode' NOT IN ('off','suggestions','queries')
    OR NOT (p_settings ?& ARRAY['aiMode','model','dailyCalls','dailyTokens','reservationMinutes','maxReservations','integrationsEnabled'])
    OR (p_settings->>'dailyCalls')::integer NOT BETWEEN 1 AND 10000
    OR (p_settings->>'dailyTokens')::integer NOT BETWEEN 1024 AND 10000000
    OR (p_settings->>'reservationMinutes')::integer NOT BETWEEN 1 AND 1440
    OR (p_settings->>'maxReservations')::integer NOT BETWEEN 1 AND 10
    OR p_settings->>'model' !~ '^[a-zA-Z0-9._-]{0,100}$'
    OR (p_settings->>'aiMode' <> 'off' AND p_settings->>'model' = '')
    OR jsonb_typeof(p_settings->'integrationsEnabled') IS DISTINCT FROM 'boolean'
    OR (p_settings ? 'purchasesEnabled' AND jsonb_typeof(p_settings->'purchasesEnabled') IS DISTINCT FROM 'boolean')
    THEN RAISE EXCEPTION 'invalid settings' USING ERRCODE = '22023'; END IF;
  UPDATE public.mt_automation_settings SET settings = jsonb_build_object('purchasesEnabled',false) || p_settings, updated_at = now() WHERE id;
  UPDATE public.catalogo_ajustes SET reserva_ttl_minutos = (p_settings->>'reservationMinutes')::integer WHERE id = 'global';
  RETURN 'global';
END;
$$;
REVOKE ALL ON FUNCTION public.mt_update_automation_settings(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mt_update_automation_settings(jsonb) TO authenticated;

ALTER TABLE public.intereses ADD COLUMN consent_at timestamptz,
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN invite_until timestamptz,
  ADD COLUMN notice_attempts integer NOT NULL DEFAULT 0 CHECK (notice_attempts >= 0);
CREATE INDEX mt_intereses_consent_idx ON public.intereses(categoria_id, created_at, id)
  WHERE consent_at IS NOT NULL AND paused_at IS NULL AND estado = 'esperando';
CREATE FUNCTION public.mt_manage_interest(p_id uuid, p_action text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' OR NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = (SELECT auth.uid()) AND active)
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('pause','resume','cancel') OR p_action IS NULL
    THEN RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023'; END IF;
  UPDATE public.intereses SET paused_at = CASE WHEN p_action = 'pause' THEN now() END,
    estado = CASE WHEN p_action = 'cancel' THEN 'descartado' ELSE estado END
    WHERE id = p_id AND estado IN ('esperando','avisado');
  IF NOT FOUND THEN RAISE EXCEPTION 'interest unavailable' USING ERRCODE = '22023'; END IF;
  RETURN p_id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_manage_interest(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mt_manage_interest(uuid,text) TO authenticated;

CREATE TABLE public.mt_ai_budget (
  day date PRIMARY KEY,
  calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  reserved_tokens integer NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0)
);
ALTER TABLE public.mt_ai_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_ai_budget FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.mt_claim_ai_budget(p_tokens integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_settings jsonb; v_day date := (now() AT TIME ZONE 'America/Panama')::date;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' IS DISTINCT FROM 'service_role'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_tokens NOT BETWEEN 1 AND 10000 OR p_tokens IS NULL
    THEN RAISE EXCEPTION 'invalid tokens' USING ERRCODE = '22023'; END IF;
  SELECT settings INTO v_settings FROM public.mt_automation_settings WHERE id;
  IF v_settings->>'aiMode' = 'off' THEN RETURN false; END IF;
  INSERT INTO public.mt_ai_budget(day) VALUES (v_day) ON CONFLICT DO NOTHING;
  UPDATE public.mt_ai_budget SET calls = calls + 1, reserved_tokens = reserved_tokens + p_tokens
    WHERE day = v_day AND calls < (v_settings->>'dailyCalls')::integer
      AND reserved_tokens + p_tokens <= (v_settings->>'dailyTokens')::integer;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_claim_ai_budget(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mt_claim_ai_budget(integer) TO service_role;
CREATE FUNCTION public.mt_register_interest(p_contact text, p_category_id text, p_plan_id text, p_consent boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_contact IS NULL OR p_contact !~ '^[0-9]{8,32}$' OR p_consent IS NULL
    THEN RAISE EXCEPTION 'invalid contact' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categorias WHERE id = p_category_id AND activo)
    OR (p_plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.planes
      WHERE id = p_plan_id AND categoria_id = p_category_id AND activo))
    THEN RAISE EXCEPTION 'invalid catalogue' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('interest:' || p_contact || ':' || p_category_id, 0));
  SELECT id INTO v_id FROM public.intereses WHERE contact_id = p_contact AND categoria_id = p_category_id
    AND plan_id IS NOT DISTINCT FROM p_plan_id AND estado IN ('esperando','avisado') FOR UPDATE;
  IF v_id IS NOT NULL THEN
    UPDATE public.intereses SET consent_at = CASE WHEN p_consent THEN coalesce(consent_at, now()) ELSE consent_at END WHERE id = v_id;
  ELSE
    INSERT INTO public.intereses(contact_id,categoria_id,plan_id,origen,consent_at)
      VALUES (p_contact,p_category_id,p_plan_id,'catalogo_agotado',CASE WHEN p_consent THEN now() END) RETURNING id INTO v_id;
    INSERT INTO public.domain_events(type, aggregate_type, aggregate_id, payload)
      VALUES ('demand.registered','interest',v_id::text,jsonb_build_object('version',1,'categoryId',p_category_id));
  END IF;
  RETURN v_id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_register_interest(text,text,text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mt_register_interest(text,text,text,boolean) TO service_role;

CREATE FUNCTION public.mt_claim_interest_notice(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_interest public.intereses%ROWTYPE; v_name text;
BEGIN
  IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_interest FROM public.intereses WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_interest.estado NOT IN ('esperando','avisado') OR v_interest.consent_at IS NULL OR v_interest.paused_at IS NOT NULL
    THEN RAISE EXCEPTION 'recipient unavailable' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.servicios s WHERE s.categoria_id = v_interest.categoria_id
    AND s.activo AND NOT s.en_reposo AND s.cortado_at IS NULL AND s.archivado_at IS NULL
    AND s.perfiles_disponibles > s.perfiles_ocupados + (SELECT count(*) FROM public.reservas_perfil r
      WHERE r.servicio_id = s.id AND r.cerrada_at IS NULL AND r.expira_at > now())
    AND (v_interest.plan_id IS NULL OR s.plan_tipo_id = (SELECT plan_tipo_id FROM public.planes WHERE id = v_interest.plan_id)))
    THEN RAISE EXCEPTION 'stock unavailable' USING ERRCODE = '22023'; END IF;
  SELECT nombre INTO v_name FROM public.categorias WHERE id = v_interest.categoria_id;
  UPDATE public.intereses SET notice_attempts = notice_attempts + 1 WHERE id = p_id;
  RETURN jsonb_build_object('id',p_id,'contact',v_interest.contact_id,'name',v_name);
END;
$$;
CREATE FUNCTION public.mt_finish_interest_notice(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.intereses SET estado = 'avisado', avisado_at = coalesce(avisado_at,now()),
    invite_until = coalesce(invite_until,now() + interval '30 minutes') WHERE id = p_id AND estado = 'esperando';
  RETURN p_id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_claim_interest_notice(uuid), public.mt_finish_interest_notice(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mt_claim_interest_notice(uuid), public.mt_finish_interest_notice(uuid) TO service_role;
COMMIT;
