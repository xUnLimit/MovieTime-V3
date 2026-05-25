-- Keep notification read models behind authenticated/service-role access only.
REVOKE SELECT ON public.v_notificaciones_venta FROM anon;
REVOKE SELECT ON public.v_notificaciones_servicio FROM anon;
REVOKE SELECT ON public.v_notificaciones_reposo FROM anon;

GRANT SELECT ON public.v_notificaciones_venta TO authenticated, service_role;
GRANT SELECT ON public.v_notificaciones_servicio TO authenticated, service_role;
GRANT SELECT ON public.v_notificaciones_reposo TO authenticated, service_role;
