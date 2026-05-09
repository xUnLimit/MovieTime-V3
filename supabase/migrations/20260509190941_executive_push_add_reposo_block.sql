-- ============================================================================
-- 20260509190941_executive_push_add_reposo_block.sql
-- Adds 'reposo_terminado' to the executive push selected_blocks and block_order
-- so admins receive a count of services whose reposo period has ended and have
-- not been reactivated yet (filtered by leida=false AND dias_restantes <= 0,
-- consistent with the other blocks).
--
-- Inserted right after 'servicios_por_pagar' in block_order to keep services-
-- related counts grouped together visually.
-- ============================================================================

UPDATE public.config
SET
  executive_push_selected_blocks =
    CASE
      WHEN executive_push_selected_blocks ? 'reposo_terminado' THEN executive_push_selected_blocks
      ELSE COALESCE(executive_push_selected_blocks, '[]'::jsonb) || '"reposo_terminado"'::jsonb
    END,
  executive_push_block_order =
    CASE
      WHEN executive_push_block_order ? 'reposo_terminado' THEN executive_push_block_order
      ELSE (
        SELECT COALESCE(jsonb_agg(value ORDER BY ord), '[]'::jsonb)
        FROM (
          SELECT value, ord, false AS sentinel
          FROM jsonb_array_elements_text(executive_push_block_order) WITH ORDINALITY AS t(value, ord)
          UNION ALL
          SELECT 'reposo_terminado',
            COALESCE(
              (
                SELECT ord + 0.5
                FROM jsonb_array_elements_text(executive_push_block_order) WITH ORDINALITY AS s(value, ord)
                WHERE s.value = 'servicios_por_pagar'
                LIMIT 1
              ),
              999
            ) AS ord,
            true AS sentinel
        ) merged
      )
    END
WHERE id = 'global';
