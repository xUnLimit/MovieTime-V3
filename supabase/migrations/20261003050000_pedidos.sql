-- Forward-only order orchestration; existing sale/payment RPC signatures stay unchanged.
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tercero_id text REFERENCES public.terceros(id),
  contact_id text CHECK (contact_id IS NULL OR length(btrim(contact_id)) BETWEEN 1 AND 100),
  canal text NOT NULL CHECK (canal IN ('panel', 'whatsapp')),
  moneda text NOT NULL REFERENCES public.currencies(code),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN
    ('borrador','esperando_pago','pago_en_revision','pagado','entregado','expirado','cancelado')),
  expira_at timestamptz NOT NULL,
  notice_id uuid REFERENCES public.whatsapp_notices(id),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  exchange_rate numeric(20,8) NOT NULL CHECK (exchange_rate > 0 AND exchange_rate <> 'NaN'::numeric),
  notas text,
  CHECK (tercero_id IS NOT NULL OR contact_id IS NOT NULL)
);
CREATE TABLE public.pedido_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id),
  tipo text NOT NULL CHECK (tipo IN ('nueva','renovacion')),
  venta_id text REFERENCES public.ventas(id),
  plan_id text REFERENCES public.planes(id),
  categoria_id text REFERENCES public.categorias(id),
  servicio_id text NOT NULL REFERENCES public.servicios(id),
  perfil_numero integer CHECK (perfil_numero > 0),
  ciclo_pago public.ciclo_pago_enum NOT NULL,
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  descuento numeric(5,2) NOT NULL DEFAULT 0 CHECK (descuento BETWEEN 0 AND 100),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aplicado','sin_stock','cancelado')),
  venta_id_resultante text REFERENCES public.ventas(id),
  plan_nombre_snapshot text NOT NULL,
  plan_tipo_nombre_snapshot text NOT NULL,
  CHECK ((tipo = 'nueva' AND venta_id IS NULL AND plan_id IS NOT NULL AND categoria_id IS NOT NULL)
    OR (tipo = 'renovacion' AND venta_id IS NOT NULL)),
  CHECK (total = round(precio * (1 - descuento / 100), 2))
);
CREATE UNIQUE INDEX pedido_items_renewal_idx ON public.pedido_items(pedido_id, venta_id) WHERE tipo = 'renovacion';
CREATE INDEX pedido_items_pedido_idx ON public.pedido_items(pedido_id);
CREATE TABLE public.pedido_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id),
  source text NOT NULL CHECK (source IN ('yappy','manual')),
  yappy_payment_id uuid UNIQUE REFERENCES public.yappy_payments(id),
  monto numeric(12,2) NOT NULL CHECK (monto > 0 AND monto <> 'NaN'::numeric),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'yappy' AND yappy_payment_id IS NOT NULL) OR (source = 'manual' AND yappy_payment_id IS NULL))
);
CREATE INDEX pedido_pagos_pedido_idx ON public.pedido_pagos(pedido_id);
CREATE INDEX pedidos_expiry_idx ON public.pedidos(expira_at) WHERE estado IN ('borrador','esperando_pago');
CREATE TRIGGER pedidos_updated_at BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedidos_read ON public.pedidos FOR SELECT TO authenticated USING ((SELECT public.is_authenticated()));
CREATE POLICY pedido_items_read ON public.pedido_items FOR SELECT TO authenticated USING ((SELECT public.is_authenticated()));
CREATE POLICY pedido_pagos_read ON public.pedido_pagos FOR SELECT TO authenticated USING ((SELECT public.is_authenticated()));
REVOKE ALL ON public.pedidos, public.pedido_items, public.pedido_pagos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pedidos, public.pedido_items, public.pedido_pagos TO authenticated;

-- Private helper follows the existing actor/rpc/key ledger and serializes retries.
CREATE FUNCTION public.pedido_intent(p_rpc text, p_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_result text;
BEGIN
  IF NOT public.is_authenticated() THEN RAISE EXCEPTION 'pedido_forbidden'; END IF;
  IF p_key IS NULL THEN RAISE EXCEPTION 'pedido_key_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text, 0));
  SELECT result_id INTO v_result FROM public.rpc_idempotency_keys
    WHERE created_by = auth.uid() AND rpc_name = p_rpc AND idempotency_key = p_key;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.pedido_intent(text, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.crear_pedido(
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
      precio := plan.precio; ciclo := plan.ciclo_pago; plan_id := plan.id; plan_nombre := plan.nombre;
      SELECT nombre INTO tipo_nombre FROM public.planes_tipos WHERE id = plan.plan_tipo_id;
    ELSE
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
      perfil_numero, ciclo_pago, precio, descuento, total, plan_nombre_snapshot, plan_tipo_nombre_snapshot)
    VALUES (v_id, j->>'tipo', CASE WHEN j->>'tipo' = 'renovacion' THEN v.id END, plan_id, s.categoria_id, s.id,
      CASE WHEN j->>'tipo' = 'renovacion' THEN v.perfil_numero ELSE (j->>'perfil_numero')::integer END,
      ciclo, precio, descuento, round(precio * (1 - descuento / 100), 2), COALESCE(plan_nombre,''), COALESCE(tipo_nombre,''));
  END LOOP;
  UPDATE public.pedidos SET total = (SELECT sum(total) FROM public.pedido_items WHERE pedido_id = v_id) WHERE id = v_id;
  INSERT INTO public.rpc_idempotency_keys(idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'crear_pedido', v_id::text, auth.uid());
  RETURN v_id::text;
END;
$$;

-- Internal item executor: the existing RPCs remain the only writers of periods/payments.
CREATE FUNCTION public.aplicar_pedido_item(p_item uuid, p_pedido uuid) RETURNS void
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
    inicio := current_date;
    perfil := i.perfil_numero;
    IF perfil IS NULL THEN
      SELECT n INTO perfil FROM generate_series(1, s.perfiles_disponibles) n
      WHERE NOT EXISTS (SELECT 1 FROM public.ventas WHERE servicio_id = s.id AND perfil_numero = n
        AND estado = 'activo' AND archivado_at IS NULL) ORDER BY n LIMIT 1;
    END IF;
    IF s.perfiles_ocupados >= s.perfiles_disponibles OR perfil IS NULL OR perfil > s.perfiles_disponibles OR
      EXISTS (SELECT 1 FROM public.ventas WHERE servicio_id = s.id AND perfil_numero = perfil AND estado = 'activo' AND archivado_at IS NULL)
    THEN
      UPDATE public.pedido_items SET estado = 'sin_stock' WHERE id = i.id;
      RETURN;
    END IF;
  END IF;
  fin := (inicio + make_interval(months => CASE i.ciclo_pago WHEN 'mensual' THEN 1
    WHEN 'trimestral' THEN 3 WHEN 'semestral' THEN 6 ELSE 12 END))::date;
  IF i.tipo = 'nueva' THEN
    resultado := public.create_venta_with_initial_payment(
      p_cliente_id => p.tercero_id, p_servicio_id => i.servicio_id, p_categoria_id => i.categoria_id,
      p_estado => 'activo'::public.venta_estado_enum, p_perfil_numero => perfil,
      p_perfil_nombre => NULL, p_codigo => NULL, p_notas => 'Pedido ' || p.id::text,
      p_fecha_inicio => inicio, p_fecha_fin => fin, p_ciclo_pago => i.ciclo_pago,
      p_precio_original => i.precio, p_descuento => i.descuento, p_total_original => i.total,
      p_moneda_original => p.moneda, p_total_usd => round(i.total / p.exchange_rate, 4),
      p_exchange_rate => p.exchange_rate, p_metodo_pago_id => NULL, p_metodo_pago_nombre_snapshot => 'Pedido',
      p_fecha_pago => now(), p_pago_notas => 'Pedido ' || p.id::text,
      p_plan_id => i.plan_id, p_plan_nombre_snapshot => i.plan_nombre_snapshot,
      p_plan_tipo_nombre_snapshot => i.plan_tipo_nombre_snapshot, p_created_by => auth.uid(), p_idempotency_key => i.id);
    -- trg_recalc_perfiles_ocupados updates the counter under the service lock; do not double increment.
  ELSE
    PERFORM public.create_venta_payment(
      p_venta_id => i.venta_id, p_fecha_inicio => inicio, p_fecha_fin => fin, p_ciclo_pago => i.ciclo_pago,
      p_precio_original => i.precio, p_descuento => i.descuento, p_total_original => i.total,
      p_moneda_original => p.moneda, p_total_usd => round(i.total / p.exchange_rate, 4),
      p_exchange_rate => p.exchange_rate, p_metodo_pago_id => NULL, p_metodo_pago_nombre_snapshot => 'Pedido',
      p_fecha_pago => now(), p_pago_notas => 'Pedido ' || p.id::text,
      p_plan_id => i.plan_id, p_plan_nombre_snapshot => i.plan_nombre_snapshot,
      p_plan_tipo_nombre_snapshot => i.plan_tipo_nombre_snapshot, p_created_by => auth.uid(), p_idempotency_key => i.id);
    resultado := i.venta_id;
  END IF;
  UPDATE public.pedido_items SET estado = 'aplicado', venta_id_resultante = resultado,
    perfil_numero = COALESCE(perfil, i.perfil_numero) WHERE id = i.id;
END;
$$;
REVOKE ALL ON FUNCTION public.aplicar_pedido_item(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.confirmar_pedido(
  p_pedido_id uuid, p_idempotency_key uuid, p_source text, p_monto numeric,
  p_yappy_payment_id uuid DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE p public.pedidos%ROWTYPE; y public.yappy_payments%ROWTYPE;
  v_existing text; v_paid numeric; i record;
BEGIN
  v_existing := public.pedido_intent('confirmar_pedido', p_idempotency_key);
  IF v_existing IS NOT NULL THEN
    IF v_existing IS DISTINCT FROM p_pedido_id::text THEN RAISE EXCEPTION 'pedido_key_conflict'; END IF;
    RETURN v_existing;
  END IF;
  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido_not_found'; END IF;
  IF p.estado NOT IN ('borrador','esperando_pago','pago_en_revision') OR p.expira_at <= now()
  THEN RAISE EXCEPTION 'pedido_invalid_state'; END IF;
  IF p_source IS NULL OR p_source NOT IN ('manual','yappy') OR p_monto IS NULL OR p_monto <= 0 OR
    p_monto = 'NaN'::numeric OR p_monto <> round(p_monto, 2) OR
    (p_source = 'manual' AND p_yappy_payment_id IS NOT NULL)
  THEN RAISE EXCEPTION 'pedido_invalid_payment'; END IF;
  IF p_source = 'yappy' THEN
    IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'pedido_forbidden'; END IF;
    SELECT * INTO y FROM public.yappy_payments WHERE id = p_yappy_payment_id FOR UPDATE;
    IF NOT FOUND OR y.currency <> p.moneda OR y.amount <> p_monto
    THEN RAISE EXCEPTION 'pedido_invalid_payment'; END IF;
    IF EXISTS (SELECT 1 FROM public.pedido_pagos WHERE yappy_payment_id = y.id) OR
      y.match_status IN ('registrado','descartado')
    THEN RAISE EXCEPTION 'pedido_payment_used'; END IF;
    UPDATE public.yappy_payments SET match_status = 'registrado', resolved_by = auth.uid(), resolved_at = now(),
      resolution_note = 'Pedido ' || p.id::text WHERE id = y.id;
  END IF;
  INSERT INTO public.pedido_pagos(pedido_id, source, yappy_payment_id, monto)
    VALUES (p.id, p_source, p_yappy_payment_id, p_monto);
  SELECT sum(monto) INTO v_paid FROM public.pedido_pagos WHERE pedido_id = p.id;
  IF v_paid < p.total THEN
    UPDATE public.pedidos SET estado = 'pago_en_revision' WHERE id = p.id;
  ELSE
    -- Stable service ordering limits deadlocks between multi-service orders.
    PERFORM s.id FROM public.servicios s WHERE s.id IN
      (SELECT servicio_id FROM public.pedido_items WHERE pedido_id = p.id) ORDER BY s.id FOR UPDATE;
    FOR i IN SELECT id FROM public.pedido_items WHERE pedido_id = p.id ORDER BY servicio_id, id LOOP
      PERFORM public.aplicar_pedido_item(i.id, p.id);
    END LOOP;
    UPDATE public.pedidos SET estado = CASE WHEN EXISTS
      (SELECT 1 FROM public.pedido_items WHERE pedido_id = p.id AND estado = 'sin_stock') THEN 'pagado' ELSE 'entregado' END,
      notas = CASE WHEN v_paid > p.total THEN 'Sobrepago: ' || (v_paid - p.total)::text || ' ' || p.moneda ELSE notas END
      WHERE id = p.id;
  END IF;
  INSERT INTO public.rpc_idempotency_keys(idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'confirmar_pedido', p.id::text, auth.uid());
  RETURN p.id::text;
END;
$$;

CREATE FUNCTION public.cancelar_pedido(p_pedido_id uuid, p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE p public.pedidos%ROWTYPE; v_existing text;
BEGIN
  v_existing := public.pedido_intent('cancelar_pedido', p_idempotency_key);
  IF v_existing IS NOT NULL THEN
    IF v_existing IS DISTINCT FROM p_pedido_id::text THEN RAISE EXCEPTION 'pedido_key_conflict'; END IF;
    RETURN v_existing;
  END IF;
  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido_not_found'; END IF;
  -- Paid/partially paid orders require reconciliation; never silently discard money.
  IF p.estado NOT IN ('borrador','esperando_pago','cancelado') OR
    EXISTS (SELECT 1 FROM public.pedido_pagos WHERE pedido_id = p.id)
  THEN RAISE EXCEPTION 'pedido_invalid_state'; END IF;
  UPDATE public.pedidos SET estado = 'cancelado' WHERE id = p.id;
  UPDATE public.pedido_items SET estado = 'cancelado' WHERE pedido_id = p.id;
  INSERT INTO public.rpc_idempotency_keys(idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'cancelar_pedido', p.id::text, auth.uid());
  RETURN p.id::text;
END;
$$;
CREATE FUNCTION public.expirar_pedidos() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (NOT public.is_authenticated() OR
    (SELECT private.auth_role()) IS DISTINCT FROM 'admin') THEN RAISE EXCEPTION 'pedido_forbidden'; END IF;
  WITH expired AS (
    SELECT id FROM public.pedidos WHERE estado IN ('borrador','esperando_pago') AND expira_at <= now()
      AND NOT EXISTS (SELECT 1 FROM public.pedido_pagos WHERE pedido_id = pedidos.id)
    ORDER BY id FOR UPDATE SKIP LOCKED
  ) UPDATE public.pedidos SET estado = 'expirado' WHERE id IN (SELECT id FROM expired);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_pedido(text, text, text, text, jsonb, timestamptz, numeric, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.confirmar_pedido(uuid, uuid, text, numeric, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.cancelar_pedido(uuid, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.expirar_pedidos() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.crear_pedido(text, text, text, text, jsonb, timestamptz, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pedido(uuid, uuid, text, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expirar_pedidos() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- Register the new authenticated RPC contract and tables in the existing security audit.
CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('pedidos'), ('pedido_items'), ('pedido_pagos'), ('usuarios'), ('terceros'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo')
  ),
  allowed_authenticated_security_definer(function_name) AS (
    VALUES
      ('crear_pedido'), ('confirmar_pedido'), ('cancelar_pedido'), ('expirar_pedidos'),
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments')
  ),
  required_authenticated_rpcs(function_name) AS (
    VALUES
      ('crear_pedido'), ('confirmar_pedido'), ('cancelar_pedido'), ('expirar_pedidos'),
      ('create_venta_with_initial_payment'),
      ('create_servicio_with_initial_payment'),
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments')
  ),
  public_functions AS (
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  )
  SELECT jsonb_build_object(
    'rls_disabled_app_tables',
      (
        SELECT count(*)
        FROM app_tables t
        JOIN pg_class c ON c.relname = t.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE c.relkind = 'r'
          AND c.relrowsecurity = false
      ),
    'security_definer_missing_search_path',
      (
        SELECT count(*)
        FROM public_functions
        WHERE prosecdef = true
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(COALESCE(proconfig, ARRAY[]::text[])) cfg
            WHERE cfg LIKE 'search_path=%'
          )
      ),
    'security_definer_executable_by_anon',
      (
        SELECT count(*)
        FROM public_functions
        WHERE prosecdef = true
          AND has_function_privilege('anon', oid, 'EXECUTE')
      ),
    'unapproved_security_definer_executable_by_authenticated',
      (
        SELECT count(*)
        FROM public_functions pf
        WHERE prosecdef = true
          AND has_function_privilege('authenticated', oid, 'EXECUTE')
          AND NOT EXISTS (
            SELECT 1
            FROM allowed_authenticated_security_definer allowed
            WHERE allowed.function_name = pf.proname
          )
      ),
    'required_rpc_missing_authenticated_execute',
      (
        SELECT count(*)
        FROM required_authenticated_rpcs required
        WHERE NOT EXISTS (
          SELECT 1
          FROM public_functions pf
          WHERE pf.proname = required.function_name
            AND has_function_privilege('authenticated', pf.oid, 'EXECUTE')
        )
      ),
    'required_rpc_executable_by_anon',
      (
        SELECT count(*)
        FROM required_authenticated_rpcs required
        JOIN public_functions pf ON pf.proname = required.function_name
        WHERE has_function_privilege('anon', pf.oid, 'EXECUTE')
      )
  );
$$;
