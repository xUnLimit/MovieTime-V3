# Enterprise audit aggressive implementation design

Date: 2026-05-25

## Goal

Apply every roadmap phase from `docs/2026-05-25-enterprise-project-audit.md` with an aggressive posture: close critical security exposure first, then make operational reliability and module boundaries measurably stronger in the same pass.

## Architecture

- Treat Supabase/Postgres as the source of truth for authorization, idempotency, and financial writes.
- Keep public route handlers thin: authenticate, validate request shape, call a domain/service module, return typed JSON.
- Move push notification summary resolution away from unauthenticated service worker fetches. Push delivery should carry the display payload generated server-side.
- Deepen financial and operational modules by exposing domain-oriented functions and hiding factories, calculators, adapters, UI effects, and cache reactions behind smaller public entry points.

## Data Flow

- Push subscription APIs require an authenticated admin JWT and bind subscriptions to `auth.uid()`.
- Pending push summary lookups require authenticated ownership of the subscription endpoint.
- Critical RPCs derive audit fields from `auth.uid()` and protect idempotency by user, RPC name, and idempotency key.
- Notifications and servicio dependency sync return outcomes; UI/cache side effects happen at the boundary.

## Reliability

- Fix Vitest timeouts by removing pending async/timer behavior instead of increasing timeouts by default.
- Add fail-fast environment validation for production server and public client variables.
- Harden destructive staging reset with an explicit allowlist and environment identification.
- Extend secret scanning beyond staged content to catch working-tree leaks before CI.

## Performance And State

- Prefer React Query for remote reads and Zustand for UI/optimistic state.
- Review `dynamic = 'force-dynamic'` and keep it only where CSP/session constraints require it.
- Split oversized UI workflows where they mix rendering and actions.

## Testing

- Run targeted tests around push, RPC adapters, notification sync, stores, dashboard, payments, and forecasting.
- Run lint/build when implementation stabilizes.
- Document any remaining architectural work that is too large to safely finish in one pass.
