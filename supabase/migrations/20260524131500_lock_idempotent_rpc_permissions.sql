-- ============================================================================
-- Lock idempotent RPC overloads to authenticated callers only.
--
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. The
-- idempotent overloads added in 20260523183000_rpc_idempotency_keys.sql need the
-- same exposed-role hardening as the original critical RPCs.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.create_venta_with_initial_payment(
  TEXT, TEXT, TEXT, venta_estado_enum, INTEGER, TEXT, TEXT, TEXT, DATE, DATE,
  ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT,
  TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_venta_with_initial_payment(
  TEXT, TEXT, TEXT, venta_estado_enum, INTEGER, TEXT, TEXT, TEXT, DATE, DATE,
  ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT,
  TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_servicio_with_initial_payment(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER,
  DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC,
  NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_servicio_with_initial_payment(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER,
  DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC,
  NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_venta_payment(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_venta_payment(
  TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID, UUID
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_servicio_payment(
  TEXT, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_servicio_payment(
  TEXT, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_venta_refund(
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ,
  TEXT, BOOLEAN, TEXT, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_venta_refund(
  TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ,
  TEXT, BOOLEAN, TEXT, UUID, UUID
) TO authenticated;

NOTIFY pgrst, 'reload schema';
