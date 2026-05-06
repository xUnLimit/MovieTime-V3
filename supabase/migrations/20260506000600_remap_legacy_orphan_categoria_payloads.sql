BEGIN;

WITH mapped_orphans AS (
  SELECT
    lor.id,
    map.new_id::text AS categoria_id
  FROM public.legacy_orphan_records lor
  JOIN public.uuid_id_map map
    ON map.entity_name = 'categorias'
   AND map.old_id = NULLIF(lor.payload ->> 'categoriaId', '')
  WHERE lor.payload ? 'categoriaId'
    AND lor.payload ->> 'categoriaId' <> map.new_id::text
)
UPDATE public.legacy_orphan_records lor
SET payload = jsonb_set(lor.payload, '{categoriaId}', to_jsonb(mapped_orphans.categoria_id), false)
FROM mapped_orphans
WHERE lor.id = mapped_orphans.id;

SELECT public.rebuild_dashboard_financial_stats();

COMMIT;
