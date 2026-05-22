# ADR-0001: Dashboard Read Models Desde Postgres

**Status:** Accepted  
**Date:** 2026-05-22

## Context

El dashboard actual lee metricas mediante RPCs como `get_dashboard_stats_live`, `get_dashboard_home` y `get_dashboard_churn_stats`. Tambien existen funciones cliente como `adjustIngresosStats`, `adjustGastosStats`, `upsertVentaPronostico` y `upsertServicioPronostico`, pero actualmente son no-ops.

`CONTEXT.md` establece que Supabase/Postgres es la fuente de verdad y que las metricas derivadas deben mantenerse por SQL views, RPC functions, triggers o servicios dedicados. Mantener APIs cliente que parecen mutar metricas, pero no hacen nada, crea una interface falsa.

## Decision

El dashboard se tratara como un read model de Postgres/Supabase. El cliente no mutara metricas derivadas por delta.

Los use-cases y stores solo deben:

- ejecutar la mutacion de negocio real;
- invalidar cache local o queries;
- refrescar el read model mediante React Query/Zustand cuando corresponda.

Las funciones no-op de dashboard deben eliminarse o convertirse en operaciones explicitas de invalidacion/refetch.

## Consequences

- Se elimina la ambiguedad entre "actualizar dashboard" y "refetchear dashboard".
- Los calculos financieros siguen centralizados en SQL/RPC/read models.
- Si se necesita cache materializado, debe implementarse en Postgres o en un job con permisos server-side, no como mutacion cliente.
- Los documentos legacy de dashboard basados en Firebase/incremental cache quedan superados por este ADR.

## Alternatives Considered

- **Implementar `adjust*` en cliente:** rechazado porque crea una segunda fuente de verdad.
- **Mantener no-ops por compatibilidad:** rechazado porque oculta errores y confunde a nuevos maintainers.
- **Calcular todo en UI:** rechazado por costo, duplicacion y riesgo de inconsistencias.
