-- ============================================================================
-- 20260510000600_post_review_hardening.sql
--
-- Hardening posterior al review:
--   * eliminar public.auth_role(), reemplazada por private.auth_role()
--   * quitar vault del search_path de trigger_executive_push()
--   * validar allowlist de bloques JSONB de executive push
--   * agregar indice compuesto para consultas por usuario + estado
-- ============================================================================

DROP FUNCTION IF EXISTS public.auth_role();

CREATE OR REPLACE FUNCTION public.trigger_executive_push()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret     text;
  v_url        text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'executive_push_cron_secret'
  LIMIT 1;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'executive_push_daily_url'
  LIMIT 1;

  IF v_secret IS NULL OR v_url IS NULL THEN
    RAISE EXCEPTION 'executive_push secrets not configured in vault. Run vault.create_secret for executive_push_cron_secret and executive_push_daily_url.';
  END IF;

  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    ),
    body                  := '{}'::jsonb,
    timeout_milliseconds  := 240000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_executive_push() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_executive_push() FROM anon, authenticated;

UPDATE public.config
SET
  executive_push_selected_blocks = COALESCE(
    (
      SELECT jsonb_agg(block.value ORDER BY block.ord)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(executive_push_selected_blocks) = 'array'
            THEN executive_push_selected_blocks
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS block(value, ord)
      WHERE block.value IN (
        'clientes_por_notificar',
        'servicios_por_pagar',
        'reposo_terminado',
        'monto_a_fondear'
      )
    ),
    '[]'::jsonb
  ),
  executive_push_block_order = COALESCE(
    (
      SELECT jsonb_agg(block.value ORDER BY block.ord)
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(executive_push_block_order) = 'array'
            THEN executive_push_block_order
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS block(value, ord)
      WHERE block.value IN (
        'clientes_por_notificar',
        'servicios_por_pagar',
        'reposo_terminado',
        'monto_a_fondear'
      )
    ),
    '[]'::jsonb
  );

ALTER TABLE public.config
  DROP CONSTRAINT IF EXISTS config_executive_push_selected_blocks_valid,
  DROP CONSTRAINT IF EXISTS config_executive_push_block_order_valid;

ALTER TABLE public.config
  ADD CONSTRAINT config_executive_push_selected_blocks_valid
  CHECK (
    jsonb_typeof(executive_push_selected_blocks) = 'array'
    AND executive_push_selected_blocks <@ '[
      "clientes_por_notificar",
      "servicios_por_pagar",
      "reposo_terminado",
      "monto_a_fondear"
    ]'::jsonb
  ),
  ADD CONSTRAINT config_executive_push_block_order_valid
  CHECK (
    jsonb_typeof(executive_push_block_order) = 'array'
    AND executive_push_block_order <@ '[
      "clientes_por_notificar",
      "servicios_por_pagar",
      "reposo_terminado",
      "monto_a_fondear"
    ]'::jsonb
  );

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_enabled
  ON public.push_subscriptions(user_id, enabled);

CREATE OR REPLACE VIEW public.v_venta_periodos_full
WITH (security_invoker = true)
AS
SELECT
  vp.id,
  vp.venta_id,
  vp.numero_periodo,
  vp.tipo,
  vp.fecha_inicio,
  vp.fecha_fin,
  vp.ciclo_pago,
  vp.plan_id,
  vp.plan_nombre_snapshot,
  vp.plan_tipo_nombre_snapshot,
  vp.precio_original,
  vp.descuento,
  vp.total_original,
  vp.moneda_original,
  vp.total_usd,
  vp.exchange_rate,
  vp.created_at,
  vp.created_by,
  COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) AS pagado_usd,
  COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'reembolsado'), 0) AS reembolsado_usd,
  vp.total_usd
    - COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0)
    + COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'reembolsado'), 0)
    AS saldo_usd,
  CASE
    WHEN COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) = 0
      THEN 'pendiente'
    WHEN COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) < vp.total_usd
      THEN 'parcial'
    WHEN COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) = vp.total_usd
      THEN 'pagado'
    ELSE 'sobrepagado'
  END AS estado_pago
FROM public.venta_periodos vp
LEFT JOIN public.pagos_venta pv ON pv.venta_periodo_id = vp.id
GROUP BY vp.id;

CREATE OR REPLACE VIEW public.v_servicio_periodos_full
WITH (security_invoker = true)
AS
SELECT
  sp.id,
  sp.servicio_id,
  sp.numero_periodo,
  sp.tipo,
  sp.fecha_inicio,
  sp.fecha_vencimiento,
  sp.ciclo_pago,
  sp.costo_original,
  sp.moneda_original,
  sp.costo_usd,
  sp.exchange_rate,
  sp.renovacion_automatica,
  sp.created_at,
  sp.created_by,
  COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) AS pagado_usd,
  COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'reembolsado'), 0) AS reembolsado_usd,
  sp.costo_usd
    - COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0)
    + COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'reembolsado'), 0)
    AS saldo_usd,
  CASE
    WHEN COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) = 0
      THEN 'pendiente'
    WHEN COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) < sp.costo_usd
      THEN 'parcial'
    WHEN COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) = sp.costo_usd
      THEN 'pagado'
    ELSE 'sobrepagado'
  END AS estado_pago
FROM public.servicio_periodos sp
LEFT JOIN public.pagos_servicio ps ON ps.servicio_periodo_id = sp.id
GROUP BY sp.id;
