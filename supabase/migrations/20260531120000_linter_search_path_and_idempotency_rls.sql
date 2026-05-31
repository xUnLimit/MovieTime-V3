-- ============================================================================
-- Linter follow-up: fix two outstanding advisories.
--
-- 1. Mutable search_path on the idempotent overloads of
--    create_venta_with_initial_payment / create_servicio_with_initial_payment.
--    The original overloads already pin `search_path = public, pg_catalog`,
--    but the `p_idempotency_key` overloads added in
--    20260523183000_rpc_idempotency_keys.sql were created without it. These are
--    SECURITY INVOKER functions; we only pin the search_path, we do not change
--    the security mode.
--
-- 2. rpc_idempotency_keys RLS policies call auth.uid() per-row. Wrap them in
--    (select auth.uid()) so the planner evaluates them once (initplan).
-- ============================================================================

-- 1. Pin search_path on the idempotent overloads ----------------------------

ALTER FUNCTION public.create_venta_with_initial_payment(
  TEXT, TEXT, TEXT, venta_estado_enum, INTEGER, TEXT, TEXT, TEXT, DATE, DATE,
  ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT,
  TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) SET search_path = public, pg_catalog;

ALTER FUNCTION public.create_servicio_with_initial_payment(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER,
  DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC,
  NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID
) SET search_path = public, pg_catalog;

-- 2. Optimize rpc_idempotency_keys RLS policies (initplan) -------------------

DROP POLICY IF EXISTS rpc_idempotency_keys_select_own ON public.rpc_idempotency_keys;
CREATE POLICY rpc_idempotency_keys_select_own ON public.rpc_idempotency_keys
  FOR SELECT
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS rpc_idempotency_keys_insert_own ON public.rpc_idempotency_keys;
CREATE POLICY rpc_idempotency_keys_insert_own ON public.rpc_idempotency_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
