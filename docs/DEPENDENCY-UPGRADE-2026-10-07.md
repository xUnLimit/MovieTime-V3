# Actualizacion de dependencias — 7 de octubre de 2026

Cierre de validacion local: 8 de octubre de 2026.

Estado: actualizaciones compatibles verificadas; ESLint 10 y la aprobacion de CI permanecen pendientes. No se hicieron commits, push ni despliegues.

## Base verificada

Se conservaron los cambios locales de Reportes, incluidos los archivos nuevos y la migracion de realtime. Antes de instalar se guardaron una copia de los archivos modificados, el diff y sus hashes fuera del repositorio. El estado inicial ya contenia Next 16.3.8 en `package.json` y `package-lock.json`.

La instalacion inicial se reprodujo con `CI=true npm ci`, usando el lockfile existente. `quality:full` paso: 498 archivos, 3423 pruebas; cobertura del diff de 100% de lineas, 100% de funciones y 94.74% de ramas. Pasaron build, 15 smoke, 2 pruebas de accesibilidad, 2 de rendimiento y Lighthouse (mediana de rendimiento 98, accesibilidad 100 y buenas practicas 100).

Los registros locales estan en `reports/dependency-upgrade/`, ignorado por Git. No contienen credenciales de Supabase. `quality-before.log` corresponde a la instalacion reproducida; la primera ejecucion restringida se detuvo porque npm no tenia acceso al registro y no cuenta como un gate aprobado.

## Grupos y compatibilidad

| Grupo | Version o estrategia verificada | Estado |
| --- | --- | --- |
| Node | 24.19.0 en `.nvmrc`, todos los workflows usan ese archivo; `@types/node` 24.19.1 | `quality:full` aprobado; no hizo falta corregir contratos |
| Next y React | Next y eslint-config-next 16.4.0; React y React DOM 19.3.0 | `quality:full` aprobado (3423 pruebas, build, smoke, accesibilidad y rendimiento) |
| Pruebas | Vitest/UI/cobertura 5.0.3; Vite 8.3.3; plugin React 6.1.2; jsdom 30.1.2; Playwright 1.64.0 | `quality:full` aprobado, 3423 pruebas; navegadores instalados |
| ESLint | 10 requiere que todos los plugins declaren soporte | Bloqueado: los peers publicados de react, import y jsx-a11y todavia excluyen ESLint 10 |
| TypeScript | Compilador nativo 7.0.2 y API compatible 6.0.2 mediante aliases oficiales | `quality:full` aprobado; 3423 pruebas, typecheck nativo 7 y checker Next compatibles |
| UI | Radix/radix-ui coordinados; Day Picker 10.0.2; Lucide 1.52.0 | `quality:full` aprobado (500 archivos/3434 pruebas), 11 regresiones Calendar/Dialog y matriz navegador 10/10 |
| Integraciones y tooling | Supabase JS 2.117.3 y CLI 2.120.0; ImapFlow 2.2.10; Mailparser 3.9.36; dotenv 18.0.6; Knip 6.40.0; plugin de seguridad 4.2.0 | `quality:full` aprobado desde npm ci (501 archivos/3436 pruebas), ademas de 38 casos dirigidos |

No se usan `--force`, `--legacy-peer-deps`, excepciones nuevas, reglas desactivadas ni umbrales reducidos.

Vitest 5 exige Vite >=6.4.0; el plugin React 6 exige Vite 8. jsdom 30 requiere al menos Node 24.15.0 dentro de la rama 24. Vitest limpia mocks antes de cada prueba: la comprobacion del import de `NotificationEventsInitializer` debe ejecutarse dentro del test, despues de esa limpieza. Los globs y umbrales de cobertura existentes se conservan. El fixture de localStorage se instala con vi.stubGlobal antes de cada prueba, porque Vitest 5 refleja los descriptores de Window y algunas suites restauran sus globals. Pasaron 498 archivos/3423 pruebas, cobertura baseline y diff, build, 15 smoke, 2 accesibilidad, 2 rendimiento y Lighthouse (mediana 90). Los tres motores de Playwright 1.64 se descargaron y sus ejecutables se verificaron.

TypeScript 7 no proporciona la API JavaScript. `typescript-eslint` admite TypeScript <6.1 y dependency-cruiser 18.5 utiliza esa API. La transicion oficial permite `typescript: npm:@typescript/typescript6@6.0.2` y `@typescript/native: npm:typescript@7.0.2`: `tsc` verifica con 7 y `tsc6` conserva los consumidores de API. Next resuelve el paquete raiz y su binario, por lo que su checker adicional usa 6; el gate obligatorio de aplicacion y pruebas debe comprobarse con 7. No se omite el chequeo del build ni se relaja `strict`. Se fija rootDir al repositorio y se declaran types node/react/react-dom; la cache del checker nativo es independiente de la de Next. El paquete de API publicado 6.0.2 identifica internamente su API y tsc6 como 6.0.3.

Calendar adopta month_grid, el locale extendido es de react-day-picker/locale y el WeekNumber consume su objeto interno sin propagarlo al DOM. Las pruebas reales cubren seleccion single/range, disabled, teclado, limites, foco controlado, dropdowns y week numbers. El Design Lab ahora incluye el calendario compartido para comprobarlo sin credenciales. Su dialogo usa el nuevo wrapper compartido DialogTrigger: la regresion comprueba apertura, Escape y restauracion del foco. La matriz en Chromium verifica cuatro combinaciones escritorio/movil tactil y claro/oscuro, calendario con teclado, selectores, menus, tabs, SVG, foco y axe sin impactos serios/criticos; tambien pasan las seis pruebas existentes de Chat/Reportes. Las ocho capturas calendar/dialog se inspeccionaron visualmente.

## Gates registrados

| Etapa | Registro local | Resultado |
| --- | --- | --- |
| Base reproducida | quality-before.log | PASS |
| Node y tipos | quality-node24.log | PASS |
| Next y React | quality-next-react-retry.log | PASS |
| Pruebas | quality-testing-retry.log | PASS |
| TypeScript separado | quality-typescript.log | PASS |
| UI | quality-ui.log | PASS |
| Integraciones y reproduccion final | quality-integrations-reproduced.log | PASS |
| Migraciones locales desde cero (162) | db-fresh-migrations.log | PASS |
| Invariantes y seguridad SQL | db-invariants.log | PASS |
| pgTAP/RLS (20 archivos, 590 assertions) | db-pgtap.log | PASS |
| Integracion (10 archivos, 30 pruebas) | db-integration.log | PASS |
| Build con autenticacion local | db-auth-build.log | PASS |
| E2E autenticado (67/67) | db-auth-e2e-retry.log | PASS |

El gate final incluye 501 archivos/3436 pruebas, cobertura baseline y diff (100% lineas, 100% funciones, 92.5% ramas del codigo cambiado), build, 15 smoke, 2 accesibilidad y 2 rendimiento. Lighthouse final: mediana de rendimiento 95, accesibilidad 100 y buenas practicas 100. No hay hallazgos de Knip ni warnings/errores de ESLint.

Next 16.4 genero automaticamente el cambio de nivel de encabezado en AGENTS.md (de # a ##) dentro de su bloque; las reglas del proyecto no se alteraron. Graphify se actualizo incrementalmente para 26 archivos, preservando nodos semanticos, fuentes ajenas, direccion y HTML; se uso la biblioteca existente porque update de esta CLI reextrae todo el codigo.

## Incidencias del entorno

La primera corrida de Next/React tuvo un timeout de 5000ms en una prueba de scripts mientras Docker Desktop devolvia errores 500 y no respondia a su reinicio normal. Otra ejecucion aislada fallo por timeout en una prueba distinta. Tras cerrar Docker, las 15 pruebas del archivo pasaron en 4.55s sin cambiar codigo ni tiempos limite. El gate completo repetido paso con 3423 pruebas; Lighthouse tuvo mediana 96 y accesibilidad/buenas practicas 100.

Se preparo un proyecto Supabase local aislado en `.superpowers/dependency-upgrade-db`, con nombre propio y puertos 544xx, para evitar resetear la base existente. La recuperacion del motor permitio aplicar desde cero 162 migraciones y ejecutar migrate:validate sin fallos de invariantes ni seguridad. pgTAP/RLS paso: 20 archivos y 590 assertions. Integracion paso: 10 archivos y 30 pruebas, sin skips. El build con credenciales locales tambien paso; El primer E2E autenticado no cuenta como aprobado: 48/67 casos pasaron y 19 fallaron en teardown porque faltaba E2E_DATABASE_CONTAINER para seleccionar el contenedor aislado. No se modificaron assertions ni fuentes. Tras limpiar exclusivamente scratch (57 catalogos de fixtures a 0), la repeticion completa con el override correcto paso: **67/67 casos, exit 0**, en 1.8 minutos. Los estados admin/operator originales se restauraron byte a byte y los artefactos nuevos con autenticacion se retiraron. Registros: db-auth-e2e-retry.log y resumen sanitizado de ambos intentos. No se hizo reset remoto ni se modifico produccion.

El arranque completo conserva un limite de Supabase CLI 2.120.0 en Windows: Vector queda unhealthy porque la implementacion npipe fija DOCKER_HOST al puerto TCP 2375, cerrado en este Docker Desktop. El resto de servicios necesarios para las pruebas esta saludable. No se expuso ese puerto, no se excluyo Vector ni se parcho el contenedor. La rama Unix monta el socket; CI sobre Linux debe verificar el stack completo. Evidencia: db-vector-compatibility.log y [fuente oficial de CLI 2.120.0](https://github.com/supabase/cli/blob/v2.120.0/apps/cli/src/commands/start/services/vector.service.ts#L119).

## Pendiente de braces

El registro sigue publicando braces 3.0.3 y el advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) no tiene version corregida. La cadena comprobada es `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces`, exclusivamente de desarrollo. Next 16.4 conserva fast-glob 3.3.1.

La excepcion existente vence el **1 de noviembre de 2026** y no se prorroga. Revisar nuevamente como maximo el **30 de octubre de 2026**, ademas de las auditorias nocturnas existentes (07:00 UTC) y Dependabot semanal. Si no hay correccion, el candidato evaluado es reemplazar el uso puntual de fast-glob en el plugin Next por tinyglobby mediante un parche o fork reproducible que preserve `globSync` y `expandDirectories: false`. Un alias directo o global no conserva el contrato y no se considera aprobado. La comparacion aislada de ocho casos detecto diferencias verificadas: tinyglobby agrega slash final a directorios, incluye el directorio base en apps/** y devuelve rutas relativas para un patron absoluto cuando no se fija absolute. El candidato necesita un adaptador que preserve esas tres conductas, ademas de expandDirectories: false. El caso Windows sin normalizar devuelve vacio en ambos; Next normaliza backslashes antes de llamar al glob. Por eso no se instala un alias ni se declara compatible un parche sin pruebas de getRootDirs real, auditorias y quality:full. La evidencia comparativa esta en braces-alternative-contract.json.

## Aprobacion

El lockfile final se reprodujo con CI=true npm ci --ignore-scripts, igual que los workflows. Se verificaron nuevamente tsc 7.0.2 y Supabase CLI 2.120.0. Las pruebas dirigidas de correo/Yappy y dotenv pasan (38 casos). dotenv conserva la precedencia entorno externo > .env.local > .env, incluyendo el archivo local ausente. La auditoria final de produccion reporta cero vulnerabilidades; el SBOM local CycloneDX contiene 941 componentes. Firefox y WebKit pasaron smoke real de calendario/dialogo, Escape y foco.

ESLint 9.39.5 permanece instalado porque los peers impiden una migracion soportada a 10; npm informa que la rama 9 ya no recibe soporte. Este pendiente no se resuelve forzando peers ni retirando plugins.

Los registros locales no reemplazan los jobs exigidos por `AGENTS.md`: CodeQL, SBOM, migraciones desde cero, pgTAP/RLS, integracion y E2E autenticado deben pasar en GitHub Actions sobre el cambio final. No se declara aprobado un PR sin esos resultados.

## Guias oficiales consultadas

- [Next 16.4](https://nextjs.org/blog/next-16-4) y las guias instaladas en `node_modules/next/dist/docs/`.
- [React 19.3](https://react.dev/blog/2026/09/09/react-19-3).
- [Migracion Vitest 5](https://vitest.dev/guide/migration/), [plugin React 6](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react@6.0.0), [jsdom](https://github.com/jsdom/jsdom/releases) y [Playwright 1.64](https://playwright.dev/docs/release-notes#version-164).
- [Migracion ESLint 10](https://eslint.org/docs/latest/use/migrate-to-10.0.0) y [compatibilidad typescript-eslint](https://typescript-eslint.io/users/dependency-versions/).
- [TypeScript 7 y aliases de compatibilidad](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- [Radix](https://www.radix-ui.com/primitives/docs/overview/releases), [Day Picker 10](https://daypicker.dev/upgrading) y [Lucide 1](https://lucide.dev/guide/version-1).
- [Supabase changelog](https://supabase.com/changelog), [CLI 2.120](https://github.com/supabase/cli/releases/tag/v2.120.0), [ImapFlow](https://github.com/postalsys/imapflow/blob/master/CHANGELOG.md), [Mailparser](https://github.com/nodemailer/mailparser/blob/master/CHANGELOG.md), [dotenv](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md), [Knip 6](https://knip.dev/blog/knip-v6) y [plugin de seguridad](https://github.com/eslint-community/eslint-plugin-security/releases).
