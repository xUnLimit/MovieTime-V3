-- Entrega unica de codigos de Netflix: cada correo (identificado por el hash de su Message-ID) se entrega
-- a un solo numero de WhatsApp. Aditiva y compatible con la version anterior de la app, que no usa la tabla.
CREATE TABLE public.netflix_code_claims (
  mail_key text PRIMARY KEY CHECK (mail_key ~ '^[0-9a-f]{64}$'),
  wa_id text NOT NULL CHECK (length(wa_id) BETWEEN 1 AND 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX netflix_code_claims_created_at_idx ON public.netflix_code_claims (created_at);

-- Sin politicas: solo las funciones SECURITY DEFINER y service_role (que omite RLS) tocan la tabla.
ALTER TABLE public.netflix_code_claims ENABLE ROW LEVEL SECURITY;
-- Los privilegios por defecto de Supabase tambien dan acceso total a service_role: se quitan y se concede solo lectura.
REVOKE ALL ON TABLE public.netflix_code_claims FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.netflix_code_claims TO service_role;

-- Resultado: 'claimed' (primera entrega), 'mine' (ya era de este numero) o 'taken' (de otro numero).
CREATE FUNCTION public.claim_netflix_code(p_mail_key text, p_wa_id text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner text;
BEGIN
  IF p_mail_key IS NULL OR p_mail_key !~ '^[0-9a-f]{64}$'
    OR p_wa_id IS NULL OR length(p_wa_id) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'invalid netflix code claim';
  END IF;

  -- Los codigos vencen en minutos: limpiar lo antiguo mantiene la tabla pequena sin un cron.
  DELETE FROM public.netflix_code_claims WHERE created_at < now() - interval '2 days';

  INSERT INTO public.netflix_code_claims (mail_key, wa_id)
  VALUES (p_mail_key, p_wa_id)
  ON CONFLICT (mail_key) DO NOTHING;
  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT c.wa_id INTO v_owner FROM public.netflix_code_claims c WHERE c.mail_key = p_mail_key;
  IF v_owner = p_wa_id THEN
    RETURN 'mine';
  END IF;
  RETURN 'taken';
END;
$$;

-- Libera solo la reclamacion propia, para reintentar cuando el envio por WhatsApp falla.
CREATE FUNCTION public.release_netflix_code(p_mail_key text, p_wa_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deleted integer;
BEGIN
  IF p_mail_key IS NULL OR p_mail_key !~ '^[0-9a-f]{64}$'
    OR p_wa_id IS NULL OR length(p_wa_id) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'invalid netflix code release';
  END IF;
  DELETE FROM public.netflix_code_claims WHERE mail_key = p_mail_key AND wa_id = p_wa_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_netflix_code(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_netflix_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_netflix_code(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_netflix_code(text, text) TO service_role;
