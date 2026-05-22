# ADR-0004: Eventos Cliente Tipados En Lugar De DOM/localStorage

**Status:** Accepted  
**Date:** 2026-05-22

## Context

El proyecto comunica cambios entre modulos con varios mecanismos:

- dynamic imports de stores;
- `window.dispatchEvent`;
- `localStorage.setItem`;
- llamadas directas a otros stores;
- helpers de cache que importan stores dinamicamente.

Esto hace dificil testear, detectar dependencias circulares y entender los efectos posteriores a una mutacion.

## Decision

Los cambios de negocio en cliente deben comunicarse mediante un event bus tipado. El bus vive en un seam explicito, por ejemplo `src/lib/events/store-event-bus.ts`.

Eventos esperados:

- `VENTA_CREATED`
- `VENTA_UPDATED`
- `VENTA_DELETED`
- `SERVICIO_UPDATED`
- `SERVICIO_ARCHIVED`
- `DASHBOARD_INVALIDATED`
- `NOTIFICACIONES_INVALIDATED`

Los handlers pueden invalidar stores o React Query. Los eventos DOM/localStorage quedan reservados solo para integraciones reales del navegador, no para comunicacion de negocio interna.

## Consequences

- Se elimina coupling opaco entre stores.
- Los handlers pueden testearse sin DOM.
- La migracion sera incremental por feature.
- El bus no reemplaza transacciones de base de datos; solo coordina cache/UI despues de mutaciones confirmadas.

## Alternatives Considered

- **Continuar con DOM events:** rechazado porque no es tipado ni SSR-friendly.
- **Usar solo imports directos:** rechazado por dependencias circulares.
- **Introducir cola/event sourcing persistente:** rechazado por complejidad innecesaria para eventos cliente.
