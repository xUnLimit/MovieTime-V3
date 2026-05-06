# RPC Security Audit

## Current SECURITY DEFINER Surface

The exposed transactional RPCs are payment/period operations:

- `create_venta_payment`
- `create_servicio_payment`
- `update_venta_payment_and_period`
- `update_servicio_payment_and_period`
- `delete_venta_payment_and_empty_period`
- `delete_servicio_payment_and_empty_period`

Internal/admin functions include:

- `public.auth_role`
- `private.auth_role`
- `handle_new_auth_user`
- `rebuild_dashboard_financial_stats`

## Required Contract

- Public client code may call only the transactional payment RPCs granted to `authenticated`.
- Admin/internal `SECURITY DEFINER` functions must not be executable by `PUBLIC`, `anon`, or normal `authenticated` clients unless explicitly documented.
- Every `SECURITY DEFINER` function must set a safe `search_path`, validate required IDs, and fail before mutating if the target row does not exist.
- Payment RPCs must keep payment and period changes in a single transaction and must return only a validated ID or void.

## Validation Checklist

- `npm run migrate:validate` must report no orphan payments or inconsistent periods.
- `run_security_audit_validations` must report zero for:
  - `rls_disabled_app_tables`
  - `security_definer_executable_by_anon`
  - `unapproved_security_definer_executable_by_authenticated`
  - `required_rpc_missing_authenticated_execute`
  - `required_rpc_executable_by_anon`
  - `security_definer_missing_search_path`
- RLS tests must verify that unauthenticated users cannot read/write protected tables.
- Rollback tests must verify no partial payment/period rows after a forced RPC failure.
- Concurrency tests must verify renewals do not duplicate `numero_periodo`.
