-- Explicitly lock down destructive RPCs. Supabase roles can retain EXECUTE via
-- default PUBLIC grants unless revoked directly.

REVOKE EXECUTE ON FUNCTION public.delete_venta_with_payments(text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_servicio_with_payments(text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_venta_with_payments(text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_servicio_with_payments(text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.delete_venta_with_payments(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_servicio_with_payments(text, boolean) TO authenticated;
