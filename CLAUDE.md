# MovieTime PTY Engineering Guide

## Architecture

- UI reads through `queries`/hooks/stores and writes through use-cases or commands.
- Repositories are thin Supabase adapters. They must not contain business decisions.
- Use-cases own business orchestration, activity logs, dashboard side effects, and cache sync results.
- Stores are UI/cache state only. Do not add transactional rules to Zustand stores.
- SQL/RPC is the source of truth for atomic payment, period, and rollback invariants.

## Safety Rules

- Validate dynamic route IDs with `isUuid`/`assertUuid` before querying Supabase.
- Do not return `String(data)` from RPCs. Use `assertRpcStringId`.
- Do not use `.catch(() => {})`. Use `safeAsyncSideEffect` or an explicit `try/catch` with context.
- Keep `detalles` in activity logs for display, and use `metadata` for structured audit data.
- If a payment changes the latest period, update payment and period atomically through RPC.

## Testing Rules

- Add unit tests for pure helpers and use-case branches.
- Add integration tests for sales, services, payments, renewals, RLS, rollback, and dashboard projections.
- Before merging, run `npm run lint`, `npm test -- --run`, `npm run test:coverage`, `npm run build`, and `npm run migrate:validate`.
