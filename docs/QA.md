# Pruebas y gates de calidad

La definicion de terminado y los umbrales obligatorios viven en [`AGENTS.md`](../AGENTS.md). Este documento indica como ejecutar cada capa. En PowerShell, usa `npm.cmd` y `npx.cmd` si la politica de ejecucion bloquea los wrappers `.ps1`.

## Piramide de pruebas

| Capa | Proposito | Comando |
|---|---|---|
| Unitarias y propiedades | Helpers, ramas de casos de uso e invariantes con `fast-check` | `npm run test:coverage` o `npx vitest run <archivo>` |
| Integracion | RPC, autorizacion, rollback y proyecciones contra Supabase local | `npm run test:integration` |
| Base de datos | RLS, triggers e invariantes SQL con pgTAP | `npm run test:db` |
| Navegador publico | Smoke, accesibilidad y rendimiento sobre build de produccion | `npm run test:e2e`, `npm run test:a11y`, `npm run test:performance` |
| Navegador autenticado | Flujos operativos y permisos de roles | `npm run test:e2e:auth` |
| Mutacion | Comprueba que las pruebas detectan cambios en logica critica | `npm run test:mutation` |

La integracion y pgTAP requieren `npx supabase start` y Docker. Para integracion configura `INTEGRATION_SUPABASE_URL`, `INTEGRATION_SUPABASE_ANON_KEY` e `INTEGRATION_SUPABASE_SERVICE_ROLE_KEY` con los valores locales de `supabase status -o env`; nunca uses credenciales de produccion. El contrato de variables `E2E_*` del gate autenticado esta en `scripts/lib/auth-gate.mjs`. Las pruebas de navegador arrancan su propio servidor; consulta su script antes de ejecutarlas y deja libre el puerto configurado.

Stryker usa `stryker.config.mjs` y escribe resultados en `reports/mutation/`. Para comprobar solo un modulo: `npx stryker run --mutate src/platform/utils/calculations.ts`. La corrida completa es lenta y corresponde al control nocturno.

## PR, release y nocturno

- Durante el desarrollo: `npm run quality:fast`. El gate de PR debe incluir analisis estatico, arquitectura, tamano de modulos, paridad CI, Knip, cobertura y los jobs de navegador y base de datos. El E2E autenticado debe estar conectado al job correspondiente para bloquear el PR.
- Antes de declarar terminado: `npm run quality:full` desde un checkout reproducible y todos los jobs de GitHub Actions verdes. `coverage:baseline` impide una regresion global y `coverage:diff` verifica el codigo cambiado.
- Nocturno: mutacion, auditorias recurrentes de dependencias e informe de Knip en modo produccion. El resultado de mutacion sirve para reforzar las pruebas de logica critica.

`arch:check`, `module-size`, `ci:parity` y `coverage:baseline` son gates locales obligatorios. CodeQL, SBOM, migraciones desde cero, pgTAP, integracion con Supabase y E2E autenticado requieren el entorno de CI. Los jobs `database` y `e2e-authenticated` usan Supabase local; `nightly.yml` ejecuta mutacion y repite el E2E autenticado. Sus resultados solo pueden verificarse al correr GitHub Actions.

## Dependencias de interfaz

- `@xyflow/react` (React Flow): lienzo interactivo del editor de recorridos (nodos arrastrables, conexiones y teclado accesible) en `src/components/bot/flow/`. Escribirlo a mano sobre SVG exigiria reimplementar arrastre, zoom, conexiones y foco. Pasa `security:audit:prod` y `security:audit:all`; sus colores se enlazan a los tokens en `globals.css`.
