# ADR-0012: Politica de cobertura sobre todo el codigo

**Status:** Accepted  
**Date:** 2026-09-30

## Context

`vitest.config` no definia `coverage.include`. Con Vitest 4 y el proveedor v8, eso hace que el informe solo cuente los
archivos que algun test carga: los modulos nunca cargados no aparecian ni con 0 %. Medido el 2026-09-30 sobre todo
`src`: **54.6 % de lineas** y 319 de 748 archivos sin cargar, aunque los umbrales globales (80/70) pasaban.
Ademas `check-diff-coverage` solo evaluaba archivos presentes en el informe, omitia metricas con denominador cero,
ignoraba archivos nuevos sin rastrear y, sin base valida en CI, pasaba en vacio.

## Decision

- `coverage.include` cubre `src/**/*.{ts,tsx}`. Se excluyen solo tests, `src/test`, tipos (`*.d.ts`, `src/types`),
  `database.types.ts` generado y `src/app/design-lab` (herramienta de desarrollo sin login).
- Umbrales por area (nunca se bajan):
  - `application`, `platform`, `modules`: 80 % lineas/funciones/sentencias y 70 % ramas.
  - `src/proxy.ts` y `src/platform/server/request-auth.ts` (autenticacion): 90/80.
  - `store`, `components`, `app`, `hooks`: base igual al piso real medido, con regla de **no bajar**.
- `coverage-baseline.json` guarda el nivel por area; `npm run coverage:baseline` falla si algo baja y solo permite
  subir el baseline con un commit explicito (`--update`). La meta es subir la UI de forma gradual.
- `coverage:diff` exige 80/80/70 (90/90/80 en codigo critico: auth, pagos, reembolsos, RLS, migraciones) sobre el
  codigo cambiado, incluye archivos no rastreados, falla si un archivo cambiado falta en el informe y nunca pasa en
  vacio en CI (base robusta: `COVERAGE_BASE` -> merge-base con `origin/main` -> `HEAD~1`).

## Consequences

- El numero de cobertura representa el repositorio real; el piso de la UI es bajo pero no puede empeorar.
- Un cambio sin pruebas falla aunque el global siga alto.
- Subir el baseline es un acto deliberado y revisable.

## Alternatives Considered

- **80 % global inmediato:** haria fallar el CI hasta escribir cientos de pruebas de UI; se prefiere ratchet.
- **Excluir la UI de la metrica:** esconde el riesgo; la UI se cubre ademas con e2e autenticados.
- **Dejar `include` vacio:** el estado anterior, con cifras infladas.
