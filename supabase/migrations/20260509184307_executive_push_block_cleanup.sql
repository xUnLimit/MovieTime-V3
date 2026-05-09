-- ============================================================================
-- 20260509184307_executive_push_block_cleanup.sql
-- Reduces executive push blocks from 5 to 3:
--   keep:    clientes_por_notificar, monto_a_fondear
--   rename:  servicios_por_pagar_hoy -> servicios_por_pagar (semantics changed:
--            now counts ALL highlighted services with dias_restantes <= 0,
--            not just those due today with auto-renewal)
--   drop:    ventas_por_vencer (redundant with clientes_por_notificar)
--   drop:    monto_a_pagar_hoy (merged into monto_a_fondear, multi-currency)
--
-- The new code in src/lib/services/executivePushService.ts ignores any blocks
-- it doesn't recognize, so the system keeps working even if this migration is
-- not applied — but selected_blocks would still reference dead keys, leaving
-- the Configuration UI showing checkboxes for nonexistent blocks.
-- ============================================================================

UPDATE public.config
SET
  executive_push_selected_blocks = COALESCE(
    (
      SELECT jsonb_agg(DISTINCT mapped)
      FROM jsonb_array_elements_text(executive_push_selected_blocks) AS raw,
        LATERAL (
          SELECT CASE
            WHEN raw.value = 'servicios_por_pagar_hoy' THEN 'servicios_por_pagar'
            WHEN raw.value IN ('clientes_por_notificar', 'servicios_por_pagar', 'monto_a_fondear') THEN raw.value
            ELSE NULL
          END AS mapped
        ) AS m
      WHERE m.mapped IS NOT NULL
    ),
    '[]'::jsonb
  ),
  executive_push_block_order = COALESCE(
    (
      SELECT jsonb_agg(mapped ORDER BY ord)
      FROM jsonb_array_elements_text(executive_push_block_order) WITH ORDINALITY AS raw(value, ord),
        LATERAL (
          SELECT CASE
            WHEN raw.value = 'servicios_por_pagar_hoy' THEN 'servicios_por_pagar'
            WHEN raw.value IN ('clientes_por_notificar', 'servicios_por_pagar', 'monto_a_fondear') THEN raw.value
            ELSE NULL
          END AS mapped
        ) AS m
      WHERE m.mapped IS NOT NULL
    ),
    '[]'::jsonb
  )
WHERE id = 'global';
