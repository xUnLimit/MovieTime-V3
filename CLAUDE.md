# MovieTime PTY Engineering Guide

## Architecture

- UI reads remote/server data through React Query hooks and writes through use-cases or commands.
- Repositories are thin Supabase adapters. They must not contain business decisions.
- Use-cases own business orchestration, activity logs, side-effects policy, and cache invalidation/sync results.
- Stores are UI/cache state only. Do not add transactional rules or cross-store business orchestration to Zustand stores.
- SQL/RPC is the source of truth for atomic payment, period, and rollback invariants.
- Read models for dashboard/forecasting come from SQL/RPC modules, not client-side metric mutation helpers.
- New payment/currency code imports from `@/lib/payments`.
- New notification code imports from `@/lib/notifications`.
- New dashboard code imports from `@/lib/dashboard-read-models`.
- Communication between business modules uses `StoreEventBus`; do not add `window.dispatchEvent`/`localStorage` business events.
- Keep production modules under 300 lines unless there is an explicit documented exception.

## Safety Rules

- Validate dynamic route IDs with `isUuid`/`assertUuid` before querying Supabase.
- Do not return `String(data)` from RPCs. Use `assertRpcStringId`.
- Do not use `.catch(() => {})`. Use `safeAsyncSideEffect` or an explicit `try/catch` with context.
- Keep `detalles` in activity logs for display, and use `metadata` for structured audit data.
- If a payment changes the latest period, update payment and period atomically through RPC.
- Critical RPCs must go through typed adapters and include idempotency keys when creating records/payments/refunds.
- Do not recreate retired service aggregators. Import dashboard reads from `@/lib/dashboard-read-models` and notification sync from `@/lib/notifications`.

## Testing Rules

- Add unit tests for pure helpers and use-case branches.
- Add integration tests for sales, services, payments, renewals, RLS, rollback, and dashboard projections.
- Before merging, run `npm run lint`, `npm test -- --run`, `npm run test:coverage`, `npm run build`, and `npm run migrate:validate`.
