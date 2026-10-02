-- Additive v2 storage. v1 tables, definitions and runtime remain compatible.
-- Security policy is fixed in code/SQL, never configured by a bot definition.
CREATE FUNCTION private.valid_conversation_variables(p_value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN p_value IS NULL OR jsonb_typeof(p_value) <> 'object' THEN false ELSE
    octet_length(p_value::text) <= 4096
    AND (SELECT count(*) FROM jsonb_each(p_value)) <= 32
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(p_value) AS item
      WHERE item.key !~ '^[a-z][a-z0-9_]{0,31}$'
        OR item.key ~* '(password|passwd|secret|token|credential|codigo|code|clave|contrasena|authorization|cookie)'
        OR jsonb_typeof(item.value) NOT IN ('string', 'number', 'boolean', 'null')
        OR (jsonb_typeof(item.value) = 'string' AND
          (length(item.value #>> '{}') > 512 OR (item.value #>> '{}') ~* '(https?://|bearer\s|-----BEGIN|password\s*[:=]|token\s*[:=])'))
    ) END;
$$;

CREATE FUNCTION private.valid_conversation_awaiting(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_value IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(p_value) <> 'object' OR octet_length(p_value::text) > 256 THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_value)) <> 3
    OR NOT (p_value ?& ARRAY['tipo', 'ref', 'expiresAt'])
    OR jsonb_typeof(p_value->'tipo') <> 'string'
    OR jsonb_typeof(p_value->'ref') <> 'string'
    OR jsonb_typeof(p_value->'expiresAt') <> 'string'
    OR p_value->>'tipo' NOT IN ('text', 'number', 'image')
    OR p_value->>'ref' !~ '^[a-z][a-z0-9_]{1,31}$'
    OR p_value->>'expiresAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
  THEN RETURN false; END IF;
  RETURN isfinite((p_value->>'expiresAt')::timestamptz);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION private.valid_conversation_variables(jsonb), private.valid_conversation_awaiting(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.valid_conversation_variables(jsonb), private.valid_conversation_awaiting(jsonb) TO service_role;

CREATE TABLE public.whatsapp_conversation_state (
  wa_id text PRIMARY KEY CHECK (wa_id ~ '^[0-9]{7,15}$'),
  flow_version integer NOT NULL REFERENCES public.whatsapp_bot_versions(version),
  node_id text NOT NULL CHECK (node_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  variables jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (private.valid_conversation_variables(variables)),
  awaiting jsonb CHECK (private.valid_conversation_awaiting(awaiting)),
  owner text NOT NULL DEFAULT 'bot' CHECK (owner IN ('bot', 'humano')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at)),
  CHECK (awaiting IS NULL OR (awaiting->>'ref' = node_id AND (awaiting->>'expiresAt')::timestamptz <= expires_at)),
  CHECK (owner = 'bot' OR awaiting IS NULL)
);
CREATE INDEX whatsapp_conversation_state_expires_idx ON public.whatsapp_conversation_state(expires_at);
CREATE INDEX whatsapp_conversation_state_flow_idx ON public.whatsapp_conversation_state(flow_version);
ALTER TABLE public.whatsapp_conversation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_conversation_state_admin_read ON public.whatsapp_conversation_state
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin');
REVOKE ALL ON TABLE public.whatsapp_conversation_state FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.whatsapp_conversation_state TO authenticated, service_role;
-- All mutations go through atomic RPCs; service_role cannot bypass the CAS by direct DML.

CREATE FUNCTION public.set_conversation_state(
  p_wa_id text, p_expected_revision integer, p_state jsonb, p_expires_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$'
    OR p_expires_at IS NULL OR NOT isfinite(p_expires_at) OR p_expires_at <= clock_timestamp()
    OR p_expires_at > clock_timestamp() + interval '30 days'
    OR (p_expected_revision IS NOT NULL AND p_expected_revision < 1)
    OR p_state IS NULL OR jsonb_typeof(p_state) <> 'object'
  THEN RAISE EXCEPTION 'invalid conversation state' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_state)) <> 5
    OR NOT (p_state ?& ARRAY['flowVersion','nodeId','variables','awaiting','owner'])
    OR jsonb_typeof(p_state->'flowVersion') <> 'number'
    OR p_state->>'flowVersion' !~ '^[1-9][0-9]{0,9}$'
    OR jsonb_typeof(p_state->'nodeId') <> 'string'
    OR p_state->>'nodeId' !~ '^[a-z][a-z0-9_]{1,31}$'
    OR jsonb_typeof(p_state->'owner') <> 'string' OR p_state->>'owner' NOT IN ('bot', 'humano')
    OR NOT private.valid_conversation_variables(p_state->'variables')
    OR NOT private.valid_conversation_awaiting(NULLIF(p_state->'awaiting', 'null'::jsonb))
  THEN RAISE EXCEPTION 'invalid conversation state' USING ERRCODE = '22023'; END IF;
  IF (p_state->>'flowVersion')::numeric > 2147483647 THEN
    RAISE EXCEPTION 'invalid conversation state' USING ERRCODE = '22023';
  END IF;

  IF p_expected_revision IS NULL THEN
    INSERT INTO public.whatsapp_conversation_state (wa_id, flow_version, node_id, variables, awaiting, owner, expires_at)
    VALUES (p_wa_id, (p_state->>'flowVersion')::integer, p_state->>'nodeId', p_state->'variables',
      NULLIF(p_state->'awaiting', 'null'::jsonb), p_state->>'owner', p_expires_at)
    ON CONFLICT (wa_id) DO NOTHING;
  ELSE
    UPDATE public.whatsapp_conversation_state
    SET flow_version = (p_state->>'flowVersion')::integer, node_id = p_state->>'nodeId',
      variables = p_state->'variables', awaiting = NULLIF(p_state->'awaiting', 'null'::jsonb), owner = p_state->>'owner',
      expires_at = p_expires_at, updated_at = clock_timestamp(), revision = revision + 1
    WHERE wa_id = p_wa_id AND revision = p_expected_revision AND owner = 'bot';
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

CREATE FUNCTION public.take_over_conversation(p_wa_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'invalid conversation id' USING ERRCODE = '22023';
  END IF;
  UPDATE public.whatsapp_conversation_state SET owner = 'humano', awaiting = NULL,
    revision = revision + 1, updated_at = clock_timestamp() WHERE wa_id = p_wa_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

CREATE FUNCTION public.hand_back_conversation(p_wa_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'invalid conversation id' USING ERRCODE = '22023';
  END IF;
  UPDATE public.whatsapp_conversation_state SET owner = 'bot', awaiting = NULL,
    revision = revision + 1, updated_at = clock_timestamp() WHERE wa_id = p_wa_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.set_conversation_state(text, integer, jsonb, timestamptz),
  public.take_over_conversation(text), public.hand_back_conversation(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_conversation_state(text, integer, jsonb, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.take_over_conversation(text), public.hand_back_conversation(text) TO authenticated;


-- Extend the canonical RLS/RPC audit without modifying prior migrations.
CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo'),
      ('yappy_mail_sync_state'), ('yappy_mail_messages'), ('yappy_payments'),
      ('netflix_code_claims'), ('whatsapp_bot_config'), ('whatsapp_bot_versions'), ('whatsapp_bot_events'), ('whatsapp_conversation_state')
  ),
  allowed_authenticated_security_definer(function_name) AS (
    VALUES
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('get_dashboard_stats_snapshot'),
      ('get_dashboard_churn_stats'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments'),
      ('create_venta_refund'),
      ('upsert_notification_aggregate'),
      ('resolve_yappy_payment'),
      ('dismiss_yappy_payment'),
      ('hide_whatsapp_message'),
      ('is_authenticated'),
      ('publish_whatsapp_bot_version'),
      ('set_whatsapp_bot_enabled'),
      ('take_over_conversation'), ('hand_back_conversation')
  ),
  required_authenticated_rpcs(function_name) AS (
    VALUES
      ('create_venta_with_initial_payment'),
      ('create_servicio_with_initial_payment'),
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('get_dashboard_stats_snapshot'),
      ('get_dashboard_churn_stats'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments'),
      ('create_venta_refund'),
      ('upsert_notification_aggregate'),
      ('hide_whatsapp_message'),
      ('take_over_conversation'), ('hand_back_conversation')
  ),
  public_functions AS (
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  )
  SELECT jsonb_build_object(
    'rls_disabled_app_tables', (
      SELECT count(*) FROM app_tables AS t
      JOIN pg_class AS c ON c.relname = t.table_name
      JOIN pg_namespace AS n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r' AND c.relrowsecurity = false
    ),
    'security_definer_missing_search_path', (
      SELECT count(*) FROM public_functions
      WHERE prosecdef = true
        AND NOT EXISTS (
          SELECT 1 FROM unnest(COALESCE(proconfig, ARRAY[]::TEXT[])) AS cfg
          WHERE cfg LIKE 'search_path=%'
        )
    ),
    'security_definer_executable_by_anon', (
      SELECT count(*) FROM public_functions
      WHERE prosecdef = true AND has_function_privilege('anon', oid, 'EXECUTE')
    ),
    'unapproved_security_definer_executable_by_authenticated', (
      SELECT count(*) FROM public_functions AS pf
      WHERE prosecdef = true
        AND has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1 FROM allowed_authenticated_security_definer AS allowed
          WHERE allowed.function_name = pf.proname
        )
    ),
    'required_rpc_missing_authenticated_execute', (
      SELECT count(*) FROM required_authenticated_rpcs AS required
      WHERE NOT EXISTS (
        SELECT 1 FROM public_functions AS pf
        WHERE pf.proname = required.function_name
          AND has_function_privilege('authenticated', pf.oid, 'EXECUTE')
      )
    ),
    'required_rpc_executable_by_anon', (
      SELECT count(*) FROM required_authenticated_rpcs AS required
      JOIN public_functions AS pf ON pf.proname = required.function_name
      WHERE has_function_privilege('anon', pf.oid, 'EXECUTE')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.run_security_audit_validations()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_audit_validations()
  TO service_role, postgres;

NOTIFY pgrst, 'reload schema';
