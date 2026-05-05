-- ============================================================================
-- 012_rls_authenticated_function_grants.sql
-- auth_role() se usa dentro de policies RLS para usuarios autenticados.
-- El hardening revoco EXECUTE publico; se restaura solo para authenticated.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated;
