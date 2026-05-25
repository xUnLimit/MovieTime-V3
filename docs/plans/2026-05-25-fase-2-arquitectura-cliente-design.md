# Fase 2: arquitectura cliente

**Fecha:** 2026-05-25  
**Estado:** Aprobado para implementacion  
**Fuente:** `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`

## Alcance

Este corte reduce acoplamiento cliente sin cambiar reglas de negocio:

- adelgazar `tercerosStore` y `serviciosStore` donde haya reacciones claras;
- centralizar invalidaciones y refreshes en `StoreEventBus`/cache reactions;
- eliminar imports directos de stores desde commands/use-cases cuando exista un evento adecuado;
- mantener Zustand para UI, seleccion, cache temporal y optimismo.

## Fuera de alcance

- Profundizar `payments`.
- Rehacer acciones de Notificacion.
- Consolidar pantallas de detalle.
- Refactor PWA/offline.
- Cambiar DataTable.
- Cambiar RLS o migraciones.

## Diseño

Los stores siguen ejecutando mutaciones optimistas, pero no deben conocer todos los efectos posteriores de otros modulos. Despues de una mutacion confirmada, emiten eventos o llaman una reaccion pequena. Las reactions concentran refresh de stores, invalidacion de React Query y side effects fire-and-forget.

La Interface preferida para comunicar cambios entre Modules cliente es `StoreEventBus`. Los comandos de cache no deben importar stores salvo que sean el Adapter temporal de una reaction ya documentada.

## Criterio de cierre

- Menos imports directos entre stores/use-cases/commands.
- Los eventos existentes cubren los refreshes de categorias/servicios/ventas usados por las pantallas.
- Tests existentes siguen verdes.
- `npm test -- --run`, `npm run lint` y `npm run build` pasan.

