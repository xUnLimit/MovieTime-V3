# Incremental Architecture Deepening Design

**Date:** 2026-05-25
**Status:** Approved for incremental implementation

## Goal

Deepen the current modular monolith without changing user-visible behavior.
The work keeps existing public imports compatible while concentrating
post-mutation coordination, RPC casting, notification sync internals and
store orchestration behind smaller interfaces.

## Approach

- Add a cache reaction module that owns client query/store refresh behavior
  after domain events.
- Keep Zustand stores as UI/cache adapters, and move cross-module side effects
  into ventas/servicios coordination modules.
- Centralize the remaining Supabase RPC client casts behind one helper.
- Keep `notification-sync-orchestrator` as the public facade and move its
  runtime state plus bulk/surgical sync implementations into internal modules.
- Prefer narrow, compatible seams over a broad rewrite.

## Validation

Run:

```bash
npm run lint
npm test -- --run
npm run build
npm run migrate:validate
```
