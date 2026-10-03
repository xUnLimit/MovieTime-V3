-- Ajustes editables del flujo de pago por WhatsApp y recordatorio unico de pedidos abandonados.
-- Aditiva/expand: columnas nuevas con valores por defecto y funciones nuevas solo para service_role.
-- Sin tablas nuevas: pedido_pago_ajustes y pedidos ya estan cubiertas por la auditoria de seguridad.

ALTER TABLE public.pedido_pago_ajustes
  ADD COLUMN yappy_destino text CHECK (yappy_destino IS NULL OR char_length(btrim(yappy_destino)) BETWEEN 1 AND 120),
  ADD COLUMN mensajes_pago jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(mensajes_pago) = 'object' AND pg_column_size(mensajes_pago) <= 16384),
  ADD COLUMN recordatorio_activo boolean NOT NULL DEFAULT true,
  ADD COLUMN recordatorio_horas integer NOT NULL DEFAULT 2 CHECK (recordatorio_horas BETWEEN 1 AND 168);

-- Un solo recordatorio por pedido: la reclamacion fija estado y fecha de forma atomica.
ALTER TABLE public.pedidos
  ADD COLUMN recordatorio_estado text CHECK (recordatorio_estado IS NULL
    OR recordatorio_estado IN ('pendiente','enviado','fallido')),
  ADD COLUMN recordatorio_at timestamptz,
  ADD COLUMN recordatorio_motivo text CHECK (recordatorio_motivo IS NULL OR char_length(recordatorio_motivo) <= 80);
CREATE INDEX pedidos_recordatorio_idx ON public.pedidos(updated_at)
  WHERE canal = 'whatsapp' AND recordatorio_estado IS NULL AND estado IN ('borrador','esperando_pago');

-- Ajustes que necesita el bot (destino de Yappy, textos y recordatorio). Solo service_role.
CREATE FUNCTION public.obtener_ajustes_pago_bot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE a public.pedido_pago_ajustes%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO a FROM public.pedido_pago_ajustes WHERE id = 'global';
  RETURN jsonb_build_object('yappy_destino', a.yappy_destino, 'mensajes', a.mensajes_pago,
    'recordatorio_activo', a.recordatorio_activo, 'recordatorio_horas', a.recordatorio_horas);
END;
$$;
REVOKE ALL ON FUNCTION public.obtener_ajustes_pago_bot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_ajustes_pago_bot() TO service_role;

-- Pedido y monto pagado para que el bot compruebe pertenencia y estado. Devuelve NULL si no existe.
CREATE FUNCTION public.obtener_pedido_para_bot(p_pedido_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE p public.pedidos%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', p.id, 'tercero_id', p.tercero_id, 'contact_id', p.contact_id,
    'moneda', p.moneda, 'total', p.total, 'estado', p.estado, 'expira_at', p.expira_at,
    'pagado', (SELECT coalesce(sum(monto), 0) FROM public.pedido_pagos WHERE pedido_id = p.id));
END;
$$;
REVOKE ALL ON FUNCTION public.obtener_pedido_para_bot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_pedido_para_bot(uuid) TO service_role;

-- Reclama pedidos abandonados (borrador o pago pendiente, sin actividad desde hace recordatorio_horas).
-- Es at-most-once: el pedido queda marcado 'pendiente' dentro de la misma transaccion y no vuelve a salir.
CREATE FUNCTION public.reclamar_recordatorios_pedido(p_limit integer DEFAULT 50)
RETURNS TABLE(pedido_id uuid, wa_id text, total numeric, moneda text, expira_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE a public.pedido_pago_ajustes%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO a FROM public.pedido_pago_ajustes WHERE id = 'global';
  IF NOT a.recordatorio_activo THEN RETURN; END IF;
  RETURN QUERY
  WITH due AS (
    SELECT pd.id FROM public.pedidos pd
    WHERE pd.canal = 'whatsapp' AND pd.recordatorio_estado IS NULL AND pd.contact_id IS NOT NULL
      AND pd.estado IN ('borrador','esperando_pago') AND pd.expira_at > now() AND pd.total > 0
      AND pd.updated_at <= now() - make_interval(hours => a.recordatorio_horas)
    ORDER BY pd.updated_at
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
    FOR UPDATE SKIP LOCKED
  ), marked AS (
    UPDATE public.pedidos pd SET recordatorio_estado = 'pendiente', recordatorio_at = now()
    FROM due WHERE pd.id = due.id
    RETURNING pd.id, pd.contact_id, pd.total, pd.moneda, pd.expira_at
  )
  SELECT m.id, m.contact_id, m.total, m.moneda, m.expira_at FROM marked m;
END;
$$;
REVOKE ALL ON FUNCTION public.reclamar_recordatorios_pedido(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reclamar_recordatorios_pedido(integer) TO service_role;

-- Cierra un recordatorio reclamado. Solo transiciona desde 'pendiente'; devuelve si cambio algo.
CREATE FUNCTION public.cerrar_recordatorio_pedido(p_pedido_id uuid, p_estado text, p_motivo text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_estado NOT IN ('enviado','fallido') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.pedidos SET recordatorio_estado = p_estado, recordatorio_motivo = left(p_motivo, 80)
    WHERE id = p_pedido_id AND recordatorio_estado = 'pendiente';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.cerrar_recordatorio_pedido(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_recordatorio_pedido(uuid, text, text) TO service_role;
