-- Conciliacion de pagos de pedidos por codigo de confirmacion Yappy (el telefono no es la llave).
-- Solo una fila de yappy_payments (correo IMAP) confirma un pago; la imagen del comprobante es una pista.
-- Forward-only/aditiva: no se cambian firmas existentes salvo ingest_yappy_payment (mismo contrato).

-- Parametros editables por el administrador.
CREATE TABLE public.pedido_pago_ajustes (
  id text PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  tolerancia numeric(12,2) NOT NULL DEFAULT 0.01 CHECK (tolerancia >= 0 AND tolerancia <= 5),
  ventana_horas integer NOT NULL DEFAULT 72 CHECK (ventana_horas BETWEEN 1 AND 720),
  max_intentos integer NOT NULL DEFAULT 5 CHECK (max_intentos BETWEEN 1 AND 50),
  margen_minutos integer NOT NULL DEFAULT 30 CHECK (margen_minutos BETWEEN 0 AND 1440),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.pedido_pago_ajustes (id) VALUES ('global');
CREATE TRIGGER pedido_pago_ajustes_updated_at BEFORE UPDATE ON public.pedido_pago_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Registro de intentos (tambien sirve de cola de comprobantes en espera del correo y de ledger idempotente).
CREATE TABLE public.intentos_comprobante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id),
  wa_id text CHECK (wa_id IS NULL OR char_length(wa_id) <= 64),
  codigo text NOT NULL CHECK (char_length(codigo) <= 64),
  resultado text NOT NULL CHECK (resultado IN ('confirmado','monto_menor','monto_mayor','codigo_usado',
    'no_encontrado','fuera_de_ventana','pedido_invalido','intentos_excedidos')),
  pendiente boolean NOT NULL DEFAULT false,
  reintento boolean NOT NULL DEFAULT false,
  idempotency_key uuid NOT NULL UNIQUE,
  respuesta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX intentos_comprobante_pedido_idx ON public.intentos_comprobante(pedido_id, created_at DESC);
CREATE INDEX intentos_comprobante_wa_idx ON public.intentos_comprobante(wa_id, created_at DESC) WHERE wa_id IS NOT NULL;
CREATE INDEX intentos_comprobante_pendiente_idx ON public.intentos_comprobante(created_at) WHERE pendiente;

-- Marca aditiva para /pagos-yappy: casos que el operador debe revisar a mano.
ALTER TABLE public.yappy_payments
  ADD COLUMN requiere_revision boolean NOT NULL DEFAULT false,
  ADD COLUMN revision_pedido_id uuid REFERENCES public.pedidos(id),
  ADD COLUMN revision_motivo text CHECK (revision_motivo IS NULL OR char_length(revision_motivo) <= 200);
CREATE INDEX idx_yappy_payments_revision ON public.yappy_payments(paid_at DESC) WHERE requiere_revision;

ALTER TABLE public.pedido_pago_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos_comprobante ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedido_pago_ajustes_admin ON public.pedido_pago_ajustes FOR ALL TO authenticated
  USING ((SELECT private.auth_role()) = 'admin') WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY intentos_comprobante_admin_read ON public.intentos_comprobante FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY intentos_comprobante_service ON public.intentos_comprobante FOR ALL TO service_role
  USING (true) WITH CHECK (true);
REVOKE ALL ON public.pedido_pago_ajustes, public.intentos_comprobante
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.pedido_pago_ajustes TO authenticated;
GRANT SELECT ON public.pedido_pago_ajustes TO service_role;
GRANT SELECT ON public.intentos_comprobante TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.intentos_comprobante TO service_role;

-- Cierra un intento: lo registra (salvo reintentos que siguen sin correo) y devuelve la respuesta.
CREATE FUNCTION private.cerrar_intento_comprobante(
  p_key uuid, p_pedido uuid, p_wa text, p_code text, p_resultado text,
  p_pendiente boolean, p_reintento boolean, p_respuesta jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_pedido IS NULL THEN RETURN p_respuesta; END IF;
  IF NOT (p_reintento AND p_resultado = 'no_encontrado') THEN
    INSERT INTO public.intentos_comprobante(pedido_id, wa_id, codigo, resultado, pendiente, reintento, idempotency_key, respuesta)
    VALUES (p_pedido, left(p_wa, 64), left(p_code, 64), p_resultado, p_pendiente, p_reintento, p_key, p_respuesta);
  END IF;
  IF NOT p_pendiente THEN
    UPDATE public.intentos_comprobante SET pendiente = false
      WHERE pedido_id = p_pedido AND codigo = left(p_code, 64) AND pendiente;
  END IF;
  RETURN p_respuesta;
END;
$$;
REVOKE ALL ON FUNCTION private.cerrar_intento_comprobante(uuid, uuid, text, text, text, boolean, boolean, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Aplica los items de un pedido cubierto. El bot corre como service_role (sin auth.uid): se actua como
-- quien creo el pedido (o un administrador activo) solo dentro de la transaccion. Devuelve false si la
-- entrega automatica falla; el cobro queda registrado y el operador resuelve.
CREATE FUNCTION private.finalizar_pedido_pagado(p_pedido uuid, p_paid numeric) RETURNS boolean
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
REVOKE ALL ON FUNCTION private.finalizar_pedido_pagado(uuid, numeric) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.reclamar_pago_yappy_para_pedido(
  p_pedido_id uuid, p_confirmation_code text, p_idempotency_key uuid,
  p_wa_id text DEFAULT NULL, p_reintento boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  p public.pedidos%ROWTYPE; y public.yappy_payments%ROWTYPE; a public.pedido_pago_ajustes%ROWTYPE;
  v_code text; v_prev jsonb; v_paid_before numeric; v_paid numeric; v_falta numeric; v_diff numeric;
  v_attempts integer; v_res text; v_ok boolean; v_json jsonb; v_motivo text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'pedido_key_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('reclamar:' || p_idempotency_key::text, 0));
  SELECT respuesta INTO v_prev FROM public.intentos_comprobante WHERE idempotency_key = p_idempotency_key;
  IF v_prev IS NOT NULL THEN RETURN v_prev; END IF;
  SELECT * INTO a FROM public.pedido_pago_ajustes WHERE id = 'global';
  v_code := upper(regexp_replace(btrim(coalesce(p_confirmation_code, '')), '\s+', '', 'g'));

  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resultado', 'pedido_invalido', 'confirmado', false);
  END IF;
  SELECT coalesce(sum(monto), 0) INTO v_paid_before FROM public.pedido_pagos WHERE pedido_id = p.id;
  v_json := jsonb_build_object('resultado', 'pedido_invalido', 'confirmado', false, 'pedido_estado', p.estado,
    'total', p.total, 'pagado', v_paid_before, 'faltante', greatest(p.total - v_paid_before, 0));

  -- Un codigo ya aplicado a este mismo pedido es un reintento del cliente: estado actual, sin duplicar.
  SELECT y2.* INTO y FROM public.yappy_payments y2 WHERE y2.confirmation_code = v_code;
  IF FOUND AND EXISTS (SELECT 1 FROM public.pedido_pagos WHERE yappy_payment_id = y.id AND pedido_id = p.id) THEN
    v_res := CASE WHEN p.estado IN ('pagado','entregado') THEN 'confirmado' ELSE 'monto_menor' END;
    RETURN private.cerrar_intento_comprobante(p_idempotency_key, p.id, p_wa_id, v_code, v_res, false, p_reintento,
      v_json || jsonb_build_object('resultado', v_res, 'confirmado', v_res = 'confirmado',
        'yappy_payment_id', y.id));
  END IF;

  IF p.estado NOT IN ('borrador','esperando_pago','pago_en_revision') OR p.expira_at <= now() THEN
    RETURN private.cerrar_intento_comprobante(p_idempotency_key, p.id, p_wa_id, v_code, 'pedido_invalido', false,
      p_reintento, v_json);
  END IF;

  -- Guardia contra adivinar codigos: solo intentos de clientes (no reintentos del sync) que no hallaron un pago.
  IF NOT p_reintento THEN
    SELECT count(*) INTO v_attempts FROM public.intentos_comprobante ic
      WHERE NOT ic.reintento AND ic.resultado IN ('no_encontrado','codigo_usado','fuera_de_ventana')
        AND ic.created_at > now() - make_interval(hours => a.ventana_horas)
        AND (ic.pedido_id = p.id OR (p_wa_id IS NOT NULL AND ic.wa_id = p_wa_id));
    IF v_attempts >= a.max_intentos THEN
      IF NOT EXISTS (SELECT 1 FROM public.intentos_comprobante ic WHERE ic.pedido_id = p.id
        AND ic.resultado = 'intentos_excedidos' AND ic.created_at > now() - make_interval(hours => a.ventana_horas)) THEN
        PERFORM public.emit_domain_event('pedido.pago_en_revision', 'pedido', p.id::text,
          jsonb_build_object('pedido_id', p.id, 'motivo', 'intentos_excedidos',
            'faltante', greatest(p.total - v_paid_before, 0)));
      END IF;
      RETURN private.cerrar_intento_comprobante(p_idempotency_key, p.id, p_wa_id, v_code, 'intentos_excedidos', false,
        false, v_json || jsonb_build_object('resultado', 'intentos_excedidos'));
    END IF;
  END IF;

  IF v_code !~ '^[A-Z0-9]{1,24}-[A-Z0-9]{1,24}$' OR y.id IS NULL OR y.match_status = 'descartado' THEN
    -- El correo puede no haber llegado: queda pendiente para reintentar tras la sincronizacion.
    RETURN private.cerrar_intento_comprobante(p_idempotency_key, p.id, p_wa_id, left(v_code, 64), 'no_encontrado',
      v_code ~ '^[A-Z0-9]{1,24}-[A-Z0-9]{1,24}$' AND y.id IS NULL, p_reintento,
      v_json || jsonb_build_object('resultado', 'no_encontrado'));
  END IF;

  SELECT * INTO y FROM public.yappy_payments WHERE id = y.id FOR UPDATE;
  IF y.match_status IN ('registrado','descartado') OR EXISTS
    (SELECT 1 FROM public.pedido_pagos WHERE yappy_payment_id = y.id) THEN
    RETURN private.cerrar_intento_comprobante(p_idempotency_key, p.id, p_wa_id, v_code, 'codigo_usado', false,
      p_reintento, v_json || jsonb_build_object('resultado', 'codigo_usado'));
  END IF;
  IF y.currency <> p.moneda THEN
    RETURN private.cerrar_intento_comprobante(p_idempotency_key, p.id, p_wa_id, v_code, 'pedido_invalido', false,
      p_reintento, v_json);
  END IF;

  IF y.paid_at < p.created_at - make_interval(mins => a.margen_minutos)
    OR y.paid_at < now() - make_interval(hours => a.ventana_horas) THEN
    UPDATE public.yappy_payments SET requiere_revision = true, revision_pedido_id = p.id,
      revision_motivo = 'fuera_de_ventana' WHERE id = y.id;
    RETURN private.cerrar_intento_comprobante(p_idempotency_key, p.id, p_wa_id, v_code, 'fuera_de_ventana', false,
      p_reintento, v_json || jsonb_build_object('resultado', 'fuera_de_ventana'));
  END IF;

  v_falta := greatest(p.total - v_paid_before, 0);
  v_diff := y.amount - v_falta;
  v_paid := v_paid_before + y.amount;
  INSERT INTO public.pedido_pagos(pedido_id, source, yappy_payment_id, monto) VALUES (p.id, 'yappy', y.id, y.amount);
  v_res := CASE WHEN v_diff < -a.tolerancia THEN 'monto_menor' WHEN v_diff > a.tolerancia THEN 'monto_mayor'
    ELSE 'confirmado' END;
  v_ok := false;
  IF v_res <> 'monto_menor' THEN
    v_ok := private.finalizar_pedido_pagado(p.id, v_paid);
  END IF;
  v_motivo := CASE WHEN v_res = 'monto_menor' THEN 'monto_menor'
    WHEN v_res = 'monto_mayor' THEN 'monto_mayor'
    WHEN NOT v_ok THEN 'entrega_fallida' END;
  IF NOT v_ok THEN
    UPDATE public.pedidos SET estado = 'pago_en_revision' WHERE id = p.id;
  END IF;
  UPDATE public.yappy_payments SET match_status = 'registrado', resolved_at = now(),
    resolution_note = 'Pedido ' || p.id::text, requiere_revision = v_motivo IS NOT NULL,
    revision_pedido_id = p.id, revision_motivo = v_motivo WHERE id = y.id;
  SELECT estado INTO p.estado FROM public.pedidos WHERE id = p.id;
  v_json := jsonb_build_object('resultado', v_res, 'confirmado', v_ok, 'pedido_estado', p.estado,
    'total', p.total, 'pagado', v_paid, 'faltante', greatest(p.total - v_paid, 0),
    'yappy_payment_id', y.id, 'entrega_pendiente', v_res <> 'monto_menor' AND NOT v_ok);
  PERFORM public.emit_domain_event('pedido.pago_reclamado', 'pedido', p.id::text, jsonb_build_object(
    'pedido_id', p.id, 'payment_id', y.id, 'resultado', v_res, 'monto', y.amount,
    'faltante', greatest(p.total - v_paid, 0), 'estado', p.estado));
  IF p.estado = 'pago_en_revision' THEN
    PERFORM public.emit_domain_event('pedido.pago_en_revision', 'pedido', p.id::text, jsonb_build_object(
      'pedido_id', p.id, 'motivo', coalesce(v_motivo, v_res), 'faltante', greatest(p.total - v_paid, 0)));
  END IF;
  RETURN private.cerrar_intento_comprobante(p_idempotency_key, p.id, p_wa_id, v_code, v_res, false, p_reintento, v_json);
END;
$$;
REVOKE ALL ON FUNCTION public.reclamar_pago_yappy_para_pedido(uuid, text, uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reclamar_pago_yappy_para_pedido(uuid, text, uuid, text, boolean) TO service_role;

-- Comprobantes a la espera del correo, para reintentar tras cada sincronizacion Yappy.
CREATE FUNCTION public.listar_comprobantes_pendientes(p_limit integer DEFAULT 50)
RETURNS TABLE(pedido_id uuid, wa_id text, codigo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (ic.pedido_id, ic.codigo) ic.pedido_id, ic.wa_id, ic.codigo
  FROM public.intentos_comprobante ic
  JOIN public.pedidos pd ON pd.id = ic.pedido_id
  CROSS JOIN public.pedido_pago_ajustes a
  WHERE ic.pendiente AND pd.estado IN ('borrador','esperando_pago','pago_en_revision') AND pd.expira_at > now()
    AND ic.created_at > now() - make_interval(hours => a.ventana_horas)
  ORDER BY ic.pedido_id, ic.codigo, ic.created_at
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 200);
END;
$$;
REVOKE ALL ON FUNCTION public.listar_comprobantes_pendientes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_comprobantes_pendientes(integer) TO service_role;

-- El Yappy de un cliente que paga desde otro telefono tambien debe quedar guardado cuando hay un pedido
-- abierto reciente; antes se ignoraba por no coincidir con ningun cliente activo. Mismo contrato.
CREATE OR REPLACE FUNCTION public.ingest_yappy_payment(
  p_uid_validity bigint, p_imap_uid bigint, p_internet_message_id text,
  p_received_at timestamptz, p_subject text, p_dmarc_pass boolean,
  p_parser_version integer, p_confirmation_code text, p_amount numeric,
  p_payer_name_short text, p_payer_phone_last4 text, p_paid_at timestamptz,
  p_reject_reason text DEFAULT NULL
) RETURNS TABLE(outcome text, payment_id uuid, match_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_mail_id uuid; v_payment_id uuid; v_status text;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_uid_validity <= 0 OR p_imap_uid <= 0 OR p_payer_phone_last4 !~ '^[0-9]{4}$'
    OR p_amount <= 0 OR p_confirmation_code IS NULL OR btrim(p_confirmation_code) = ''
  THEN RAISE EXCEPTION 'invalid payment input'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.terceros t
    JOIN public.ventas v ON v.cliente_id = t.id
    WHERE t.active AND v.estado = 'activo'
      AND right(regexp_replace(t.telefono, '[^0-9]', '', 'g'), 4) = p_payer_phone_last4
  ) AND NOT EXISTS (
    SELECT 1 FROM public.pedidos pd CROSS JOIN public.pedido_pago_ajustes a
    WHERE pd.estado IN ('borrador','esperando_pago','pago_en_revision')
      AND pd.created_at > now() - make_interval(hours => a.ventana_horas)
  ) THEN
    RETURN QUERY SELECT 'ignorado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  SELECT m.id INTO v_mail_id FROM public.yappy_mail_messages m
    WHERE m.uid_validity = p_uid_validity AND m.imap_uid = p_imap_uid;
  IF v_mail_id IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  INSERT INTO public.yappy_mail_messages(uid_validity, imap_uid, internet_message_id,
    received_at, from_address, subject, dmarc_pass, parser_version, status, failure_reason)
  VALUES (p_uid_validity, p_imap_uid, p_internet_message_id, p_received_at,
    'notificaciones@yappy.com.pa', p_subject, p_dmarc_pass, p_parser_version,
    CASE WHEN p_reject_reason IS NULL THEN 'extraido'
      WHEN p_reject_reason = 'dmarc_failed' THEN 'invalido' ELSE 'descartado' END, p_reject_reason)
  RETURNING id INTO v_mail_id;
  IF p_reject_reason IS NOT NULL THEN
    RETURN QUERY SELECT 'nuevo'::text, NULL::uuid,
      CASE WHEN p_reject_reason = 'dmarc_failed' THEN 'invalido' ELSE 'descartado' END::text;
    RETURN;
  END IF;
  INSERT INTO public.yappy_payments(confirmation_code, amount, payer_name_short,
    payer_phone_last4, paid_at, mail_message_id)
  VALUES (upper(btrim(p_confirmation_code)), p_amount, p_payer_name_short,
    p_payer_phone_last4, p_paid_at, v_mail_id)
  ON CONFLICT (confirmation_code) DO NOTHING RETURNING id INTO v_payment_id;
  IF v_payment_id IS NULL THEN
    UPDATE public.yappy_mail_messages SET status = 'duplicado',
      failure_reason = 'confirmation_code_exists' WHERE id = v_mail_id;
    RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  v_status := public.match_yappy_payment(v_payment_id);
  RETURN QUERY SELECT 'nuevo'::text, v_payment_id, v_status;
END;
$$;

NOTIFY pgrst, 'reload schema';
