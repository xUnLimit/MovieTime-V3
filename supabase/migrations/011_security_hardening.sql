-- ============================================================================
-- 011_security_hardening.sql
-- Correcciones de warnings del Supabase database linter:
--   * agregar SET search_path a funciones de trigger;
--   * mover pg_trgm fuera de public a schema 'extensions';
--   * revocar EXECUTE publico de funciones SECURITY DEFINER (auth_role,
--     handle_new_auth_user) para impedir invocacion via REST.
-- ============================================================================

ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.set_venta_categoria_snapshot() SET search_path = public;
ALTER FUNCTION public.recalc_perfiles_ocupados() SET search_path = public;
ALTER FUNCTION public.is_authenticated() SET search_path = public;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

REVOKE EXECUTE ON FUNCTION public.auth_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role() TO postgres, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres, service_role;
