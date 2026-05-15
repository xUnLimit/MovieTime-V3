-- ============================================================================
-- Schema cleanup and hardening.
--
-- Keeps legacy orphan data for historical dashboard metrics, but moves it out
-- of the public API schema. Removes retired migration/cache artifacts from
-- public and closes advisor findings that can be handled in migrations.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS migration_audit;
REVOKE ALL ON SCHEMA migration_audit FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.legacy_orphan_records') IS NOT NULL THEN
    ALTER TABLE public.legacy_orphan_records SET SCHEMA migration_audit;
  END IF;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA migration_audit FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.get_dashboard_stats_live()
  SET search_path = public, migration_audit, pg_catalog;

DROP FUNCTION IF EXISTS public.rebuild_dashboard_financial_stats();
DROP TABLE IF EXISTS public.dashboard_stats;
DROP TABLE IF EXISTS public.template_placeholders;
DROP TABLE IF EXISTS public.uuid_id_map;

ALTER FUNCTION public.create_venta_with_initial_payment(
  TEXT, TEXT, TEXT, venta_estado_enum, INTEGER, TEXT, TEXT, TEXT,
  DATE, DATE, ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID
) SET search_path = public, pg_catalog;

ALTER FUNCTION public.create_servicio_with_initial_payment(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER,
  DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC,
  NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID
) SET search_path = public, pg_catalog;

DROP POLICY IF EXISTS push_subscriptions_select_self_or_admin ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_self_or_admin ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update_self_or_admin ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_self_or_admin ON public.push_subscriptions;

CREATE POLICY push_subscriptions_select_self_or_admin ON public.push_subscriptions
  FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR (SELECT private.auth_role()) = 'admin');

CREATE POLICY push_subscriptions_insert_self_or_admin ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT private.auth_role()) = 'admin');

CREATE POLICY push_subscriptions_update_self_or_admin ON public.push_subscriptions
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()) OR (SELECT private.auth_role()) = 'admin')
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT private.auth_role()) = 'admin');

CREATE POLICY push_subscriptions_delete_self_or_admin ON public.push_subscriptions
  FOR DELETE
  USING (user_id = (SELECT auth.uid()) OR (SELECT private.auth_role()) = 'admin');

UPDATE public.ventas
SET estado = 'inactivo'::venta_estado_enum,
    updated_at = now()
WHERE archivado_at IS NOT NULL
  AND estado = 'activo'::venta_estado_enum;

CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('profiles'), ('currencies'), ('exchange_rates'), ('usuarios'),
      ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('push_subscriptions'), ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo')
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
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments')
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
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments')
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
