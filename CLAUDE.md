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

## Import rules per layer (enforced by `src/platform/architecture-boundaries.test.ts`)

| Layer | MAY import | MUST NOT import |
|---|---|---|
| `platform/` | other `platform/` | `application/`, `modules/`, `@/store`, React/UI |
| `modules/<x>/` | its own files, `platform/` | `@/store`, `application/`, other modules' internals, React |
| `application/` | `modules/`, `platform/` | `@/store` (the boundary test checks this transitively), React, `@/components`, `@/hooks` |
| `store/` | `application/`, `modules/`, `platform/` | `@/platform/supabase` directly (go through use-cases) |
| `app/` `components/` `hooks/` | `hooks/`, `application/`, `modules/`, `store/`, `platform/utils` | `@/platform/supabase` directly |

## How to add code (follow the existing pattern)

- **New feature on an existing entity:** add the type in `src/types`, the write in the relevant `@/platform/supabase` repository (thin, no decisions), the orchestration in `@/application/use-cases/<domain>`, and the read hook in `src/hooks` (React Query). UI calls the use-case/command, never the repository.
- **A use-case** has the shape `fn(input, deps)` where `deps` carries injected ports and `{ logContext, recordActivityLog }`. It NEVER calls `useAuthStore.getState()` or `getActivityLogOptions()` itself — the composition root (`@/application/client-domain-mutations`) injects them.
- **Critical write (payment/refund/period):** go through a typed `*-rpc-adapter` in `@/platform/supabase` with `assertOnlineMutation()`, `withIdempotencyKey()` and `assertRpcStringId()`. Never `String(data)`.
- **A domain event** is emitted once, by the use-case. Reactions only invalidate cache / sync read models; they do not re-emit.
- **Do NOT** create a new generic aggregator, a `lib/` folder, or a parallel "mutations" home. The four homes are: repositories (`platform/supabase`), use-cases (`application/use-cases`), composition root (`application/client-domain-mutations`), reactions (`application/store-reactions`).

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

## Git Workflow

- Commit and push directly to `main`. Do NOT create feature/working branches or open pull requests for routine changes — the user works solo and prefers a single linear history on `main`.
- Still run the full checklist (`npm run lint`, `npm test -- --run`, `npm run build`, `npm run migrate:validate`) BEFORE committing, and only commit/push when the user asks.
- End commit messages with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
