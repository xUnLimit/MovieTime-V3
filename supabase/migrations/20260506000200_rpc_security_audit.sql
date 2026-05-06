-- Enforce and audit RPC/RLS security expectations.

REVOKE ALL ON FUNCTION public.create_venta_with_initial_payment(
  TEXT, TEXT, TEXT, venta_estado_enum, INTEGER, TEXT, TEXT, TEXT, DATE, DATE,
  ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT,
  TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.create_servicio_with_initial_payment(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER,
  DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC,
  NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.create_venta_payment(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.create_servicio_payment(
  TEXT, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.update_venta_payment_and_period(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.update_servicio_payment_and_period(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.delete_venta_payment_and_empty_period(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_servicio_payment_and_empty_period(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_venta_with_initial_payment(
  TEXT, TEXT, TEXT, venta_estado_enum, INTEGER, TEXT, TEXT, TEXT, DATE, DATE,
  ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT,
  TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_servicio_with_initial_payment(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER,
  DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC,
  NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID
) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('dashboard_stats'), ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo')
  ),
  allowed_authenticated_security_definer(function_name) AS (
    VALUES
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period')
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
      ('delete_servicio_payment_and_empty_period')
  ),
  public_functions AS (
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  )
  SELECT jsonb_build_object(
    'rls_disabled_app_tables',
      (
        SELECT count(*)
        FROM app_tables t
        JOIN pg_class c ON c.relname = t.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE c.relkind = 'r'
          AND c.relrowsecurity = false
      ),
    'security_definer_missing_search_path',
      (
        SELECT count(*)
        FROM public_functions
        WHERE prosecdef = true
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(COALESCE(proconfig, ARRAY[]::text[])) cfg
            WHERE cfg LIKE 'search_path=%'
          )
      ),
    'security_definer_executable_by_anon',
      (
        SELECT count(*)
        FROM public_functions
        WHERE prosecdef = true
          AND has_function_privilege('anon', oid, 'EXECUTE')
      ),
    'unapproved_security_definer_executable_by_authenticated',
      (
        SELECT count(*)
        FROM public_functions pf
        WHERE prosecdef = true
          AND has_function_privilege('authenticated', oid, 'EXECUTE')
          AND NOT EXISTS (
            SELECT 1
            FROM allowed_authenticated_security_definer allowed
            WHERE allowed.function_name = pf.proname
          )
      ),
    'required_rpc_missing_authenticated_execute',
      (
        SELECT count(*)
        FROM required_authenticated_rpcs required
        WHERE NOT EXISTS (
          SELECT 1
          FROM public_functions pf
          WHERE pf.proname = required.function_name
            AND has_function_privilege('authenticated', pf.oid, 'EXECUTE')
        )
      ),
    'required_rpc_executable_by_anon',
      (
        SELECT count(*)
        FROM required_authenticated_rpcs required
        JOIN public_functions pf ON pf.proname = required.function_name
        WHERE has_function_privilege('anon', pf.oid, 'EXECUTE')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.run_security_audit_validations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_audit_validations() TO service_role, postgres;
