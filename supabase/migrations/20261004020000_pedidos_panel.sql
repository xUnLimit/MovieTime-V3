-- Additive panel snapshots; old callers keep their defaults.
ALTER TABLE public.pedido_items ADD COLUMN panel_snapshot jsonb;
ALTER TABLE public.pedidos ADD COLUMN panel_batch_id uuid REFERENCES public.pedidos(id);
CREATE INDEX pedidos_panel_batch_idx ON public.pedidos(panel_batch_id);

CREATE OR REPLACE FUNCTION public.crear_pedido(
  p_tercero_id text, p_contact_id text, p_canal text, p_moneda text,
  p_items jsonb, p_expira_at timestamptz, p_exchange_rate numeric, p_idempotency_key uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_id uuid; v_existing text; j jsonb; s public.servicios%ROWTYPE;
  v public.ventas%ROWTYPE; plan public.planes%ROWTYPE; per public.venta_periodos%ROWTYPE;
  precio numeric; ciclo public.ciclo_pago_enum; descuento numeric; plan_id text;
  plan_nombre text; tipo_nombre text;
BEGIN
  v_existing := public.pedido_intent('crear_pedido', p_idempotency_key);
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  IF p_canal IS NULL OR p_canal NOT IN ('panel','whatsapp') OR
    (NULLIF(btrim(p_tercero_id), '') IS NULL AND NULLIF(btrim(p_contact_id), '') IS NULL) OR
    p_expira_at IS NULL OR p_expira_at <= now() OR p_exchange_rate IS NULL OR
    p_exchange_rate <= 0 OR p_exchange_rate = 'NaN'::numeric OR
    (p_moneda = 'USD' AND p_exchange_rate <> 1) OR
    NOT EXISTS (SELECT 1 FROM public.currencies WHERE code = p_moneda AND activo) OR
    p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
  THEN RAISE EXCEPTION 'pedido_invalid'; END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'pedido_invalid'; END IF;
  INSERT INTO public.pedidos(tercero_id, contact_id, canal, moneda, expira_at, exchange_rate)
    VALUES (NULLIF(btrim(p_tercero_id), ''), NULLIF(btrim(p_contact_id), ''), p_canal, p_moneda, p_expira_at, p_exchange_rate)
    RETURNING id INTO v_id;
  FOR j IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(j) <> 'object' OR j->>'tipo' IS NULL OR j->>'tipo' NOT IN ('nueva','renovacion') OR
      (j ? 'moneda' AND j->>'moneda' IS DISTINCT FROM p_moneda)
    THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
    descuento := COALESCE((j->>'descuento')::numeric, 0);
    IF descuento NOT BETWEEN 0 AND 100 OR descuento = 'NaN'::numeric OR descuento <> round(descuento, 2) THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
    IF j->>'tipo' = 'nueva' THEN
      IF j->>'venta_id' IS NOT NULL THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
      SELECT * INTO plan FROM public.planes WHERE id = j->>'plan_id' AND activo;
      IF NOT FOUND THEN RAISE EXCEPTION 'pedido_invalid_plan'; END IF;
      SELECT * INTO s FROM public.servicios WHERE id = j->>'servicio_id';
      IF NOT FOUND OR s.categoria_id <> plan.categoria_id OR s.plan_tipo_id IS DISTINCT FROM plan.plan_tipo_id OR
        (j ? 'categoria_id' AND j->>'categoria_id' IS DISTINCT FROM plan.categoria_id)
      THEN RAISE EXCEPTION 'pedido_invalid_service'; END IF;
      precio := plan.precio; ciclo := plan.ciclo_pago;
      IF j ? 'panel' THEN
        IF p_canal <> 'panel' OR jsonb_typeof(j->'panel') <> 'object' OR
          COALESCE(j->'panel'->>'estado','') NOT IN ('activo','inactivo') OR
          NULLIF(j->'panel'->>'item_id','') IS NULL OR length(j->'panel'->>'item_id') > 100 OR
          length(j->'panel'->>'perfil_nombre') > 200 OR length(j->'panel'->>'codigo') > 200 OR
          length(j->'panel'->>'notas') > 5000 OR length(j->'panel'->>'metodo_pago_nombre') > 200 OR
          (j->'panel'->>'fecha_fin')::date IS NULL OR
          (j->'panel'->>'fecha_inicio')::date IS NULL OR
          (j->'panel'->>'fecha_fin')::date < (j->'panel'->>'fecha_inicio')::date
        THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
        precio := (j->'panel'->>'precio')::numeric;
        IF precio IS NULL OR precio < 0 OR precio = 'NaN'::numeric OR precio <> round(precio,2) OR
          (j->'panel'->>'total')::numeric IS DISTINCT FROM round(precio * (1 - descuento / 100),2)
        THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
      END IF; plan_id := plan.id; plan_nombre := plan.nombre;
      SELECT nombre INTO tipo_nombre FROM public.planes_tipos WHERE id = plan.plan_tipo_id;
    ELSE
      IF j ? 'panel' THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
      SELECT * INTO v FROM public.ventas WHERE id = j->>'venta_id';
      IF NOT FOUND OR p_tercero_id IS NULL OR v.cliente_id IS DISTINCT FROM p_tercero_id
      THEN RAISE EXCEPTION 'pedido_invalid_sale'; END IF;
      SELECT * INTO s FROM public.servicios WHERE id = v.servicio_id;
      SELECT * INTO per FROM public.venta_periodos WHERE venta_id = v.id ORDER BY numero_periodo DESC LIMIT 1;
      IF NOT FOUND OR per.moneda_original <> p_moneda THEN RAISE EXCEPTION 'pedido_currency_mismatch'; END IF;
      precio := per.precio_original; ciclo := per.ciclo_pago; plan_id := per.plan_id;
      plan_nombre := per.plan_nombre_snapshot; tipo_nombre := per.plan_tipo_nombre_snapshot;
    END IF;
    IF NOT s.activo OR s.en_reposo OR s.cortado_at IS NOT NULL OR s.archivado_at IS NOT NULL OR
      (j->>'tipo' = 'renovacion' AND (v.estado <> 'activo' OR v.cortada_at IS NOT NULL OR v.archivado_at IS NOT NULL))
    THEN RAISE EXCEPTION 'pedido_service_unavailable'; END IF;
    IF j->>'ciclo_pago' IS DISTINCT FROM ciclo::text THEN RAISE EXCEPTION 'pedido_cycle_mismatch'; END IF;
    INSERT INTO public.pedido_items(pedido_id, tipo, venta_id, plan_id, categoria_id, servicio_id,
      perfil_numero, ciclo_pago, precio, descuento, total, plan_nombre_snapshot, plan_tipo_nombre_snapshot, panel_snapshot)
    VALUES (v_id, j->>'tipo', CASE WHEN j->>'tipo' = 'renovacion' THEN v.id END, plan_id, s.categoria_id, s.id,
      CASE WHEN j->>'tipo' = 'renovacion' THEN v.perfil_numero ELSE (j->>'perfil_numero')::integer END,
      ciclo, precio, descuento, round(precio * (1 - descuento / 100), 2), COALESCE(plan_nombre,''), COALESCE(tipo_nombre,''), j->'panel');
  END LOOP;
  UPDATE public.pedidos SET total = (SELECT sum(total) FROM public.pedido_items WHERE pedido_id = v_id) WHERE id = v_id;
  INSERT INTO public.rpc_idempotency_keys(idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'crear_pedido', v_id::text, auth.uid());
  RETURN v_id::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_pedido_item(p_item uuid, p_pedido uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  i public.pedido_items%ROWTYPE; p public.pedidos%ROWTYPE; s public.servicios%ROWTYPE;
  v public.ventas%ROWTYPE; inicio date; fin date; perfil integer; resultado text;
BEGIN
  SELECT * INTO i FROM public.pedido_items WHERE id = p_item AND pedido_id = p_pedido;
  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido;
  SELECT * INTO s FROM public.servicios WHERE id = i.servicio_id FOR UPDATE;
  IF NOT s.activo OR s.en_reposo OR s.cortado_at IS NOT NULL OR s.archivado_at IS NOT NULL
  THEN RAISE EXCEPTION 'pedido_service_unavailable'; END IF;
  IF i.tipo = 'renovacion' THEN
    -- Same advisory lock as create_venta_payment: read this sale's latest expiry under that lock.
    PERFORM pg_advisory_xact_lock(hashtextextended(i.venta_id, 0));
    SELECT * INTO v FROM public.ventas WHERE id = i.venta_id FOR UPDATE;
    IF v.estado <> 'activo' OR v.cortada_at IS NOT NULL OR v.archivado_at IS NOT NULL OR
      v.servicio_id <> i.servicio_id OR v.cliente_id IS DISTINCT FROM p.tercero_id
    THEN RAISE EXCEPTION 'pedido_service_unavailable'; END IF;
    SELECT fecha_fin INTO inicio FROM public.venta_periodos WHERE venta_id = v.id ORDER BY numero_periodo DESC LIMIT 1;
    IF inicio IS NULL THEN RAISE EXCEPTION 'pedido_invalid_sale'; END IF;
  ELSE
    inicio := COALESCE((i.panel_snapshot->>'fecha_inicio')::date, current_date);
    perfil := i.perfil_numero;
    IF perfil IS NULL AND COALESCE(i.panel_snapshot->>'estado','activo') = 'activo' THEN
      SELECT n INTO perfil FROM generate_series(1, s.perfiles_disponibles) n
      WHERE NOT EXISTS (SELECT 1 FROM public.ventas WHERE servicio_id = s.id AND perfil_numero = n
        AND estado = 'activo' AND archivado_at IS NULL) ORDER BY n LIMIT 1;
    END IF;
    IF COALESCE(i.panel_snapshot->>'estado','activo') = 'activo' AND (s.perfiles_ocupados >= s.perfiles_disponibles OR perfil IS NULL OR perfil > s.perfiles_disponibles OR
      EXISTS (SELECT 1 FROM public.ventas WHERE servicio_id = s.id AND perfil_numero = perfil AND estado = 'activo' AND archivado_at IS NULL))
    THEN
      UPDATE public.pedido_items SET estado = 'sin_stock' WHERE id = i.id;
      RETURN;
    END IF;
  END IF;
  fin := (inicio + make_interval(months => CASE i.ciclo_pago WHEN 'mensual' THEN 1
    WHEN 'trimestral' THEN 3 WHEN 'semestral' THEN 6 ELSE 12 END))::date;
  fin := COALESCE((i.panel_snapshot->>'fecha_fin')::date, fin);
  IF i.tipo = 'nueva' THEN
    resultado := public.create_venta_with_initial_payment(
      p_cliente_id => p.tercero_id, p_servicio_id => i.servicio_id, p_categoria_id => i.categoria_id,
      p_estado => COALESCE(i.panel_snapshot->>'estado','activo')::public.venta_estado_enum, p_perfil_numero => perfil,
      p_perfil_nombre => i.panel_snapshot->>'perfil_nombre', p_codigo => i.panel_snapshot->>'codigo',
      p_notas => COALESCE(i.panel_snapshot->>'notas','Pedido ' || p.id::text),
      p_fecha_inicio => inicio, p_fecha_fin => fin, p_ciclo_pago => i.ciclo_pago,
      p_precio_original => i.precio, p_descuento => i.descuento, p_total_original => i.total,
      p_moneda_original => p.moneda, p_total_usd => round(i.total / p.exchange_rate, 4),
      p_exchange_rate => p.exchange_rate, p_metodo_pago_id => i.panel_snapshot->>'metodo_pago_id',
      p_metodo_pago_nombre_snapshot => COALESCE(i.panel_snapshot->>'metodo_pago_nombre','Pedido'),
      p_fecha_pago => now(), p_pago_notas => COALESCE(i.panel_snapshot->>'notas','Pedido ' || p.id::text),
      p_plan_id => i.plan_id, p_plan_nombre_snapshot => i.plan_nombre_snapshot,
      p_plan_tipo_nombre_snapshot => i.plan_tipo_nombre_snapshot, p_created_by => auth.uid(), p_idempotency_key => i.id);
    -- trg_recalc_perfiles_ocupados updates the counter under the service lock; do not double increment.
  ELSE
    PERFORM public.create_venta_payment(
      p_venta_id => i.venta_id, p_fecha_inicio => inicio, p_fecha_fin => fin, p_ciclo_pago => i.ciclo_pago,
      p_precio_original => i.precio, p_descuento => i.descuento, p_total_original => i.total,
      p_moneda_original => p.moneda, p_total_usd => round(i.total / p.exchange_rate, 4),
      p_exchange_rate => p.exchange_rate, p_metodo_pago_id => i.panel_snapshot->>'metodo_pago_id',
      p_metodo_pago_nombre_snapshot => COALESCE(i.panel_snapshot->>'metodo_pago_nombre','Pedido'),
      p_fecha_pago => now(), p_pago_notas => COALESCE(i.panel_snapshot->>'notas','Pedido ' || p.id::text),
      p_plan_id => i.plan_id, p_plan_nombre_snapshot => i.plan_nombre_snapshot,
      p_plan_tipo_nombre_snapshot => i.plan_tipo_nombre_snapshot, p_created_by => auth.uid(), p_idempotency_key => i.id);
    resultado := i.venta_id;
  END IF;
  UPDATE public.pedido_items SET estado = 'aplicado', venta_id_resultante = resultado,
    perfil_numero = COALESCE(perfil, i.perfil_numero) WHERE id = i.id;
END;
$$;
REVOKE ALL ON FUNCTION public.aplicar_pedido_item(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- One HTTP call, one transaction, including all currencies. Existing signatures remain available.
CREATE FUNCTION public.confirmar_pedido(p_panel_pedidos jsonb, p_idempotency_key uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_group jsonb; v_id uuid; v_batch uuid; v_existing text; v_total numeric;
BEGIN
  v_existing := public.pedido_intent('confirmar_pedido_panel', p_idempotency_key);
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  IF p_panel_pedidos IS NULL OR jsonb_typeof(p_panel_pedidos) <> 'array' THEN
    RAISE EXCEPTION 'pedido_invalid';
  END IF;
  IF jsonb_array_length(p_panel_pedidos) NOT BETWEEN 1 AND 100 OR
    (SELECT count(*) FROM jsonb_array_elements(p_panel_pedidos) g,
      LATERAL jsonb_array_elements(g->'items') i) NOT BETWEEN 1 AND 100 OR
    EXISTS (SELECT 1 FROM jsonb_array_elements(p_panel_pedidos) g
      GROUP BY g->>'moneda' HAVING count(*) > 1) OR
    (SELECT count(DISTINCT g->>'cliente_id') FROM jsonb_array_elements(p_panel_pedidos) g) <> 1 OR
    EXISTS (SELECT 1 FROM jsonb_array_elements(p_panel_pedidos) g,
      LATERAL jsonb_array_elements(g->'items') i GROUP BY i->'panel'->>'item_id' HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'pedido_invalid'; END IF;
  -- Lock every service across currencies in the same order before item application.
  PERFORM s.id FROM public.servicios s WHERE s.id IN
    (SELECT i->>'servicio_id' FROM jsonb_array_elements(p_panel_pedidos) g,
      LATERAL jsonb_array_elements(g->'items') i) ORDER BY s.id FOR UPDATE;
  FOR v_group IN SELECT value FROM jsonb_array_elements(p_panel_pedidos) LOOP
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_group->'items') i
      WHERE i->>'tipo' IS DISTINCT FROM 'nueva' OR NOT (i ? 'panel'))
    THEN RAISE EXCEPTION 'pedido_invalid_item'; END IF;
    v_id := public.crear_pedido(v_group->>'cliente_id', NULL, 'panel', v_group->>'moneda', v_group->'items',
      now() + interval '1 day', (v_group->>'exchange_rate')::numeric, (v_group->>'crear_key')::uuid)::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.pedidos WHERE id = v_id AND estado = 'borrador'
      AND created_by = auth.uid() AND panel_batch_id IS NULL)
    THEN RAISE EXCEPTION 'pedido_invalid_state'; END IF;
    v_batch := COALESCE(v_batch, v_id);
    UPDATE public.pedidos SET panel_batch_id = v_batch WHERE id = v_id;
    SELECT total INTO v_total FROM public.pedidos WHERE id = v_id;
    IF v_total IS DISTINCT FROM (v_group->>'monto')::numeric THEN RAISE EXCEPTION 'pedido_invalid_payment'; END IF;
    -- Free carts retain their initial zero-value period/payment without a fictitious receipt.
    IF v_total = 0 THEN
      PERFORM public.aplicar_pedido_item(i.id, v_id) FROM public.pedido_items i
        WHERE pedido_id = v_id ORDER BY servicio_id, id;
      UPDATE public.pedidos SET estado = CASE WHEN EXISTS
        (SELECT 1 FROM public.pedido_items WHERE pedido_id = v_id AND estado = 'sin_stock')
        THEN 'pagado' ELSE 'entregado' END WHERE id = v_id;
    ELSE
      PERFORM public.confirmar_pedido(v_id, (v_group->>'confirmar_key')::uuid, 'manual', v_total, NULL);
    END IF;
  END LOOP;
  INSERT INTO public.rpc_idempotency_keys(idempotency_key,rpc_name,result_id,created_by)
    VALUES (p_idempotency_key,'confirmar_pedido_panel',v_batch::text,auth.uid());
  RETURN v_batch::text;
END;
$$;
REVOKE ALL ON FUNCTION public.confirmar_pedido(jsonb, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_pedido(jsonb, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
