# Architecture Decision Records

Este directorio registra decisiones arquitecturales que deben guiar refactors futuros. Cada ADR debe explicar el contexto, la decision, consecuencias y alternativas consideradas.

Convencion:

- `Accepted`: decision vigente.
- `Superseded`: reemplazada por otro ADR.
- `Proposed`: en discusion, no aplicar como regla todavia.

ADRs:

- [0001 - Dashboard read models desde Postgres](0001-dashboard-read-models-postgres.md)
- [0002 - React Query para lecturas y Zustand para estado UI](0002-react-query-zustand-ownership.md)
- [0003 - RPCs criticas con adapters tipados e idempotencia](0003-typed-rpc-adapters-and-idempotency.md)
- [0004 - Eventos cliente tipados en lugar de DOM/localStorage](0004-typed-client-events.md)
- [0005 - Arquitectura modular monolitica con modulos profundos](0005-modular-monolith-deep-modules.md)
- [0006 - Modelo RLS single-tenant administrativo](0006-single-tenant-admin-rls-model.md)
- [0007 - Migracion final de stores remotos a React Query](0007-react-query-final-store-migration.md)
- [0008 - Politica de zoom en PWA movil interna](0008-mobile-pwa-viewport-zoom-policy.md)
- [0009 - Snapshot del dashboard calculado en servidor](0009-dashboard-server-side-snapshot.md)

Numeracion: el siguiente ADR usa el numero libre mas alto. No reutilices numeros.

Ver tambien el [indice de documentacion](../README.md).
