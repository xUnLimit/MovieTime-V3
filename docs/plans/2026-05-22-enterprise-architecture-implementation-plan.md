# Enterprise Architecture Implementation Plan

**Date:** 2026-05-22  
**Status:** In progress  
**Source:** `ARCHITECTURE_ROADMAP.md` v1.1

## Goal

Convertir el roadmap enterprise en una secuencia de PRs pequenos, verificables y con bajo riesgo. La estrategia no es reescribir el sistema; es migrar hacia una arquitectura modular monolitica con tests, adapters RPC tipados, read models claros y eventos cliente tipados.

## Execution Rules

- No iniciar descomposicion grande de `ventas-use-cases.ts` o `servicios-use-cases.ts` sin tests del flujo afectado.
- Cada PR debe pasar `npm run lint`, `npm test -- --run`, `npm run build`.
- Para cambios de Supabase/schema, tambien ejecutar `npm run migrate:validate`.
- Cada cambio de arquitectura que altere una regla debe actualizar o crear ADR.
- No tocar `.env.local` ni secretos.
- Ignorar cambios no relacionados como `.claude/settings.local.json` salvo que el usuario pida lo contrario.

## Execution Progress

Completado hasta esta iteracion:

- PR 0: baseline documental y roadmap enterprise.
- PR 1: tipos duplicados de ventas consolidados.
- PR 2: `getStoreLogContext()` compartido en stores.
- PR 5/6 slice: adapter tipado para `create_venta_with_initial_payment`.
- PR 7 slice: tests de ventas ampliados para create, renew, refund, delete y chunking.
- PR 8/9 slice: infraestructura React Query y StoreEventBus base.
- Migraciones adicionales de Fase 3: hooks principales migrados a React Query, eventos tipados emitidos junto a eventos legacy, imports dinamicos de stores reemplazados por dependencias explicitas.
- Fase 2 ventas: `ventas-use-cases.ts` convertido en barrel; use-cases separados en `ventas-query-use-cases.ts`, `ventas-payment-use-cases.ts`, `ventas-refund-use-cases.ts`, `ventas-write-use-cases.ts` y `ventas-shared.ts`.
- Fase 2 servicios: `servicios-use-cases.ts` convertido en barrel; use-cases separados en `servicios-query-use-cases.ts`, `servicios-payment-use-cases.ts`, `servicios-write-use-cases.ts` y `servicios-shared.ts`.
- Fase 2 errores: `DomainError`, `ValidationError`, `NotFoundError`, `ConflictError` e `InsufficientFundsError` agregados y usados en flujos criticos de ventas/servicios.
- Fase 2/3 eventos: bridge legacy DOM/localStorage centralizado en `store-event-bus`, imports dinamicos runtime removidos y emisiones directas de negocio reemplazadas por bus tipado + bridge legacy.
- Fase 0/4 dashboard: mutaciones no-op `adjust*`/`upsert*Pronostico` eliminadas del runtime y retiradas de `dashboardStatsService`; el dashboard queda orientado a invalidacion/refetch sobre read models live.
- Fase 2 limpieza de capas: `notificaciones-use-cases.ts` eliminado porque era pass-through puro hacia el repositorio.
- Cobertura: suite actual en 120 tests pasando.

Commits de referencia de esta iteracion:

- `389e6dc` refactor: extract venta payment use cases
- `e418b87` refactor: extract venta write use cases
- `5fd7e28` refactor: extract servicio query use cases
- `c918891` refactor: extract servicio shared helpers
- `0f6c3a2` refactor: extract servicio payment use cases
- `e1603f9` refactor: extract servicio write use cases
- `545db5d` refactor: extract venta refund use case
- `18c9a12` refactor: move latest venta payment update
- `5164695` test: cover servicio write use cases
- `c24d58d` feat: add typed domain errors to critical use cases
- `320c072` feat: type tercero deletion errors
- `5eed50c` refactor: centralize legacy store event bridge
- `9121b7b` refactor: reuse legacy event bridge in services
- `9cb1f93` refactor: remove venta detail store dynamic imports
- `a900086` refactor: make payment currency dependency explicit
- `cf47006` refactor: remove dashboard no-op mutations
- `e0fa866` refactor: drop deprecated dashboard mutation APIs
- `d4b96f5` refactor: remove notification pass-through use case

Validacion recurrente ejecutada por PR logico:

- `npm run lint`
- `npm test -- --run`
- `npm run build`

## PR 0 - Baseline de Arquitectura

**Purpose:** Dejar decisiones y plan listos antes de tocar runtime.

**Files:**

- `ARCHITECTURE_ROADMAP.md`
- `docs/adr/`
- `docs/plans/2026-05-22-enterprise-architecture-implementation-plan.md`

**Acceptance Criteria:**

- ADRs iniciales existen y cubren dashboard, React Query/Zustand, RPCs, eventos cliente y modular monolith.
- El plan define PRs ejecutables con validacion.
- No hay cambios runtime.

**Validation:**

- Revisar diff documental.

## PR 1 - Tipos Duplicados en Ventas

**Purpose:** Eliminar declaration merging accidental antes de tocar flujos de pagos.

**Files:**

- `src/types/ventas.ts`
- tests existentes afectados si aplica.

**Implementation:**

- Consolidar `VentaPago` en una sola interface.
- Consolidar `PagoVenta` en una sola interface.
- Verificar que `estado`, `motivoAnulacion` y `destinoReembolso` quedan en el tipo correcto.
- No cambiar nombres publicos salvo que build/tests lo exijan.

**Acceptance Criteria:**

- No quedan dos declaraciones `interface VentaPago`.
- No quedan dos declaraciones `interface PagoVenta`.
- Tipos consumidores compilan sin casts nuevos.

**Validation:**

- `npm run lint`
- `npm test -- --run`
- `npm run build`

## PR 2 - Helper Compartido de Log Context

**Purpose:** Reducir duplicacion en stores sin cambiar comportamiento.

**Files:**

- `src/lib/utils/storeHelpers.ts`
- `src/store/categoriasStore.ts`
- `src/store/gastosStore.ts`
- `src/store/metodosPagoStore.ts`
- `src/store/serviciosStore.ts`
- `src/store/templatesStore.ts`
- `src/store/tercerosStore.ts`
- `src/store/ventasStore.ts`

**Implementation:**

- Crear `getStoreLogContext()`.
- Reemplazar `getLogContext()` duplicado en stores.
- Mantener fallback actual: `sistema`.

**Acceptance Criteria:**

- Una sola implementacion compartida de log context.
- Activity log conserva `usuarioId` y `usuarioEmail`.

**Validation:**

- `npm run lint`
- `npm test -- --run`
- `npm run build`

## PR 3 - Side-effects Best-effort Sin Silencio

**Purpose:** Hacer visibles errores secundarios sin cambiar la transaccion principal.

**Files:**

- `src/lib/use-cases/ventas-use-cases.ts`
- `src/lib/use-cases/servicios-use-cases.ts`
- `src/lib/use-cases/terceros-use-cases.ts`
- `src/store/serviciosStore.ts`
- `src/store/ventasStore.ts`
- `src/store/notificacionesStore.ts` si aplica.

**Implementation:**

- Reemplazar `.catch(console.error)` fire-and-forget con `safeAsyncSideEffect`.
- Reemplazar `catch {}` en cleanup de notificaciones con `safeAsyncSideEffect` o logging contextual.
- No convertir side-effects best-effort en errores bloqueantes.

**Acceptance Criteria:**

- No hay `catch {}` silencioso en flujos de negocio.
- Side-effects fire-and-forget tienen `operation`, `entity` y `entityId` cuando aplique.

**Validation:**

- `rg -n "catch \\{\\s*$" src/lib/use-cases src/store`
- `rg -n "\\.catch\\(\\(err|console\\.error\\(" src/lib/use-cases`
- `npm run lint`
- `npm test -- --run`
- `npm run build`

## PR 4 - Dashboard No-op Cleanup

**Purpose:** Alinear dashboard con ADR-0001.

**Files:**

- `src/lib/services/dashboardStatsService.ts`
- `src/lib/commands/client-cache.ts`
- use-cases que llaman `adjust*`/`upsert*`
- docs legacy de dashboard, si se marca cabecera.

**Implementation:**

- Reemplazar llamadas no-op por invalidacion/refetch.
- Mantener `getDashboardStats`, `getDashboardHome`, `getDashboardChurnStats`.
- Eliminar o deprecar funciones `adjustIngresosStats`, `adjustGastosStats`, `adjustTercerosPorMes`, `upsertVentaPronostico`, `upsertServicioPronostico` segun impacto.
- Marcar docs de dashboard Firebase/incremental cache como legacy si siguen en repo.

**Acceptance Criteria:**

- No queda codigo que parezca mutar dashboard derivado desde cliente.
- Dashboard sigue leyendo desde RPC live.
- Tests existentes de dashboard pasan.

**Validation:**

- `rg -n "adjustIngresosStats|adjustGastosStats|upsertVentaPronostico|upsertServicioPronostico" src`
- `npm run lint`
- `npm test -- --run`
- `npm run build`

## PR 5 - RPC Type Drift Audit

**Purpose:** Definir lista exacta de RPCs runtime y brechas de tipos antes de cambiar adapters.

**Files:**

- `docs/2026-05-22-rpc-type-drift-audit.md`
- opcional: script de auditoria en `scripts/`.

**Implementation:**

- Listar todas las llamadas `supabase.rpc`.
- Comparar contra `database.types.ts`.
- Clasificar RPCs: typed, missing, casted, generated mismatch.
- Elegir accion por RPC: regenerar types, adapter manual o migracion/type fix.

**Acceptance Criteria:**

- Documento con tabla de RPCs y accion concreta.
- Decision clara para PR 6.

**Validation:**

- `rg -n "supabase\\.rpc|rpcClient\\.rpc" src`
- `rg -n "Functions:" src/lib/supabase/database.types.ts`

## PR 6 - Typed RPC Adapters Slice: Ventas Iniciales

**Purpose:** Empezar por una vertical slice critica sin cambiar toda la arquitectura.

**Files:**

- `src/lib/supabase/ventas-rpc-adapter.ts` o equivalente.
- `src/lib/supabase/ventas-repository.ts`
- tests de adapter.

**Implementation:**

- Crear payload tipado para `create_venta_with_initial_payment`.
- Centralizar conversion de respuesta.
- Eliminar `Record<string, unknown>` en esa ruta si es viable.
- Mantener comportamiento externo de `createVentaWithInitialPayment`.

**Acceptance Criteria:**

- La venta inicial ya no depende de cast `unknown` local en repository.
- Tests verifican payload y error mapping.

**Validation:**

- `npm run lint`
- `npm test -- --run`
- `npm run build`

## PR 7 - Test Slice: Venta Create/Renew/Refund

**Purpose:** Crear red de seguridad antes de descomponer `ventas-use-cases.ts`.

**Files:**

- `src/lib/use-cases/ventas-use-cases.test.ts`
- mocks de repositories/services necesarios.

**Implementation:**

- Cubrir create con pago inicial.
- Cubrir renew con sync de metodo de pago exitoso y fallido.
- Cubrir refund con saldo insuficiente y refund valido.
- Cubrir delete con/sin pagos.

**Acceptance Criteria:**

- Branches principales de ventas tienen tests.
- Se documentan side-effects best-effort esperados.

**Validation:**

- `npm test -- --run src/lib/use-cases/ventas-use-cases.test.ts`
- `npm run test:coverage -- --run`

## PR 8 - Preparar React Query Sin Migrar Todo

**Purpose:** Introducir infraestructura sin big-bang.

**Files:**

- `package.json`
- `src/lib/query-client.ts`
- `src/lib/query-keys.ts`
- provider cliente en app/layout wrapper correspondiente.

**Implementation:**

- Instalar `@tanstack/react-query`.
- Definir query client base.
- Definir query keys para pagos/ventas/servicios/dashboard.
- No migrar hooks aun salvo smoke test minimo.

**Acceptance Criteria:**

- Provider disponible.
- No cambia comportamiento funcional.

**Validation:**

- `npm run lint`
- `npm test -- --run`
- `npm run build`

## PR 9 - StoreEventBus Base

**Purpose:** Introducir seam tipado para eventos cliente sin migracion masiva.

**Files:**

- `src/lib/events/store-event-bus.ts`
- tests unitarios.

**Implementation:**

- Implementar `emit`, `on`, unsubscribe.
- Tipar eventos iniciales.
- Agregar tests de suscripcion, unsubscribe y payload.

**Acceptance Criteria:**

- Bus funciona sin DOM.
- No se migra ningun store todavia salvo un uso piloto si es seguro.

**Validation:**

- `npm test -- --run src/lib/events`
- `npm run lint`
- `npm run build`

## Phase Gates

### Gate A - Ready for Use-case Decomposition

Required before splitting `ventas-use-cases.ts`:

- PRs 1, 3, 6 and 7 merged.
- Tests for ventas create/renew/refund/delete pass.
- No dashboard no-op dependency remains in ventas flow.

### Gate B - Ready for React Query Migration

Required before migrating hooks:

- PR 8 merged.
- Query key naming accepted.
- At least one store mutation has a defined invalidation strategy.

### Gate C - Ready for Event Migration

Required before removing DOM/localStorage events:

- PR 9 merged.
- Event names and payloads accepted.
- One migration target selected: ventas, servicios or notificaciones.

## First Implementation Order

1. PR 0: baseline docs and ADRs.
2. PR 1: duplicate ventas types.
3. PR 2: shared log context.
4. PR 3: side-effects without silent catches.
5. PR 5: RPC type drift audit.
6. PR 6: typed RPC adapter for `create_venta_with_initial_payment`.
7. PR 7: ventas vertical slice tests.
8. PR 4: dashboard no-op cleanup.

PR 8 and PR 9 can start after PR 3 if dependencies are clean, but should not block the ventas safety slice.

## Open Questions Before Runtime Work

- Should Supabase types be regenerated from linked remote or from local migrations first?
- Will RPC integration tests run in CI, or only locally at first?
- Should dashboard legacy docs be moved to `docs/archive` or marked in place?
- What coverage threshold is acceptable for the first CI gate: global 45% first, then 60%, or immediate 60%?

Recommended defaults:

- Regenerate types only after migration drift is understood.
- Start RPC integration tests locally, then add CI once stable.
- Mark legacy dashboard docs in place first to avoid file churn.
- Set an initial coverage threshold near current baseline, then ratchet upward by phase.
