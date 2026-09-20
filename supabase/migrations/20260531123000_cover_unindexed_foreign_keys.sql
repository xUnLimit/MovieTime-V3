-- ============================================================================
-- Cover the two remaining unindexed foreign keys flagged by the linter
-- (0001_unindexed_foreign_keys). Without a covering index, deletes on the
-- referenced parent row force a sequential scan of the child table to enforce
-- ON DELETE SET NULL. Low impact at current volume, added for consistency with
-- the rest of the schema (every other FK is already covered).
--
--   config.executive_push_updated_by      -> usuarios(id)      ON DELETE SET NULL
--   notificaciones_venta.metodo_pago_id    -> metodos_pago(id)  ON DELETE SET NULL
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_config_executive_push_updated_by
  ON public.config (executive_push_updated_by);

-- The notification payment-method column was introduced later in the historical
-- migration chain (20260823150000). Existing environments already had it when
-- this index migration was created, but a clean replay does not. Only create
-- the index here when the column is present; the later migration creates the
-- same index after adding the column for clean databases.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notificaciones_venta'
      AND column_name = 'metodo_pago_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_notificaciones_venta_metodo_pago_id
      ON public.notificaciones_venta (metodo_pago_id);
  END IF;
END;
$$;
