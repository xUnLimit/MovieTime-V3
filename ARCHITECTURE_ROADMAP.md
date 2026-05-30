# MovieTime PTY - Arquitectura Enterprise
# Estado actual - Mayo 2026

> Para la auditoria activa, arquitectura objetivo y deuda priorizada, usar `docs/2026-05-30-auditoria-arquitectonica-profunda-verificada.md`.

---

## Resumen

MovieTime PTY opera como un monolito modular sobre Next.js, Zustand,
TanStack Query y Supabase/Postgres. La fuente de verdad transaccional es
Postgres; el cliente coordina UI, lecturas cacheadas, invalidacion y
orquestacion de casos de uso.

La migracion arquitectural principal esta cerrada. El codigo runtime usa los
modulos actuales de dominio y no depende de rutas antiguas de servicios,
use-cases agregados o mutaciones falsas de dashboard.

---

## Arquitectura Actual

```text
UI / App Router
  -> React Query hooks para lecturas remotas
  -> Zustand stores para estado UI y escrituras optimistas
  -> Use-cases por dominio y responsabilidad
  -> Modulos profundos de dominio
  -> Repositories / RPC adapters
  -> Supabase / Postgres
```

## Modulos Principales

- `src/lib/use-cases/ventas/`
  - `ventas-query-use-cases.ts`
  - `ventas-write-use-cases.ts`
  - `ventas-payment-use-cases.ts`
  - `ventas-refund-use-cases.ts`
  - `ventas-shared.ts`

- `src/lib/use-cases/servicios/`
  - `servicios-query-use-cases.ts`
  - `servicios-write-use-cases.ts`
  - `servicios-payment-use-cases.ts`
  - `servicios-shared.ts`

- `src/lib/payments/`
  - Fachada unica para moneda, montos, factories de pago y sumas USD.

- `src/lib/notifications/`
  - Sincronizacion, calculo, cleanup y push delivery de notificaciones.

- `src/lib/dashboard-read-models/`
  - Lectura de dashboard y metricas desde RPC/read models.

- `src/lib/forecasting/`
  - Sincronizacion y mapeo de pronostico financiero.

- `src/lib/events/`
  - `StoreEventBus` para eventos de negocio del cliente.

- `src/lib/supabase/`
  - Repositories, mappers, pagination, guards y adapters RPC tipados.

---

## Reglas De Arquitectura

1. Supabase/Postgres es la fuente de verdad para ventas, servicios, pagos,
   periodos, reembolsos, activity log y metricas derivadas.
2. Las operaciones criticas usan RPCs atomicas con adapters tipados.
3. Las operaciones que crean registros/pagos/reembolsos usan idempotency keys.
4. Las lecturas remotas usan TanStack Query salvo excepcion documentada.
5. Zustand no contiene invariantes transaccionales; conserva estado UI/cache.
6. Los stores y componentes importan use-cases especificos, no agregadores.
7. Pagos y conversion de moneda se consumen desde `@/lib/payments`.
8. Dashboard se consume desde `@/lib/dashboard-read-models`.
9. Notificaciones se consumen desde `@/lib/notifications`.
10. Eventos cliente entre modulos usan `StoreEventBus`.
11. Side-effects fire-and-forget usan `safeAsyncSideEffect`.
12. Errores de negocio extienden `DomainError`.

---

## Estado Por Fase

| Fase | Estado |
|---|---|
| Fase 0 - Correcciones base | Cerrada |
| Fase 1 - Testing enterprise | Diferida por decision de producto |
| Fase 2 - Use-cases modulares | Cerrada |
| Fase 3 - React Query y EventBus | Cerrada |
| Fase 4 - Consolidacion enterprise | Cerrada |

La auditoria actual exige validaciones reproducibles por fase. La cobertura y pruebas E2E/RPC no deben cambiarse sin una decision documentada en el plan activo o una ADR cuando aplique.

---

## Validacion Requerida Para Cambios

Antes de fusionar cambios relevantes:

```bash
npm run lint
npm test -- --run
npm run build
```

Para cambios de Supabase/schema:

```bash
npm run migrate:validate
```

---

## Documentos De Decision

- `docs/adr/0001-dashboard-read-models-postgres.md`
- `docs/adr/0002-react-query-zustand-ownership.md`
- `docs/adr/0003-typed-rpc-adapters-and-idempotency.md`
- `docs/adr/0004-typed-client-events.md`
- `docs/adr/0005-modular-monolith-deep-modules.md`
- `docs/adr/0006-single-tenant-admin-rls-model.md`

---

## Estado Limpio

No existen imports runtime hacia rutas retiradas de dashboard, notificaciones
o use-cases agregados. Los documentos historicos de migracion y disenos
superados deben leerse desde `docs/README.md`, que separa fuentes activas,
historicas y ADRs vigentes.
