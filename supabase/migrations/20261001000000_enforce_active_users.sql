-- Un JWT vigente no da acceso a datos cuando el perfil fue desactivado.
-- SECURITY INVOKER a proposito: el usuario lee su PROPIA fila de `usuarios` (la politica SELECT lo permite), asi no
-- hace falta SECURITY DEFINER y la funcion no cuenta como "SECURITY DEFINER ejecutable por authenticated" en
-- run_security_audit_validations (que exige cero funciones no aprobadas). CASE evita tocar `usuarios` para anonimos.
-- CREATE OR REPLACE conserva los permisos de ejecucion que la funcion ya tenia.
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.usuarios AS u
      WHERE u.id = (SELECT auth.uid()) AND u.active
    )
  END
$$;

CREATE OR REPLACE FUNCTION private.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.role FROM public.usuarios AS u
  WHERE u.id = (SELECT auth.uid()) AND u.active
$$;

REVOKE ALL ON FUNCTION private.auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.auth_role() TO anon, authenticated, service_role, postgres;

-- La politica de UPDATE permite editar el perfil propio; este trigger impide
-- que esa via reactive cuentas o eleve privilegios con un JWT aun vigente.
CREATE OR REPLACE FUNCTION public.guard_usuarios_role_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active)
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND (SELECT auth.role()) IS DISTINCT FROM 'service_role'
     AND (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador activo puede cambiar role o active'
      USING ERRCODE = '42501';
  END IF;
  -- Serializa bajas/promociones de admin para no dejar el sistema sin acceso.
  IF OLD.role = 'admin' AND OLD.active
     AND (NEW.role <> 'admin' OR NOT NEW.active) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(20261001, 1);
    IF (SELECT count(*) FROM public.usuarios AS u
        WHERE u.role = 'admin' AND u.active) <= 1 THEN
      RAISE EXCEPTION 'Debe quedar al menos un administrador activo'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_usuarios_role_active ON public.usuarios;
CREATE TRIGGER trg_guard_usuarios_role_active
BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.guard_usuarios_role_active();

-- La auditoria conoce este helper booleano de RLS; anon no puede ejecutarlo.
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
      ('yappy_mail_sync_state'), ('yappy_mail_messages'), ('yappy_payments')
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
      ('is_authenticated')
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
