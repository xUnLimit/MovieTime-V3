# Enterprise Architecture Implementation Plan

**Date:** 2026-05-22
**Status:** Cerrado en arquitectura runtime

## Objetivo

Convertir MovieTime PTY en un monolito modular con responsabilidades claras,
lecturas cacheadas por React Query, eventos cliente tipados, adapters RPC
tipados, idempotencia en operaciones criticas y modulos profundos por dominio.

## Resultado

La implementacion arquitectural esta cerrada:

- `src/lib/use-cases/ventas/` contiene queries, writes, payments, refunds y
  helpers compartidos.
- `src/lib/use-cases/servicios/` contiene queries, writes, payments y helpers
  compartidos.
- `src/lib/payments/` concentra moneda, sumas USD y factories de pagos.
- `src/lib/notifications/` concentra calculo, sync, cleanup y push delivery.
- `src/lib/dashboard-read-models/` concentra lecturas de dashboard.
- `src/lib/forecasting/` concentra pronostico financiero.
- `src/lib/events/` contiene `StoreEventBus`.
- `src/lib/supabase/` contiene repositories y RPC adapters tipados.
- Formularios y pantallas grandes fueron divididos en controllers/secciones.
- Los imports runtime apuntan a modulos actuales.

## Fuera De Alcance Activo

Por decision actual, se difiere:

- subir cobertura global a 60% / 80%;
- flujos E2E completos;
- pruebas de RPCs contra Supabase local.

## Reglas Vigentes

- No crear agregadores de use-cases para ventas o servicios.
- No importar internals de pagos desde fuera de `src/lib/payments`.
- No mutar metricas derivadas desde cliente.
- No comunicar negocio cliente con eventos DOM o localStorage.
- No usar casts RPC genericos en operaciones criticas.
- No agregar side-effects fire-and-forget sin `safeAsyncSideEffect`.

## Validacion

```bash
npm run lint
npm test -- --run
npm run build
```

Para schema:

```bash
npm run migrate:validate
```
