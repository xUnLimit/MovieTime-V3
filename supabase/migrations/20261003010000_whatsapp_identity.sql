-- Identidad canonica del cliente por numero de WhatsApp (Fase 0).
-- Aditiva y compatible con la version anterior de la app: agrega una columna generada a terceros (que la app
-- anterior ignora), una tabla nueva de contactos y un RPC que solo usa el webhook (service_role).

-- Misma regla que normalizePanamaWaId (src/modules/messaging/message-data.ts): se quitan los no digitos;
-- 8 digitos locales -> '507' || digitos; '507' + 8 digitos -> igual; cualquier otro caso -> NULL.
CREATE FUNCTION public.normalize_panama_wa_id(p_telefono text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE
    WHEN d ~ '^[0-9]{8}$' THEN '507' || d
    WHEN d ~ '^507[0-9]{8}$' THEN d
    ELSE NULL
  END
  FROM (SELECT pg_catalog.regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g') AS d) AS normalized
$$;

-- La columna generada evalua la funcion con el rol que escribe en terceros: authenticated y service_role la necesitan.
REVOKE ALL ON FUNCTION public.normalize_panama_wa_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_panama_wa_id(text) TO authenticated, service_role;

-- Columna generada (no trigger): no puede divergir de telefono, no admite escrituras directas y las vistas
-- existentes no la referencian (las vistas expanden sus columnas al crearse). Reescribe terceros una vez; la
-- tabla es pequena. No es unica: hoy puede haber duplicados (ver la consulta de limpieza en el reporte).
ALTER TABLE public.terceros
  ADD COLUMN wa_id text GENERATED ALWAYS AS (public.normalize_panama_wa_id(telefono)) STORED;

CREATE INDEX idx_terceros_wa_id ON public.terceros (wa_id);

CREATE TABLE public.whatsapp_contacts (
  wa_id text PRIMARY KEY CHECK (length(wa_id) BETWEEN 1 AND 32),
  tercero_id text REFERENCES public.terceros (id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'lead' CHECK (estado IN ('lead', 'cliente', 'bloqueado')),
  nombre_perfil text CHECK (length(nombre_perfil) <= 256),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_contacts_tercero_id_idx ON public.whatsapp_contacts (tercero_id);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Igual que el resto de tablas whatsapp_*: solo administradores activos leen; escribe unicamente el RPC.
CREATE POLICY whatsapp_contacts_admin_read ON public.whatsapp_contacts
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin');

REVOKE ALL ON TABLE public.whatsapp_contacts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.whatsapp_contacts TO authenticated, service_role;

-- Registra o refresca un contacto entrante. Vincula el tercero solo si exactamente un tercero activo tiene ese
-- wa_id; con cero o varios queda como lead sin tercero. Un contacto bloqueado conserva su estado.
CREATE FUNCTION public.upsert_whatsapp_contact(p_wa_id text, p_nombre_perfil text)
RETURNS TABLE (wa_id text, tercero_id text, estado text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_nombre text := nullif(left(btrim(coalesce(p_nombre_perfil, '')), 256), '');
  v_matches integer;
  v_tercero text;
BEGIN
  IF p_wa_id IS NULL OR length(p_wa_id) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'invalid wa_id';
  END IF;

  SELECT count(*), min(t.id) INTO v_matches, v_tercero
  FROM public.terceros AS t
  WHERE t.wa_id = p_wa_id AND t.active;
  IF v_matches <> 1 THEN
    v_tercero := NULL;
  END IF;

  RETURN QUERY
  INSERT INTO public.whatsapp_contacts AS c (wa_id, tercero_id, estado, nombre_perfil)
  VALUES (p_wa_id, v_tercero, CASE WHEN v_tercero IS NULL THEN 'lead' ELSE 'cliente' END, v_nombre)
  ON CONFLICT ON CONSTRAINT whatsapp_contacts_pkey DO UPDATE SET
    tercero_id = EXCLUDED.tercero_id,
    estado = CASE WHEN c.estado = 'bloqueado' THEN 'bloqueado' ELSE EXCLUDED.estado END,
    nombre_perfil = coalesce(EXCLUDED.nombre_perfil, c.nombre_perfil),
    last_seen_at = now(),
    updated_at = now()
  RETURNING c.wa_id, c.tercero_id, c.estado;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_whatsapp_contact(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_whatsapp_contact(text, text) TO service_role;

-- Backfill: un contacto por remitente historico, con la misma resolucion que el RPC.
INSERT INTO public.whatsapp_contacts (wa_id, tercero_id, estado, nombre_perfil, first_seen_at, last_seen_at)
SELECT
  s.wa_id,
  m.tercero_id,
  CASE WHEN m.tercero_id IS NULL THEN 'lead' ELSE 'cliente' END,
  s.nombre_perfil,
  s.first_seen_at,
  s.last_seen_at
FROM (
  SELECT
    i.from_wa_id AS wa_id,
    min(i.sent_at) AS first_seen_at,
    max(i.sent_at) AS last_seen_at,
    left((array_agg(nullif(btrim(i.contact_name), '') ORDER BY i.sent_at DESC)
      FILTER (WHERE nullif(btrim(i.contact_name), '') IS NOT NULL))[1], 256) AS nombre_perfil
  FROM public.whatsapp_inbound_messages AS i
  WHERE length(i.from_wa_id) BETWEEN 1 AND 32
  GROUP BY i.from_wa_id
) AS s
LEFT JOIN LATERAL (
  SELECT CASE WHEN count(*) = 1 THEN min(t.id) END AS tercero_id
  FROM public.terceros AS t
  WHERE t.wa_id = s.wa_id AND t.active
) AS m ON true
ON CONFLICT (wa_id) DO NOTHING;

-- La auditoria de seguridad incluye la tabla nueva en la comprobacion de RLS. upsert_whatsapp_contact no se
-- aprueba para authenticated: solo service_role la ejecuta, asi que no cuenta como definer expuesto.
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
      ('netflix_code_claims'), ('whatsapp_bot_config'), ('whatsapp_bot_versions'), ('whatsapp_bot_events'),
      ('whatsapp_contacts')
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
      ('set_whatsapp_bot_enabled')
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
      ('hide_whatsapp_message')
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
