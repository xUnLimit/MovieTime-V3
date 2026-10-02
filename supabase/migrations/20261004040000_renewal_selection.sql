-- Additive, opt-in partial renewal. Existing template buttons and RPCs are unchanged.
CREATE TABLE public.renovacion_ajustes (
  id text PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  renovacion_parcial_enabled boolean NOT NULL DEFAULT false,
  notice_max_age_days integer NOT NULL DEFAULT 30 CHECK (notice_max_age_days BETWEEN 1 AND 30),
  selection_ttl_minutes integer NOT NULL DEFAULT 30 CHECK (selection_ttl_minutes BETWEEN 1 AND 1440),
  resumen_template text NOT NULL DEFAULT 'Renovar todo / Elegir' || E'\n' || '{{servicios}}' || E'\n' || 'Total: {{total}} {{moneda}}'
    CHECK (length(resumen_template) BETWEEN 1 AND 1000 AND
      position('{{servicios}}' IN resumen_template) > 0 AND position('{{total}}' IN resumen_template) > 0 AND position('{{moneda}}' IN resumen_template) > 0)
);
INSERT INTO public.renovacion_ajustes (id) VALUES ('global');
ALTER TABLE public.renovacion_ajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY renovacion_ajustes_admin ON public.renovacion_ajustes FOR ALL TO authenticated
  USING ((SELECT private.auth_role()) = 'admin' AND (SELECT public.is_authenticated()))
  WITH CHECK ((SELECT private.auth_role()) = 'admin' AND (SELECT public.is_authenticated()));
REVOKE ALL ON public.renovacion_ajustes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.renovacion_ajustes TO authenticated;
GRANT SELECT ON public.renovacion_ajustes TO service_role;

-- Lock and validate the selection snapshot, then delegate price freezing and all
-- order rules to crear_pedido. No alternate financial implementation.
CREATE FUNCTION public.crear_pedido_renovacion(
  p_tercero_id text, p_contact_id text, p_canal text, p_moneda text,
  p_items jsonb, p_expira_at timestamptz, p_exchange_rate numeric, p_idempotency_key uuid,
  p_notice_id uuid, p_wa_id text, p_expected jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  n public.whatsapp_notices%ROWTYPE; a public.renovacion_ajustes%ROWTYPE;
  v public.ventas%ROWTYPE; per public.venta_periodos%ROWTYPE;
  j jsonb; e jsonb; result text;
BEGIN
  IF NOT public.is_authenticated() THEN RAISE EXCEPTION 'renewal_forbidden'; END IF;
  SELECT * INTO a FROM public.renovacion_ajustes WHERE id = 'global';
  IF NOT FOUND OR NOT a.renovacion_parcial_enabled THEN RAISE EXCEPTION 'renewal_disabled'; END IF;
  SELECT * INTO n FROM public.whatsapp_notices WHERE id = p_notice_id;
  IF NOT FOUND OR n.status <> 'accepted' OR n.wa_id IS DISTINCT FROM p_wa_id
    OR n.tercero_id IS DISTINCT FROM p_tercero_id OR n.tipo NOT IN ('notificacion_regular', 'dia_pago', 'cancelacion')
    OR n.created_at > now() OR n.created_at < now() - make_interval(days => a.notice_max_age_days)
    OR NOT EXISTS (SELECT 1 FROM public.terceros WHERE id = p_tercero_id AND wa_id = p_wa_id AND active)
    OR EXISTS (SELECT 1 FROM public.terceros WHERE wa_id = p_wa_id AND active AND id <> p_tercero_id)
  THEN RAISE EXCEPTION 'renewal_notice_invalid'; END IF;
  IF p_canal IS DISTINCT FROM 'whatsapp' OR p_contact_id IS NOT NULL
    OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_typeof(p_expected) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'renewal_selection_invalid'; END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 OR jsonb_array_length(p_items) <> jsonb_array_length(p_expected)
    OR (SELECT count(DISTINCT value->>'venta_id') FROM jsonb_array_elements(p_expected)) <> jsonb_array_length(p_expected)
    OR (SELECT count(DISTINCT value->>'venta_id') FROM jsonb_array_elements(p_items)) <> jsonb_array_length(p_items)
  THEN RAISE EXCEPTION 'renewal_selection_invalid'; END IF;
  -- Preserve original ledger semantics and serialize identical intents before eligibility checks.
  result := public.pedido_intent('crear_pedido', p_idempotency_key);
  IF result IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.pedidos WHERE id = result::uuid AND notice_id = p_notice_id
      AND tercero_id = p_tercero_id AND moneda = p_moneda)
      OR (SELECT count(*) FROM public.pedido_items WHERE pedido_id = result::uuid) <> jsonb_array_length(p_items)
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) item WHERE NOT EXISTS
        (SELECT 1 FROM public.pedido_items pi JOIN jsonb_array_elements(p_expected) expected
          ON expected->>'venta_id' = pi.venta_id WHERE pi.pedido_id = result::uuid
          AND pi.venta_id = item->>'venta_id' AND pi.tipo = 'renovacion'
          AND pi.ciclo_pago::text = item->>'ciclo_pago' AND pi.precio = (expected->>'precio')::numeric))
    THEN RAISE EXCEPTION 'renewal_intent_mismatch'; END IF;
    RETURN result;
  END IF;
  IF p_expira_at <= now() OR p_expira_at > now() + make_interval(mins => a.selection_ttl_minutes)
  THEN RAISE EXCEPTION 'renewal_selection_expired'; END IF;
  FOR j IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'venta_id' LOOP
    IF j->>'tipo' IS DISTINCT FROM 'renovacion' OR (j->>'descuento')::numeric IS DISTINCT FROM 0
      OR NOT EXISTS (SELECT 1 FROM public.whatsapp_notice_ventas WHERE notice_id = p_notice_id AND venta_id = j->>'venta_id')
    THEN RAISE EXCEPTION 'renewal_selection_invalid'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(j->>'venta_id', 0));
    SELECT * INTO v FROM public.ventas WHERE id = j->>'venta_id' FOR UPDATE;
    IF NOT FOUND OR v.cliente_id IS DISTINCT FROM p_tercero_id OR v.respuesta_cliente = 'no_continuar'
    THEN RAISE EXCEPTION 'renewal_sale_invalid'; END IF;
    SELECT * INTO per FROM public.venta_periodos WHERE venta_id = v.id ORDER BY numero_periodo DESC LIMIT 1;
    SELECT value INTO e FROM jsonb_array_elements(p_expected) WHERE value->>'venta_id' = v.id;
    IF per.id IS NULL OR e IS NULL OR per.id::text IS DISTINCT FROM e->>'period_id'
      OR per.precio_original IS DISTINCT FROM (e->>'precio')::numeric
      OR n.fecha_vencimiento IS NULL OR per.fecha_fin IS DISTINCT FROM n.fecha_vencimiento
    THEN RAISE EXCEPTION 'renewal_snapshot_changed'; END IF;
  END LOOP;
  result := public.crear_pedido(p_tercero_id, p_contact_id, p_canal, p_moneda,
    p_items, p_expira_at, p_exchange_rate, p_idempotency_key);
  UPDATE public.pedidos SET notice_id = p_notice_id WHERE id = result::uuid;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_pedido_renovacion(text,text,text,text,jsonb,timestamptz,numeric,uuid,uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_pedido_renovacion(text,text,text,text,jsonb,timestamptz,numeric,uuid,uuid,text,jsonb)
  TO authenticated;
