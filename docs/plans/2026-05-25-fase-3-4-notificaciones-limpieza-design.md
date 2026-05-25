# Fase 3-4: Notificaciones y limpieza acotada

**Fecha:** 2026-05-25  
**Estado:** Aprobado para implementacion  
**Fuente:** `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`

## Alcance

Este corte profundiza los use-cases de Notificacion y cierra limpieza documental:

- sacar imports directos de stores desde `src/lib/use-cases/notificaciones/*` cuando pueda moverse a reactions;
- mantener el comportamiento actual de UI;
- no redisenar `payments`, DataTable, PWA/offline ni pantallas de detalle en esta pasada;
- actualizar docs para reflejar avance real de fases.

## Diseno

Los use-cases de Notificacion siguen orquestando acciones de dominio, pero dejan de conocer detalles de Zustand donde exista una reaction explicita. Las operaciones sobre Notificaciones, Ventas y Servicios se exponen desde `store-reactions` con nombres de workflow, y los use-cases las llaman como un seam de cliente.

La UI no cambia en este corte.

## Criterio de cierre

- Menos imports directos de `@/store/*` dentro de `src/lib/use-cases/notificaciones`.
- Tests focalizados pasan.
- Suite completa, lint y build pasan.
- El backlog queda actualizado con el avance de Fase 0-4.

