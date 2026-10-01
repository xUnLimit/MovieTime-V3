# ADR-0013: Gates de calidad, paridad con el CI y piramide de pruebas

**Status:** Accepted  
**Date:** 2026-09-30

## Context

`AGENTS.md` define "terminado" como `npm run quality:full` en verde, pero el CI enumeraba sus propios comandos y fue
divergiendo (p. ej. no ejecutaba `design:check`). Ademas las pruebas se concentraban en unitarias con mocks y en
e2e anonimos: nada ejercia RLS, idempotencia ni los recorridos de negocio contra una base real.

## Decision

1. **Paridad comprobada:** `npm run ci:parity` (job `static`) falla si un comando de `quality:full` no esta en CI (con
   equivalencias declaradas: `test:e2e|a11y|performance` = `test:browser`, `test:lighthouse` = accion de lighthouse)
   o si el CI ejecuta algo no documentado. Los controles solo de CI son: CodeQL, SBOM, `database` (migraciones desde
   cero, `supabase test db`, integracion), `e2e-authenticated` y los workflows `nightly`/`synthetic`.
2. **Piramide:**
   - Unitarias y de propiedades (`fast-check`) para logica pura y casos de uso.
   - Integracion contra Supabase local (`*.integration.test.ts`): RPC de pagos con idempotencia concurrente, rollback,
     reembolsos, vistas de chats, Realtime y autorizacion con usuarios reales.
   - pgTAP (`supabase/tests/database`) para RLS por rol y usuario activo/inactivo.
   - e2e: smoke anonimo (build de produccion), e2e autenticado con recorridos de negocio, accesibilidad en pantallas
     operativas y medicion automatica del estandar de tablas de `DESIGN.md`.
   - Mutacion (Stryker) y auditorias de dependencias en el workflow nocturno.
3. **Reglas como codigo:** dependency-cruiser (`arch:check`) para las capas de `AGENTS.md`, `module-size` (300 lineas),
   Knip (`dead-code`) y la inmutabilidad del historial de migraciones.
4. **Despliegue recuperable:** la promocion verifica el destino real de produccion, revierte ante fallo parcial y
   limpia el despliegue en cola que no llego a produccion.

## Consequences

- El "verde" del CI y de `quality:full` significan lo mismo y lo verifica una prueba.
- Las pruebas contra base real corren en CI (la maquina local puede no tener Docker).
- Hay mas jobs; los pesados (mutacion, regresion visual) quedan fuera del camino de PR.

## Alternatives Considered

- **Que el CI ejecute `quality:full` tal cual:** mezcla trabajo secuencial y reduce el paralelismo.
- **Mantener la paridad por revision manual:** es lo que fallo.
