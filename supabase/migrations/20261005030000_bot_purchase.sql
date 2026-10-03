-- Compra por WhatsApp (leads y clientes): reserva de perfil por plan, pedido sin tercero, creacion del
-- tercero y liberacion de reservas al confirmar el pago, y entrega verificada de credenciales.
-- Forward-only y aditiva: no cambia firmas existentes; solo reemplaza el cuerpo de
-- private.finalizar_pedido_pagado (misma firma) para llamar al paso previo atomico.

-- Ajustes editables (la UI del panel llegara despues; hasta entonces se editan por SQL). Los textos viven
-- en `mensajes` y la aplicacion completa con sus valores por defecto lo que falte.
CREATE TABLE public.compra_ajustes (
  id text PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  max_servicios integer NOT NULL DEFAULT 5 CHECK (max_servicios BETWEEN 1 AND 10),
  mensajes jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(mensajes) = 'object' AND pg_column_size(mensajes) <= 8192)
);
INSERT INTO public.compra_ajustes (id) VALUES ('global');
ALTER TABLE public.compra_ajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY compra_ajustes_admin ON public.compra_ajustes FOR ALL TO authenticated
  USING ((SELECT private.auth_role()) = 'admin' AND (SELECT public.is_authenticated()))
  WITH CHECK ((SELECT private.auth_role()) = 'admin' AND (SELECT public.is_authenticated()));
REVOKE ALL ON public.compra_ajustes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.compra_ajustes TO authenticated;
GRANT SELECT ON public.compra_ajustes TO service_role;

-- Reserva un perfil libre de cualquier cuenta del plan para el contacto. Idempotente: si el contacto ya
-- tiene una reserva vigente para ese plan, la devuelve. Sin stock devuelve cero filas.
CREATE FUNCTION public.reservar_perfil_para_plan(p_wa_id text, p_plan_id text)
RETURNS TABLE (id uuid, servicio text, perfil integer, vence timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
#variable_conflict use_column
DECLARE
  c public.whatsapp_contacts%ROWTYPE; pl public.planes%ROWTYPE; h public.reservas_perfil%ROWTYPE; s record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$' OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'purchase_invalid_input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.whatsapp_contacts WHERE wa_id = p_wa_id;
  IF NOT FOUND OR c.estado = 'bloqueado' THEN RAISE EXCEPTION 'purchase_contact_invalid' USING ERRCODE = '22023'; END IF;
  SELECT p.* INTO pl FROM public.planes p JOIN public.categorias cat ON cat.id = p.categoria_id
    JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id
    WHERE p.id = p_plan_id AND p.activo AND cat.activo AND pt.activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase_plan_invalid' USING ERRCODE = '22023'; END IF;

  SELECT r.* INTO h FROM public.reservas_perfil r JOIN public.servicios sv ON sv.id = r.servicio_id
    WHERE r.owner_ref = p_wa_id AND r.cerrada_at IS NULL AND r.expira_at > clock_timestamp()
      AND sv.categoria_id = pl.categoria_id AND sv.plan_tipo_id = pl.plan_tipo_id
    ORDER BY r.created_at, r.id LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT h.id, h.servicio_id, h.perfil_numero, h.expira_at;
    RETURN;
  END IF;
  FOR s IN SELECT sv.id AS servicio_id FROM public.servicios sv
    WHERE sv.categoria_id = pl.categoria_id AND sv.plan_tipo_id = pl.plan_tipo_id
      AND sv.activo AND NOT sv.en_reposo AND sv.cortado_at IS NULL AND sv.archivado_at IS NULL
      AND sv.perfiles_ocupados < sv.perfiles_disponibles
    ORDER BY sv.id
  LOOP
    SELECT * INTO h FROM public.reservar_perfil(s.servicio_id, p_wa_id, p_plan_id);
    IF FOUND THEN
      RETURN QUERY SELECT h.id, h.servicio_id, h.perfil_numero, h.expira_at;
      RETURN;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

-- Crea el pedido de la compra a partir de las reservas vigentes del contacto (una por plan). El precio, la
-- moneda y el ciclo salen del catalogo en SQL; el total nunca viene del cliente. El pedido vence cuando vence
-- la primera reserva. Se actua como un operador activo solo dentro de la transaccion (el bot no tiene
-- auth.uid()), igual que private.finalizar_pedido_pagado. Reintento con la misma clave: mismo pedido.
CREATE FUNCTION public.crear_pedido_compra_bot(p_wa_id text, p_plan_ids text[], p_idempotency_key uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  c public.whatsapp_contacts%ROWTYPE; a public.compra_ajustes%ROWTYPE; pl public.planes%ROWTYPE;
  h public.reservas_perfil%ROWTYPE; v_existing text; v_actor uuid; v_items jsonb := '[]'::jsonb;
  v_moneda text; v_m text; v_rate numeric; v_expira timestamptz; v_plan text; v_n integer;
  v_used uuid[] := ARRAY[]::uuid[]; v_result text;
  v_prev_sub text := current_setting('request.jwt.claim.sub', true);
  v_prev_claims text := current_setting('request.jwt.claims', true);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'purchase_key_required' USING ERRCODE = '22023'; END IF;
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'purchase_invalid_input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.whatsapp_contacts WHERE wa_id = p_wa_id;
  IF NOT FOUND OR c.estado = 'bloqueado' THEN RAISE EXCEPTION 'purchase_contact_invalid' USING ERRCODE = '22023'; END IF;
  -- Reintento: devuelve el mismo pedido solo si pertenece a este contacto.
  SELECT k.result_id INTO v_existing FROM public.rpc_idempotency_keys k
    WHERE k.rpc_name = 'crear_pedido' AND k.idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.pedidos pd WHERE pd.id = v_existing::uuid AND pd.contact_id = p_wa_id)
    THEN RAISE EXCEPTION 'purchase_key_conflict' USING ERRCODE = '22023'; END IF;
    RETURN v_existing;
  END IF;
  -- La cuenta que se crea desde el contacto debe poder resolverse de nuevo por su telefono.
  IF public.normalize_panama_wa_id(p_wa_id) IS DISTINCT FROM p_wa_id THEN
    RAISE EXCEPTION 'purchase_unsupported_number' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.compra_ajustes WHERE id = 'global';
  v_n := coalesce(cardinality(p_plan_ids), 0);
  IF v_n NOT BETWEEN 1 AND a.max_servicios OR (SELECT count(DISTINCT x) FROM unnest(p_plan_ids) x) <> v_n THEN
    RAISE EXCEPTION 'purchase_cart_invalid' USING ERRCODE = '22023';
  END IF;
  FOREACH v_plan IN ARRAY p_plan_ids LOOP
    SELECT p.* INTO pl FROM public.planes p JOIN public.categorias cat ON cat.id = p.categoria_id
      JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id
      WHERE p.id = v_plan AND p.activo AND cat.activo AND pt.activo;
    IF NOT FOUND THEN RAISE EXCEPTION 'purchase_plan_invalid' USING ERRCODE = '22023'; END IF;
    SELECT r.* INTO h FROM public.reservas_perfil r JOIN public.servicios sv ON sv.id = r.servicio_id
      WHERE r.owner_ref = p_wa_id AND r.cerrada_at IS NULL AND r.expira_at > clock_timestamp()
        AND sv.categoria_id = pl.categoria_id AND sv.plan_tipo_id = pl.plan_tipo_id AND NOT (r.id = ANY (v_used))
      ORDER BY r.created_at, r.id LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'purchase_hold_missing' USING ERRCODE = '22023'; END IF;
    v_used := v_used || h.id;
    SELECT coalesce(cp.moneda, cc.moneda, aj.moneda) INTO v_m FROM public.catalogo_ajustes aj
      LEFT JOIN public.catalogo_config cc ON cc.categoria_id = pl.categoria_id AND cc.plan_id IS NULL
      LEFT JOIN public.catalogo_config cp ON cp.categoria_id = pl.categoria_id AND cp.plan_id = pl.id;
    IF v_moneda IS NULL THEN v_moneda := v_m;
    ELSIF v_moneda IS DISTINCT FROM v_m THEN RAISE EXCEPTION 'purchase_currency_mismatch' USING ERRCODE = '22023'; END IF;
    v_expira := least(coalesce(v_expira, h.expira_at), h.expira_at);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'tipo', 'nueva', 'plan_id', pl.id, 'servicio_id', h.servicio_id, 'categoria_id', pl.categoria_id,
      'perfil_numero', h.perfil_numero, 'ciclo_pago', pl.ciclo_pago::text, 'descuento', 0));
  END LOOP;
  IF v_moneda = 'USD' THEN v_rate := 1;
  ELSE SELECT er.rate INTO v_rate FROM public.exchange_rates er WHERE er.currency_pair = 'USD_' || v_moneda; END IF;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'purchase_rate_unavailable' USING ERRCODE = '22023'; END IF;

  SELECT u.id INTO v_actor FROM public.usuarios u WHERE u.role = 'admin' AND u.active ORDER BY u.id LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'purchase_no_operator' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
  v_result := public.crear_pedido(CASE WHEN c.estado = 'cliente' THEN c.tercero_id END, p_wa_id, 'whatsapp',
    v_moneda, v_items, v_expira, v_rate, p_idempotency_key);
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_prev_sub, ''), true);
  PERFORM set_config('request.jwt.claims', coalesce(v_prev_claims, ''), true);
  RETURN v_result;
END;
$$;

-- Abandono: cancela el pedido si sigue sin pagos y libera las reservas del contacto que ningun pedido vivo
-- necesita. Nunca toca un pedido con dinero recibido ni las reservas de un pedido en espera de pago.
-- Devuelve cuantas reservas cerro.
CREATE FUNCTION public.liberar_compra_bot(p_wa_id text, p_pedido_id uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'purchase_invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_pedido_id IS NOT NULL THEN
    UPDATE public.pedidos pd SET estado = 'cancelado'
      WHERE pd.id = p_pedido_id AND pd.contact_id = p_wa_id AND pd.estado IN ('borrador', 'esperando_pago')
        AND NOT EXISTS (SELECT 1 FROM public.pedido_pagos pg WHERE pg.pedido_id = pd.id);
    IF FOUND THEN
      UPDATE public.pedido_items SET estado = 'cancelado' WHERE pedido_id = p_pedido_id AND estado = 'pendiente';
    END IF;
  END IF;
  UPDATE public.reservas_perfil r SET cerrada_at = clock_timestamp()
    WHERE r.owner_ref = p_wa_id AND r.cerrada_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.pedido_items pi JOIN public.pedidos pd ON pd.id = pi.pedido_id
        WHERE pd.contact_id = p_wa_id AND pd.estado IN ('borrador', 'esperando_pago', 'pago_en_revision')
          AND pd.expira_at > now() AND pi.estado = 'pendiente'
          AND pi.servicio_id = r.servicio_id AND pi.perfil_numero = r.perfil_numero);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Paso previo atomico de la entrega (dentro del bloque protegido de finalizar_pedido_pagado): libera las
-- reservas del pedido, resuelve o crea el tercero del contacto, lo vincula y marca los intereses como
-- convertidos. Si algo falla, finalizar revierte el bloque y el pedido queda en revision.
CREATE FUNCTION private.preparar_pedido_compra(p_pedido uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  p public.pedidos%ROWTYPE; c public.whatsapp_contacts%ROWTYPE; v_tercero text; v_matches integer; v_name text;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND OR p.canal <> 'whatsapp' OR p.contact_id IS NULL THEN RETURN; END IF;
  -- El trigger de ventas rechaza un perfil con reserva abierta: se cierra en la misma transaccion.
  UPDATE public.reservas_perfil r SET cerrada_at = clock_timestamp()
    WHERE r.owner_ref = p.contact_id AND r.cerrada_at IS NULL AND EXISTS (
      SELECT 1 FROM public.pedido_items pi WHERE pi.pedido_id = p.id AND pi.tipo = 'nueva'
        AND pi.servicio_id = r.servicio_id AND pi.perfil_numero = r.perfil_numero);
  IF p.tercero_id IS NULL THEN
    SELECT * INTO c FROM public.whatsapp_contacts WHERE wa_id = p.contact_id FOR UPDATE;
    IF NOT FOUND OR c.estado = 'bloqueado' THEN RAISE EXCEPTION 'purchase_contact_invalid'; END IF;
    v_tercero := c.tercero_id;
    IF v_tercero IS NULL THEN
      SELECT count(*), min(t.id) INTO v_matches, v_tercero FROM public.terceros t
        WHERE t.wa_id = p.contact_id AND t.active;
      IF v_matches <> 1 THEN v_tercero := NULL; END IF;
    END IF;
    IF v_tercero IS NULL THEN
      v_name := left(coalesce(nullif(btrim(c.nombre_perfil), ''), 'Cliente'), 100);
      INSERT INTO public.terceros (nombre, apellido, tipo, telefono, notas)
        VALUES (v_name, 'WhatsApp', 'cliente', p.contact_id, 'Creado por compra en WhatsApp (pedido ' || p.id::text || ')')
        RETURNING id INTO v_tercero;
    END IF;
    UPDATE public.whatsapp_contacts SET tercero_id = v_tercero, estado = 'cliente', updated_at = now()
      WHERE wa_id = p.contact_id;
    UPDATE public.pedidos SET tercero_id = v_tercero WHERE id = p.id;
  END IF;
  UPDATE public.intereses SET estado = 'convertido'
    WHERE contact_id = p.contact_id AND estado IN ('esperando', 'avisado')
      AND categoria_id IN (SELECT categoria_id FROM public.pedido_items WHERE pedido_id = p.id);
END;
$$;
REVOKE ALL ON FUNCTION private.preparar_pedido_compra(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Mismo cuerpo que 20261004010000, mas el paso previo dentro del bloque protegido (tras suplantar al operador).
CREATE OR REPLACE FUNCTION private.finalizar_pedido_pagado(p_pedido uuid, p_paid numeric) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  p public.pedidos%ROWTYPE; v_actor uuid; i record; v_ok boolean := false;
  v_prev_sub text := current_setting('request.jwt.claim.sub', true);
  v_prev_claims text := current_setting('request.jwt.claims', true);
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido;
  SELECT u.id INTO v_actor FROM public.usuarios u WHERE u.id = p.created_by AND u.active;
  IF v_actor IS NULL THEN
    SELECT u.id INTO v_actor FROM public.usuarios u WHERE u.role = 'admin' AND u.active ORDER BY u.id LIMIT 1;
  END IF;
  IF v_actor IS NULL THEN RETURN false; END IF;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
    PERFORM private.preparar_pedido_compra(p.id);
    PERFORM s.id FROM public.servicios s WHERE s.id IN
      (SELECT servicio_id FROM public.pedido_items WHERE pedido_id = p.id) ORDER BY s.id FOR UPDATE;
    FOR i IN SELECT id FROM public.pedido_items WHERE pedido_id = p.id AND estado = 'pendiente' ORDER BY servicio_id, id LOOP
      PERFORM public.aplicar_pedido_item(i.id, p.id);
    END LOOP;
    UPDATE public.pedidos SET estado = CASE WHEN EXISTS
      (SELECT 1 FROM public.pedido_items WHERE pedido_id = p.id AND estado = 'sin_stock') THEN 'pagado' ELSE 'entregado' END,
      notas = CASE WHEN p_paid > p.total THEN 'Sobrepago: ' || (p_paid - p.total)::text || ' ' || p.moneda ELSE notas END
      WHERE id = p.id;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'finalizar_pedido_pagado failed (%)', SQLSTATE;
    v_ok := false;
  END;
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_prev_sub, ''), true);
  PERFORM set_config('request.jwt.claims', coalesce(v_prev_claims, ''), true);
  RETURN v_ok;
END;
$$;

-- Datos de acceso de una venta, solo si pertenece al contacto (tercero vinculado) y nacio de un pedido pagado
-- de ese mismo contacto. Con acceso por codigo la contrasena NUNCA sale de la base de datos.
CREATE FUNCTION public.credenciales_venta_bot(p_wa_id text, p_venta_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_row jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$' OR p_venta_id IS NULL OR length(p_venta_id) > 64 THEN
    RAISE EXCEPTION 'purchase_invalid_input' USING ERRCODE = '22023';
  END IF;
  SELECT jsonb_build_object(
    'venta_id', v.id, 'servicio_id', s.id, 'servicio', s.nombre, 'categoria', cat.nombre,
    'correo', s.correo, 'perfil', v.perfil_nombre, 'pin', v.codigo,
    'acceso_por_codigo', s.acceso_por_codigo, 'proveedor_codigo', cat.code_provider,
    'contrasena', CASE WHEN s.acceso_por_codigo THEN NULL ELSE s.contrasena END)
  INTO v_row
  FROM public.ventas v
  JOIN public.servicios s ON s.id = v.servicio_id
  JOIN public.categorias cat ON cat.id = v.categoria_id
  JOIN public.whatsapp_contacts wc ON wc.wa_id = p_wa_id AND wc.tercero_id = v.cliente_id AND wc.estado = 'cliente'
  WHERE v.id = p_venta_id AND v.estado = 'activo' AND v.archivado_at IS NULL AND v.cortada_at IS NULL
    AND s.activo AND s.archivado_at IS NULL AND s.cortado_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.pedido_items pi JOIN public.pedidos pd ON pd.id = pi.pedido_id
      WHERE pi.venta_id_resultante = v.id AND pi.estado = 'aplicado'
        AND pd.estado IN ('pagado', 'entregado') AND pd.contact_id = p_wa_id);
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.obtener_ajustes_compra_bot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object('max_servicios', a.max_servicios, 'mensajes', a.mensajes)
    FROM public.compra_ajustes a WHERE a.id = 'global');
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_perfil_para_plan(text, text), public.crear_pedido_compra_bot(text, text[], uuid),
  public.liberar_compra_bot(text, uuid), public.credenciales_venta_bot(text, text), public.obtener_ajustes_compra_bot()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reservar_perfil_para_plan(text, text), public.crear_pedido_compra_bot(text, text[], uuid),
  public.liberar_compra_bot(text, uuid), public.credenciales_venta_bot(text, text), public.obtener_ajustes_compra_bot() TO service_role;
NOTIFY pgrst, 'reload schema';
