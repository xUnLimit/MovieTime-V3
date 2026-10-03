-- Additive: only administrators can close interests; no contact/queue edits.
GRANT UPDATE (estado) ON public.intereses TO authenticated;
CREATE POLICY intereses_admin_update ON public.intereses FOR UPDATE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');

-- Expand-compatible: a human can take an existing legacy chat before v2 has
-- persisted its first state. Reuse the current published flow; never fabricate one.
CREATE OR REPLACE FUNCTION public.take_over_conversation(p_wa_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'invalid conversation id' USING ERRCODE = '22023';
  END IF;
  UPDATE public.whatsapp_conversation_state SET owner = 'humano', awaiting = NULL,
    revision = revision + 1, updated_at = clock_timestamp() WHERE wa_id = p_wa_id;
  IF FOUND THEN RETURN true; END IF;
  INSERT INTO public.whatsapp_conversation_state(wa_id, flow_version, node_id, owner, expires_at)
    SELECT p_wa_id, v.version, v.definition->>'entryNodeId', 'humano', clock_timestamp() + interval '30 days'
    FROM public.whatsapp_bot_config c JOIN public.whatsapp_bot_versions v ON v.version = c.published_version
    WHERE c.id = 'global'
    ON CONFLICT (wa_id) DO UPDATE SET owner = 'humano', awaiting = NULL,
      revision = public.whatsapp_conversation_state.revision + 1, updated_at = clock_timestamp();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.take_over_conversation(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.take_over_conversation(text) TO authenticated;
