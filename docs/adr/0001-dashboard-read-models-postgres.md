# ADR-0001: Dashboard Read Models Desde Postgres

**Status:** Accepted  
**Date:** 2026-05-22

## Context

El dashboard lee metricas mediante RPCs como `get_dashboard_stats_live`, `get_dashboard_home` y `get_dashboard_churn_stats`.

`CONTEXT.md` establece que Supabase/Postgres es la fuente de verdad y que las metricas derivadas deben mantenerse por SQL views, RPC functions, triggers o servicios dedicados. Las interfaces cliente no deben representar metricas derivadas como datos mutables.

## Decision

El dashboard se tratara como un read model de Postgres/Supabase. El cliente no mutara metricas derivadas por delta.

Los use-cases y stores solo deben:

- ejecutar la mutacion de negocio real;
- invalidar cache local o queries;
- refrescar el read model mediante React Query/Zustand cuando corresponda.

Las operaciones de dashboard en cliente deben ser lecturas, invalidaciones o refetch explicitos.

## Consequences

- Se elimina la ambiguedad entre "actualizar dashboard" y "refetchear dashboard".
- Los calculos financieros siguen centralizados en SQL/RPC/read models.
- Si se necesita cache materializado, debe implementarse en Postgres o en un job con permisos server-side, no como mutacion cliente.
- El dashboard mantiene una sola estrategia: read models de Postgres/Supabase.

## Alternatives Considered

- **Implementar `adjust*` en cliente:** rechazado porque crea una segunda fuente de verdad.
- **Mantener helpers vacios:** rechazado porque oculta errores y confunde a nuevos maintainers.
- **Calcular todo en UI:** rechazado por costo, duplicacion y riesgo de inconsistencias.
