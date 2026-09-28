-- Meta template cache is refreshed by the service role; admins can inspect it.
CREATE FUNCTION public.whatsapp_meta_buttons_valid(payload jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(payload) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT jsonb_array_elements(payload) LOOP
    IF jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item -> 'type') <> 'string'
      OR jsonb_typeof(item -> 'text') <> 'string' THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_meta_buttons_valid(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_meta_buttons_valid(jsonb) TO service_role;

CREATE TABLE public.whatsapp_meta_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  language text NOT NULL,
  status text NOT NULL,
  category text NOT NULL,
  body text NOT NULL,
  header text,
  footer text,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (public.whatsapp_meta_buttons_valid(buttons)),
  param_count integer NOT NULL CHECK (param_count >= 0),
  meta_template_id text NOT NULL,
  retired boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL,
  UNIQUE (name, language)
);

ALTER TABLE public.whatsapp_meta_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_meta_templates_admin_read ON public.whatsapp_meta_templates
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active));
REVOKE ALL ON public.whatsapp_meta_templates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_meta_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_meta_templates TO service_role;

ALTER TABLE public.templates
  ADD COLUMN meta_template_name text,
  ADD COLUMN meta_param_map jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT templates_meta_param_map_array CHECK (jsonb_typeof(meta_param_map) = 'array');

ALTER TYPE tipo_template_enum ADD VALUE IF NOT EXISTS 'datos_pago';
ALTER TYPE tipo_template_enum ADD VALUE IF NOT EXISTS 'despedida';
