-- Textos editables de la conversacion de compras. Expand-only: tabla y funcion nuevas; la version anterior de la
-- aplicacion las ignora y usa los textos originales.
BEGIN;
CREATE TABLE public.mt_commerce_copy (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-zA-Z0-9]{1,48}$'),
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 1000 AND text !~ '[<>]'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.mt_commerce_copy ENABLE ROW LEVEL SECURITY;
CREATE POLICY mt_commerce_copy_admin_read ON public.mt_commerce_copy FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');
REVOKE ALL ON public.mt_commerce_copy FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.mt_commerce_copy TO authenticated, service_role;

-- p_text NULL restaura el texto original. La aplicacion valida marcadores y limites por mensaje antes de guardar.
CREATE FUNCTION public.mt_set_commerce_copy(p_key text, p_text text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' OR NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = (SELECT auth.uid()) AND active)
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_key IS NULL OR p_key !~ '^[a-z][a-zA-Z0-9]{1,48}$'
    OR (p_text IS NOT NULL AND (char_length(btrim(p_text)) NOT BETWEEN 1 AND 1000 OR p_text ~ '[<>]'))
    THEN RAISE EXCEPTION 'invalid copy' USING ERRCODE = '22023'; END IF;
  IF p_text IS NULL THEN
    DELETE FROM public.mt_commerce_copy WHERE key = p_key;
  ELSE
    INSERT INTO public.mt_commerce_copy(key, text, updated_by) VALUES (p_key, btrim(p_text), (SELECT auth.uid()))
    ON CONFLICT (key) DO UPDATE SET text = EXCLUDED.text, updated_at = now(), updated_by = EXCLUDED.updated_by;
  END IF;
  RETURN p_key;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_set_commerce_copy(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mt_set_commerce_copy(text, text) TO authenticated;
COMMIT;
