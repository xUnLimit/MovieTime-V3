-- ============================================================================
-- Rename internal app profiles to usuarios.
--
-- auth.users remains the Supabase-managed authentication table.
-- public.usuarios now stores internal app users: role, active flag and display
-- data. public.terceros remains the commercial customers/resellers table.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     AND to_regclass('public.usuarios') IS NULL THEN
    ALTER TABLE public.profiles RENAME TO usuarios;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'public.usuarios does not exist after profiles rename';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.usuarios'::regclass
      AND conname = 'profiles_pkey'
  ) THEN
    ALTER TABLE public.usuarios RENAME CONSTRAINT profiles_pkey TO usuarios_pkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.usuarios'::regclass
      AND conname = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.usuarios RENAME CONSTRAINT profiles_id_fkey TO usuarios_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.usuarios'::regclass
      AND tgname = 'trg_touch_profiles'
  ) THEN
    ALTER TRIGGER trg_touch_profiles ON public.usuarios RENAME TO trg_touch_usuarios;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usuarios'
      AND policyname = 'profiles_select_self_or_admin'
  ) THEN
    ALTER POLICY profiles_select_self_or_admin ON public.usuarios
      RENAME TO usuarios_select_self_or_admin;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usuarios'
      AND policyname = 'profiles_update_self_or_admin_no_role'
  ) THEN
    ALTER POLICY profiles_update_self_or_admin_no_role ON public.usuarios
      RENAME TO usuarios_update_self_or_admin_no_role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usuarios'
      AND policyname = 'profiles_update_self_no_role'
  ) THEN
    ALTER POLICY profiles_update_self_no_role ON public.usuarios
      RENAME TO usuarios_update_self_no_role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usuarios'
      AND policyname = 'profiles_insert_admin'
  ) THEN
    ALTER POLICY profiles_insert_admin ON public.usuarios
      RENAME TO usuarios_insert_admin;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usuarios'
      AND policyname = 'profiles_delete_admin'
  ) THEN
    ALTER POLICY profiles_delete_admin ON public.usuarios
      RENAME TO usuarios_delete_admin;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usuarios'
      AND policyname = 'profiles_admin_all'
  ) THEN
    ALTER POLICY profiles_admin_all ON public.usuarios
      RENAME TO usuarios_admin_all;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.usuarios WHERE id = (SELECT auth.uid())
$$;

REVOKE ALL ON FUNCTION private.auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.auth_role() TO anon, authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, ''),
    'operador'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('terceros'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('notificaciones'), ('notificaciones_venta'),
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

COMMIT;
