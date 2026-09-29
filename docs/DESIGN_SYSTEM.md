# MovieTime PTY - Design System

> **Este documento fue reemplazado por [`DESIGN.md`](../DESIGN.md) (raiz del repositorio).**
>
> `DESIGN.md` es la unica fuente de verdad visual: identidad, tokens de color, escala tipografica, alturas de control, layout, componentes canonicos, estados, accesibilidad y cumplimiento. No dupliques reglas aqui; cualquier cambio de politica visual se hace alli.

## Que sigue viviendo fuera de DESIGN.md

Las reglas de ownership de datos y arquitectura de UI (no son visuales) se mantienen en:

- [`AGENTS.md`](../AGENTS.md): reglas obligatorias de ingenieria (React Query para lecturas remotas, Zustand para estado UI, sin Supabase desde componentes, modulos < 300 lineas).
- [`docs/adr/0002-react-query-zustand-ownership.md`](adr/0002-react-query-zustand-ownership.md): ownership de datos.
- [`docs/adr/0004-typed-client-events.md`](adr/0004-typed-client-events.md): eventos tipados.
- [`docs/adr/0005-modular-monolith-deep-modules.md`](adr/0005-modular-monolith-deep-modules.md): modulos profundos.

## Cumplimiento automatico

`npm run design:check` (`scripts/check-design-tokens.mjs`) corre en `quality:fast` y `quality:full` y falla ante colores de paleta cruda, hexadecimales en clases, tamanos de fuente fuera de la escala 12/14/16/20 o pesos distintos de normal/medium/semibold.
