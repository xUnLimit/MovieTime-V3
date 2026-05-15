-- ============================================================================
-- Keep dashboard live stats private to authenticated app users.
-- ============================================================================

REVOKE ALL ON FUNCTION public.get_dashboard_stats_live() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats_live() TO authenticated;
