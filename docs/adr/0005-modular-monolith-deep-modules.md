# ADR-0005: Arquitectura Modular Monolitica Con Modulos Profundos

**Status:** Accepted  
**Date:** 2026-05-22

## Context

MovieTime no necesita una reescritura ni microservicios. El sistema ya tiene decisiones valiosas: Supabase/Postgres, RPCs atomicas, activity log, PWA offline read support y estructura por carpetas.

El problema principal no es falta de capas, sino modulos poco profundos o demasiado concentrados. Algunas interfaces son pass-through y otras, como `ventas-use-cases.ts`, concentran demasiada implementacion.

## Decision

La ruta enterprise sera una arquitectura modular monolitica:

- modulos profundos por dominio;
- interfaces publicas pequenas;
- implementacion concentrada detras de cada interface;
- adapters tipados para IO;
- tests por contrato del modulo;
- ADRs para decisiones que cambien reglas arquitecturales.

Modulos objetivo:

- `payments`
- `notifications`
- `dashboard-read-models`
- `ventas`
- `servicios`
- `domain-events`

## Consequences

- No se hara una reescritura completa.
- No se agregaran abstracciones genericas sin dos adapters reales o una razon concreta.
- La descomposicion se hara por vertical slices cubiertas por tests.
- El objetivo no es solo bajar lineas, sino mejorar locality y leverage.

## Alternatives Considered

- **Reescritura completa:** rechazada por riesgo operativo y porque la base actual tiene decisiones correctas.
- **Clean Architecture estricta en todo el repo:** rechazada si introduce ceremonias sin profundidad real.
- **Parches puntuales sin modulos:** rechazado porque no resuelve la dispersion de reglas.
