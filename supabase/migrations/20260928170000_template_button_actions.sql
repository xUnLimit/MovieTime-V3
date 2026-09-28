CREATE FUNCTION public.template_button_actions_valid(payload jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(payload) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT jsonb_array_elements(payload) LOOP
    IF jsonb_typeof(item) <> 'string'
      OR item #>> '{}' NOT IN ('RENOVAR', 'NO_CONTINUAR', 'DATOS', 'NINGUNA') THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.template_button_actions_valid(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.template_button_actions_valid(jsonb) TO authenticated, service_role;

ALTER TABLE public.templates
  ADD COLUMN meta_button_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT templates_meta_button_actions_valid
    CHECK (public.template_button_actions_valid(meta_button_actions));

UPDATE public.templates
SET meta_button_actions = CASE
  WHEN tipo IN ('dia_pago', 'cancelacion') THEN '["RENOVAR","NO_CONTINUAR"]'::jsonb
  ELSE '["DATOS"]'::jsonb
END
WHERE tipo IN ('dia_pago', 'cancelacion', 'actualizacion_credenciales', 'transferencia_servicio');
