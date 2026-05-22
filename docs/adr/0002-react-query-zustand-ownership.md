# ADR-0002: React Query Para Lecturas y Zustand Para Estado UI

**Status:** Accepted  
**Date:** 2026-05-22

## Context

El proyecto usa Zustand para stores de dominio y UI. Tambien tiene varios hooks que hacen data fetching con `useState + useEffect`, lo que duplica loading/error/cancelacion/refetch y no deduplica requests.

Algunas lecturas remotas viven en hooks, otras en stores y otras en componentes. Esto vuelve difusa la interface de datos.

## Decision

Separar ownership de datos:

- **React Query/TanStack Query:** lecturas remotas, cache de servidor, deduplicacion, background refetch, retries e invalidacion.
- **Zustand:** estado UI, filtros locales, modales, seleccion actual, colas/toasts, cache temporal que no represente fuente remota, y comandos optimistas cuando aporten UX.
- **Use-cases:** reglas de negocio y orquestacion.
- **Repositories/RPC adapters:** comunicacion con Supabase.

Los nuevos hooks de lectura remota deben usar React Query salvo excepcion documentada.

## Consequences

- Las queries tendran keys tipadas y una politica central de stale time/retry.
- Las acciones de stores que mutan datos deben invalidar queries relacionadas o emitir eventos que las invaliden.
- No se debe migrar todo Zustand de golpe. La migracion sera por hook/feature.

## Alternatives Considered

- **Mantener todo en Zustand:** rechazado porque no resuelve deduplicacion, background refetch ni invalidacion granular.
- **Mover todo a React Query:** rechazado porque React Query no reemplaza estado UI ni flujos optimistas complejos.
- **Crear cache propia:** rechazado por costo de mantenimiento.
