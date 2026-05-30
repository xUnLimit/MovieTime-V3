# MovieTime PTY Engineering Guide

## Layers (src layout)

- `src/platform/` — cross-cutting infrastructure shared by everything: `supabase` (client, repos, RPC adapters, types), `events` (StoreEventBus), `cache`, `commands`, `observability` (central logger), `errors`, `config`, `constants`, `utils`, `server`, `query-keys`, `query-client`. No business decisions; no imports from `application/`, `modules/` or `@/store`.
- `src/modules/<context>/` — deep domain modules: `payments`, `notifications`, `dashboard-read-models`, `forecasting`, `executive-push`, `pwa`, `services`. Cohesive business logic behind a small surface.
- `src/application/` — business orchestration: `use-cases/`, `client-domain-mutations/` (composition root), `store-reactions/`, `activity/`, plus `ventas`/`terceros` read/write adapters.
- `src/store/` — Zustand UI/auth/PWA/filter state only.
- `src/hooks/`, `src/components/`, `src/app/` — UI: React Query reads + presentation + routes.

## Architecture

- UI reads remote/server data through React Query hooks and writes through use-cases or commands.
- Repositories are thin Supabase adapters (`@/platform/supabase`). They must not contain business decisions.
- Use-cases (`@/application/use-cases`) own business orchestration, activity logs, side-effects policy, and cache invalidation/sync results.
- Identity/log context is INJECTED into use-cases by parameter from the composition root; use-cases never read `@/store` directly (the boundary test enforces this transitively).
- Stores are UI/cache state only. Do not add transactional rules or cross-store business orchestration to Zustand stores.
- SQL/RPC is the source of truth for atomic payment, period, and rollback invariants.
- Read models for dashboard/forecasting come from SQL/RPC modules, not client-side metric mutation helpers.
- New payment/currency code imports from `@/modules/payments`.
- New notification code imports from `@/modules/notifications`.
- New dashboard code imports from `@/modules/dashboard-read-models`.
- A domain event has ONE emitter (the use-case). Store-reactions react to effects (cache/forecast); they do not re-emit.
- Communication between business modules uses `StoreEventBus` (`@/platform/events`); do not add `window.dispatchEvent`/`localStorage` business events.
- Keep production modules under 300 lines unless there is an explicit documented exception.

## Safety Rules

- Validate dynamic route IDs with `isUuid`/`assertUuid` before querying Supabase.
- Do not return `String(data)` from RPCs. Use `assertRpcStringId`.
- Do not use `.catch(() => {})`. Use `safeAsyncSideEffect` or an explicit `try/catch` with context.
- Keep `detalles` in activity logs for display, and use `metadata` for structured audit data.
- If a payment changes the latest period, update payment and period atomically through RPC.
- Critical RPCs must go through typed adapters and include idempotency keys when creating records/payments/refunds.
- Do not recreate retired service aggregators. Import dashboard reads from `@/modules/dashboard-read-models` and notification sync from `@/modules/notifications`.

## Testing Rules

- Add unit tests for pure helpers and use-case branches.
- Add integration tests for sales, services, payments, renewals, RLS, rollback, and dashboard projections.
- Before merging, run `npm run lint`, `npm test -- --run`, `npm run test:coverage`, `npm run build`, and `npm run migrate:validate`.
