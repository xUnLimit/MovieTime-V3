BEGIN;
CREATE TABLE public.mt_service_access (
  service_id text PRIMARY KEY REFERENCES public.servicios(id),
  mode text NOT NULL DEFAULT 'password' CHECK (mode IN ('password', 'code')),
  provider text NOT NULL DEFAULT 'netflix' CHECK (provider = 'netflix'),
  rotation_confirmed_at timestamptz,
  updated_by uuid REFERENCES public.usuarios(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mode <> 'code' OR rotation_confirmed_at IS NOT NULL)
);
ALTER TABLE public.mt_service_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY mt_service_access_admin_read ON public.mt_service_access FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin' AND EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = (SELECT auth.uid()) AND active));
REVOKE ALL ON public.mt_service_access FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.mt_service_access TO authenticated, service_role;

CREATE FUNCTION public.mt_set_service_access(p_service_id text, p_mode text, p_rotation_confirmed boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' OR NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = (SELECT auth.uid()) AND active)
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_mode NOT IN ('password', 'code') OR p_mode IS NULL OR p_rotation_confirmed IS NULL
    OR (p_mode = 'code' AND NOT p_rotation_confirmed)
    THEN RAISE EXCEPTION 'rotation required' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.servicios WHERE id = p_service_id AND activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'service unavailable' USING ERRCODE = '22023'; END IF;
  IF p_mode = 'code' AND NOT EXISTS (
    SELECT 1 FROM public.servicios s JOIN public.categorias c ON c.id = s.categoria_id
    WHERE s.id = p_service_id AND c.nombre ILIKE '%netflix%')
    THEN RAISE EXCEPTION 'provider not verified' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.mt_service_access(service_id, mode, rotation_confirmed_at, updated_by)
    VALUES (p_service_id, p_mode, CASE WHEN p_rotation_confirmed THEN now() END, auth.uid())
    ON CONFLICT (service_id) DO UPDATE SET mode = EXCLUDED.mode,
      rotation_confirmed_at = coalesce(EXCLUDED.rotation_confirmed_at, mt_service_access.rotation_confirmed_at),
      updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.domain_events(type, aggregate_type, aggregate_id, payload)
    VALUES ('access.mode_changed', 'servicio', p_service_id,
      jsonb_build_object('version', 1, 'mode', p_mode, 'actor_id', auth.uid()));
  RETURN p_service_id;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_set_service_access(text,text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mt_set_service_access(text,text,boolean) TO authenticated;
COMMIT;
