# Auditoria tecnica y arquitectonica completa

**Proyecto:** MovieTime PTY / MovieTime Supabase  
**Fecha:** 2026-05-29  
**Rol de evaluacion:** Software Architect Senior, Tech Lead y Auditor Tecnico  
**Alcance:** revision estatica del repositorio, documentacion vigente, ADRs, scripts, migraciones Supabase, estructura de frontend, capa de dominio, seguridad, testing, CI/CD, observabilidad y validaciones ejecutables.

---

## 1. Resumen ejecutivo

MovieTime PTY es una aplicacion Next.js 16 / React 19 / TypeScript con Supabase como backend transaccional. La arquitectura observada corresponde a un monolito modular con separacion explicita entre UI, hooks de lectura, casos de uso, repositorios/adapters Supabase, modulos profundos de dominio y migraciones SQL.

El estado general es **bueno y superior al promedio para un proyecto de este tamano**. El sistema tiene decisiones arquitectonicas documentadas en ADRs, validaciones automatizadas, migraciones de seguridad, tests unitarios y de contrato, scripts de migracion, escaneo de secretos, headers de seguridad, CSP y separacion progresiva entre React Query y Zustand.

La principal conclusion es que el proyecto ya salio de una etapa de refactor correctivo y se encuentra en una etapa de **consolidacion enterprise**. Los riesgos actuales no apuntan a una reescritura, sino a cerrar brechas especificas: cobertura desigual, ausencia de CI/CD versionado en el repo, observabilidad limitada, dependencia operativa de Supabase/SQL sin pruebas RPC locales completas, algunos modulos UI grandes, casts de interoperabilidad en Supabase, y un modelo de seguridad single-tenant que debe mantenerse como decision explicita.

### Veredicto global

| Dimension | Estado | Evaluacion |
|---|---:|---|
| Arquitectura general | Buena | Monolito modular bien encaminado, con ADRs y modulos profundos claros. |
| Calidad de codigo | Buena | TypeScript strict, lint limpio salvo warnings, separacion por dominio razonable. |
| Seguridad | Buena con condicion | Buen hardening y validaciones; el modelo RLS single-tenant limita la escalabilidad de permisos. |
| Testing | Medio | 294 tests pasan, pero cobertura global apenas supera umbrales bajos. |
| Escalabilidad tecnica | Media-alta | Buena base por read models/RPCs, con riesgos en observabilidad, datos y jobs. |
| Mantenibilidad | Buena | Mejorada por ADRs y modulos; quedan componentes grandes y stores legacy de compatibilidad. |
| Observabilidad | Baja-media | Hay logging con `console.*`, pero no hay logger estructurado, tracing o monitoreo de errores integrado. |
| CI/CD | Bajo | No se observo `.github/workflows`; validaciones existen pero no estan automatizadas en el repo. |
| Documentacion | Alta | README, CONTEXT, ADRs, planes y auditorias previas abundantes. |

### Riesgos mas importantes

1. **CI/CD no versionado:** los comandos de calidad existen, pero no hay workflows en `.github/workflows` dentro del repo.
2. **Cobertura global limitada:** coverage pasa, pero con umbrales globales de 45-48% y zonas criticas con 0-30%.
3. **Observabilidad insuficiente:** errores se registran con `console.error/warn`, sin correlation id, logger central ni envio a una plataforma.
4. **Modelo single-tenant:** valido por ADR-0006, pero riesgoso si el producto crece a multiusuario real o roles operativos.
5. **Complejidad residual en UI y Supabase adapters:** hay componentes/controladores grandes y uso recurrente de `Record<string, unknown>` / casts por limites de tipos Supabase.

---

## 2. Evidencia de auditoria

### 2.1 Comandos ejecutados

| Comando | Resultado |
|---|---|
| `git status --short` | Sin cambios antes de crear este informe. |
| `npm run lint` | Pasa con 2 warnings de `react-hooks/exhaustive-deps`. |
| `npm test -- --run` | Pasa: 78 archivos, 294 tests. |
| `npm run test:coverage` | Pasa contra umbrales configurados. Cobertura global: statements 46.13%, branches 36.82%, functions 42.59%, lines 49.46%. |
| `npm run build` | Pasa. Next.js 16.2.4 compila, TypeScript OK, rutas generadas OK. |
| `npm run secrets:scan` | Pasa sin hallazgos. |
| `npm run env:validate` | Pasa fuera del sandbox; dentro del sandbox fallo por `spawn EPERM` de esbuild/tsx. |
| `npm run migrate:validate` | Pasa. Validaciones de datos y seguridad Supabase sin bloqueos. |

### 2.2 Metricas de repositorio observadas

| Metrica | Valor observado |
|---|---:|
| Archivos TypeScript/TSX en `src` | 646 |
| Lineas aproximadas TS/TSX medidas | 58,534, con advertencia de rutas dinamicas `[...]` en PowerShell durante el conteo |
| Archivos de test | 78 ejecutados por Vitest |
| Tests | 294 |
| Migraciones Supabase | 82 |
| Lineas SQL aproximadas en migraciones | 10,382 |
| Documentos Markdown en `docs` | 35 |
| Directorios bajo `src` | 111 |

### 2.3 Stack observado

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 16.2.4 App Router |
| UI | React 19.2.3, Tailwind CSS 4, Radix UI, shadcn-like components |
| Estado servidor | TanStack React Query 5 |
| Estado cliente | Zustand 5 |
| Formularios | React Hook Form, Zod |
| Backend | Supabase Auth, Postgres, RLS, RPCs, migrations SQL |
| Tests | Vitest 4, Testing Library, jsdom, coverage v8 |
| Seguridad app | Headers en `next.config.ts`, CSP en `src/proxy.ts`, secret scan |
| Deploy potencial | Vercel presente por `.vercel`, pero sin workflow CI/CD versionado |

---

## 3. Arquitectura actual

### 3.1 Forma arquitectonica

El sistema opera como un **monolito modular frontend/backend-as-a-service**, donde:

```txt
Next.js App Router / UI
  -> Hooks de React Query para lecturas remotas
  -> Zustand para estado UI, autenticacion cliente, filtros, PWA y compatibilidad
  -> Casos de uso por dominio
  -> Modulos profundos de negocio
  -> Repositories / RPC adapters tipados
  -> Supabase Auth + Postgres + RLS + RPC + triggers + views
```

Esta forma coincide con las reglas en `CONTEXT.md` y con los ADRs:

- ADR-0001: dashboard como read model de Postgres.
- ADR-0002: React Query para lecturas, Zustand para estado UI.
- ADR-0003: RPCs criticas con adapters tipados e idempotencia.
- ADR-0004: eventos cliente tipados.
- ADR-0005: monolito modular con modulos profundos.
- ADR-0006: modelo RLS single-tenant administrativo.
- ADR-0007: migracion final de stores remotos a React Query.

### 3.2 Fortalezas arquitectonicas

- La fuente de verdad esta clara: Supabase/Postgres.
- Las operaciones criticas de ventas, servicios, pagos y refunds tienen RPCs y adapters.
- La idempotencia esta modelada para RPCs criticas mediante migraciones recientes.
- El dashboard no intenta mutar metricas derivadas desde cliente.
- Hay modulos profundos identificables: `payments`, `notifications`, `dashboard-read-models`, `forecasting`, `events`, `use-cases/ventas`, `use-cases/servicios`.
- Hay reglas de arquitectura documentadas y tests de fronteras, por ejemplo `src/lib/architecture-boundaries.test.ts`.
- La documentacion no es decorativa: ADRs, CONTEXT y roadmap reflejan decisiones que el codigo actual respeta en gran medida.

### 3.3 Debilidades arquitectonicas

- La separacion React Query/Zustand esta bastante avanzada, pero aun hay dependencias directas desde UI/app hacia stores para auth, PWA, dashboard filter y WhatsApp queue.
- Algunos modulos de UI siguen siendo grandes y con alta carga cognitiva.
- `src/lib/supabase` conserva interfaces genericas y casts necesarios por limites de tipos, pero eso reduce seguridad estatica.
- No hay una capa formal de observabilidad transversal.
- CI/CD no esta declarado en el repo, por lo que las reglas de calidad dependen de ejecucion local o configuracion externa no auditada.

---

## 4. Evaluacion global por categoria

### 4.1 Evaluacion tecnica global

**Calificacion:** 8/10

El proyecto tiene una base tecnica solida:

- TypeScript `strict: true`.
- `npm run build` pasa.
- `npm run lint` pasa sin errores.
- Tests pasan.
- Coverage pasa contra umbrales.
- Migraciones Supabase validadas.
- Secret scan limpio.
- Documentacion abundante.

Las razones para no asignar una calificacion mayor son:

- Cobertura global baja para un sistema financiero/operacional.
- Falta de CI/CD versionado.
- Observabilidad insuficiente.
- Componentes y controladores grandes.
- Modelo RLS intencionalmente simple.

### 4.2 Evaluacion arquitectonica

**Calificacion:** 8.2/10

La arquitectura es coherente y documentada. El proyecto evita dos errores frecuentes: no intenta convertir todo en microservicios y no introduce Clean Architecture ceremonial sin necesidad. El enfoque de monolito modular es correcto para el dominio.

La arquitectura gana profundidad cuando un modulo concentra reglas detras de una interfaz pequena, por ejemplo:

- `src/lib/payments`
- `src/lib/dashboard-read-models`
- `src/lib/forecasting`
- `src/lib/events`
- `src/lib/notifications`
- `src/lib/use-cases/ventas`
- `src/lib/use-cases/servicios`

La deuda principal ya no es estructural global, sino de terminacion: cerrar las superficies legacy, subir cobertura donde hay comportamiento de negocio y automatizar controles.

### 4.3 Calidad de estructura

**Calificacion:** 8/10

La estructura por carpetas es clara:

- `src/app`: rutas, layouts, API routes.
- `src/components`: UI por dominio y compartida.
- `src/hooks`: hooks de lectura y orquestacion de cache.
- `src/lib/use-cases`: flujos de negocio.
- `src/lib/supabase`: repositorios, adapters, tipos y utilidades IO.
- `src/lib/payments`: pagos, moneda y calculos.
- `src/lib/notifications`: sync, calculo, cleanup y push.
- `src/lib/pwa`: soporte offline/PWA.
- `src/store`: estado cliente.
- `supabase/migrations`: modelo de datos, RLS, RPCs, triggers.

Riesgo: hay mucha profundidad de carpetas en detalle de ventas/servicios. Esto es aceptable para dominios complejos, pero debe cuidarse para no fragmentar comportamiento en demasiadas piezas shallow.

### 4.4 Calidad de codigo

**Calificacion:** 7.8/10

Puntos positivos:

- TypeScript estricto.
- Uso de Zod en formularios y env.
- Factores de dominio separados.
- Buen uso de tests unitarios para helpers y modulos de negocio.
- Lint sin errores.

Puntos a mejorar:

- 2 warnings de hooks en `src/components/shared/pago-dialog/usePagoDialogController.ts`.
- Uso recurrente de `Record<string, unknown>` y `as unknown as` en interoperabilidad Supabase.
- Logging directo con `console.error/warn`.
- Componentes UI grandes que mezclan presentacion, orquestacion y reglas de pantalla.

---

## 5. Evaluacion por modulos

### 5.1 `src/app`

**Estado:** Bueno  
**Responsabilidad:** rutas Next.js App Router, layouts, paginas, API routes, error boundaries.

Fortalezas:

- App Router organizado por grupos `(auth)` y `(dashboard)`.
- Rutas dinamicas para detalles y edicion.
- API routes de push separadas por caso: `daily`, `pending`, `subscriptions`, `test`.
- Error boundaries globales y de dashboard.
- Build genera correctamente las rutas dinamicas.

Riesgos:

- Varias paginas son client-heavy y delegan a controladores/hooks internos.
- Algunos detalles de venta/servicio tienen muchas piezas locales bajo rutas, lo que puede dificultar reutilizacion.
- API routes sensibles dependen de service role y validacion manual; actualmente bien encapsulado, pero requiere disciplina.

Recomendaciones:

- Mantener paginas como orquestadores delgados.
- Evitar que nuevas reglas de negocio entren a `page.tsx`.
- Agregar tests de integracion API para rutas con service role y auth admin.

### 5.2 `src/components`

**Estado:** Medio-bueno  
**Responsabilidad:** componentes de UI de dominio y compartidos.

Fortalezas:

- Componentes por dominio: ventas, servicios, terceros, categorias, notificaciones, dashboard.
- Componentes compartidos: tablas, dialogs, error boundaries, metric cards, pagination.
- Uso de Radix/shadcn-like components.
- Hay tests para formularios y helpers importantes.

Problemas:

- Algunos componentes y controladores superan tamanos razonables:
  - `ServicioProfilesSection.tsx`
  - `VentaReembolsoDialog.tsx`
  - `ServicioTransferVentaDialog.tsx`
  - `TemplateEditor.tsx`
  - `usePagoDialogController.ts`
  - `NotificationBell.tsx`
- Varias pantallas mezclan UI, estados transitorios, validaciones de accion y side effects.
- Coverage en UI es desigual; por ejemplo formularios de ventas tienen cobertura baja.

Riesgo:

- Cambios pequenos en flujos complejos pueden introducir regresiones visuales o de estado no cubiertas.

Recomendaciones:

- Extraer controladores por caso de uso de pantalla cuando haya mas de una responsabilidad.
- Elevar tests de flujos clave: crear venta, editar venta, registrar pago, refund, transferencia de servicio.
- Evitar seguir creciendo dialogs multiaccion; dividir por workflow.

### 5.3 `src/hooks`

**Estado:** Bueno  
**Responsabilidad:** lecturas remotas, cache, queries, paginacion, hooks de dominio.

Fortalezas:

- Uso amplio de React Query.
- `queryKeys` centralizadas.
- Hooks especificos por dominio.
- `useServerPagination` centraliza paginacion remota.

Riesgos:

- Algunos hooks tambien manejan optimismo o reacciones complejas.
- Hay dependencia conceptual entre hooks, store reactions y query invalidation.

Recomendaciones:

- Mantener hooks de lectura puros cuando sea posible.
- En mutaciones, preferir use-cases + invalidacion centralizada.
- Documentar excepciones donde hooks hagan optimismo complejo.

### 5.4 `src/store`

**Estado:** Medio-bueno  
**Responsabilidad:** estado UI, auth client, PWA, filtros, colas/toasts y compatibilidad.

Fortalezas:

- Los tests confirman que stores de ventas/servicios ya no exponen `fetchVentas`, `fetchServicios` ni `fetchCounts`.
- Busqueda en `src/store` no muestra imports directos a repositorios Supabase.
- La direccion ADR-0007 se respeta en gran parte.

Riesgos:

- `authStore` sigue siendo un modulo central con responsabilidades sensibles: session, login, logout, offline restore.
- Stores aun aparecen en UI y algunos helpers de `lib`, por ejemplo auth, PWA y activity log.
- `notificacionesStoreHelpers` conserva funciones de compatibilidad para counts.

Recomendaciones:

- Mantener Zustand limitado a UI/offline/client state.
- Auditar trimestralmente que no vuelvan imports Supabase a stores.
- Reducir `authStore` separando auth session, profile loading y offline restore si crece mas.

### 5.5 `src/lib/use-cases`

**Estado:** Bueno  
**Responsabilidad:** orquestacion de negocio y flujos compuestos.

Fortalezas:

- Ventas y servicios estan divididos en queries, writes, payments, refunds/detail.
- Notificaciones tiene use-cases por acciones, query, renewal y reposo.
- Hay tests relevantes para ventas, servicios, terceros, notificaciones, categorias y metodos de pago.

Riesgos:

- Algunos archivos legacy agregados aun existen, como `ventas-use-cases.test.ts` y `servicios-use-cases.test.ts`, aunque el runtime parece usar modulos especificos.
- Cobertura en `lib/use-cases` raiz es baja por archivos no cubiertos o de compatibilidad.

Recomendaciones:

- Marcar explicitamente archivos agregados legacy como test-only/compat si aplican.
- Evitar nuevos agregadores de use-cases.
- Definir contratos publicos por dominio y probarlos como interfaz estable.

### 5.6 `src/lib/supabase`

**Estado:** Bueno con deuda tecnica controlada  
**Responsabilidad:** cliente Supabase, database types, repositorios, mappers, read models, RPC adapters, paginacion.

Fortalezas:

- `database.types.ts` generado y presente.
- RPC adapters especificos para ventas, servicios, payments, categorias y dashboard.
- `record-core`, mappers y write utils centralizan normalizacion snake/camel.
- Tests para adapters RPC, idempotency, read-models y write-utils.

Problemas:

- Cobertura global del directorio es baja: statements 25.22%, branches 10.69%, functions 13.05%, lines 29.84%.
- Hay bastantes casts `as unknown as` y `Record<string, unknown>`.
- `record-core` es potente pero puede funcionar como modulo demasiado generico si crece sin contratos por dominio.

Riesgos:

- Drift entre migraciones SQL, `database.types.ts` y adapters puede causar fallos runtime.
- Tipos genericos pueden ocultar cambios de schema hasta produccion si no hay tests RPC/integracion.

Recomendaciones:

- Regenerar tipos Supabase como paso obligatorio tras migraciones.
- Agregar pruebas de contrato para RPCs criticas con payload/resultado reales.
- Reducir casts en adapters mas sensibles: ventas, servicios, pagos, refunds.

### 5.7 `src/lib/payments`

**Estado:** Muy bueno  
**Responsabilidad:** calculos de pago, moneda, factories, modulo financiero.

Fortalezas:

- Cobertura alta: statements 89.23%, lines 90.9%.
- Modulo profundo con interfaz clara.
- Tests especificos para calculator, factory y financial module.

Riesgos:

- Depende de `currencyService`, cuyo coverage es muy bajo por estar en `src/lib/services`.
- La integracion con tasas externas debe observarse mejor.

Recomendaciones:

- Mantener pagos como modulo canonical para moneda y montos.
- Subir coverage del servicio de tasas o aislarlo detras de adapter testeable.

### 5.8 `src/lib/services`

**Estado:** Bajo-medio  
**Responsabilidad:** servicios operacionales, especialmente currency.

Problemas:

- Coverage muy bajo: statements 4.5%, lines 4.8%.
- `currencyService.ts` es largo y con mucho comportamiento: cache, fetch externo, Supabase, fallback, conversion.
- Uso de `console.warn` ante errores o fallback.

Riesgos:

- La conversion monetaria puede degradarse silenciosamente a 1.0.
- Fallos de proveedor externo pueden afectar calculos financieros sin trazabilidad suficiente.

Recomendaciones:

- Separar adapter externo, cache repository y politica de fallback.
- Agregar tests de fallos de red, cache stale, monedas faltantes y persistencia.
- Emitir eventos/logs estructurados cuando se usa fallback.

### 5.9 `src/lib/notifications`

**Estado:** Medio-bueno  
**Responsabilidad:** calculo, sync, cleanup, bulk/surgical sync, push delivery helpers.

Fortalezas:

- Modulo explicito con pruebas para calculator, cleanup y sync behavior.
- Cobertura pasa el umbral configurado: statements 50%, lines 51.37%.
- Separacion de venta/servicio/reposo notification sync.

Problemas:

- `notification-bulk-sync.ts`, `notification-event-listeners.ts`, `notification-sync-orchestrator.ts` y `notification-sync-state.ts` tienen cobertura muy baja o cero.
- Logging con `console.error/warn`.

Riesgos:

- Errores parciales de sync podrian pasar desapercibidos.
- Sin observabilidad, es dificil reconstruir por que una notificacion no se genero o no se envio.

Recomendaciones:

- Agregar tests a orchestrator y event listeners.
- Registrar sync runs o estados relevantes en DB o logger central.
- Establecer metricas: notificaciones generadas, descartadas, fallidas y reintentadas.

### 5.10 `src/lib/dashboard-read-models` y `src/lib/forecasting`

**Estado:** Muy bueno  
**Responsabilidad:** lecturas de dashboard y pronostico financiero.

Fortalezas:

- `dashboard-read-models`: statements 86.66%, lines 92.85%.
- `forecasting`: statements 92.1%, lines 97.05%.
- Alineado con ADR-0001.
- El dashboard se modela como lectura, no como mutacion cliente.

Riesgos:

- Dependencia fuerte en SQL/RPCs; se necesitan pruebas de integracion para garantizar compatibilidad de shape.

Recomendaciones:

- Mantener tests de mapeo.
- Agregar snapshot/contract tests para payloads RPC reales si existe entorno local Supabase.

### 5.11 `src/lib/pwa`

**Estado:** Medio  
**Responsabilidad:** soporte offline, service worker, sync, push client.

Fortalezas:

- Hay modulo explicito para offline/PWA.
- Tests en auth offline, helpers, push schedule, push helpers y sync.
- La regla de dominio indica que mutaciones requieren online mode.

Problemas:

- Coverage moderada: statements 53.66%, branches 41.93%, lines 55.6%.
- `offline-copy.ts`, `offline-db.ts`, `offline-read.ts` tienen 0% en el reporte.
- La PWA puede volverse fuente de bugs de consistencia si crecen capacidades offline.

Recomendaciones:

- Cubrir IndexedDB/offline read con mocks o fake adapter.
- Mantener explicitamente prohibidas las mutaciones offline salvo diseno nuevo.
- Documentar estrategia de expiracion de copia offline.

### 5.12 `src/lib/events` y `src/lib/store-reactions`

**Estado:** Mixto  
**Responsabilidad:** eventos cliente tipados e invalidaciones/reacciones.

Fortalezas:

- `StoreEventBus` tiene cobertura 100%.
- ADR-0004 reduce acoplamiento con DOM/localStorage.
- Reacciones de cache estan separadas.

Problemas:

- `store-reactions` tiene coverage bajo: statements 20%, branches 13.11%, lines 20.51%.
- Es una zona critica para consistencia de UI tras mutaciones.

Riesgos:

- Regresiones de invalidacion pueden dejar UI stale sin fallar tests.

Recomendaciones:

- Crear tests de contrato por evento: input event -> queries invalidadas.
- Mantener `StoreEventBus` como interfaz unica; evitar volver a DOM events.

### 5.13 `supabase/migrations`

**Estado:** Bueno  
**Responsabilidad:** schema, indexes, views, triggers, RLS, RPCs, seed, hardening.

Fortalezas:

- 82 migraciones versionadas.
- Validacion `migrate:validate` pasa.
- Validaciones de seguridad pasan:
  - `rls_disabled_app_tables`: 0
  - `required_rpc_executable_by_anon`: 0
  - `security_definer_executable_by_anon`: 0
  - `security_definer_missing_search_path`: 0
  - `required_rpc_missing_authenticated_execute`: 0
  - `unapproved_security_definer_executable_by_authenticated`: 0
- Hay hardening reciente de anon grants, security definer y notification views.

Observaciones:

- Existe reporte aceptable `ventas_archivadas_activas: 7`. No bloquea porque esta codificado como aceptable.
- Esto debe considerarse deuda de datos aceptada, no ausencia de problema.

Riesgos:

- El modelo SQL/RPC concentra reglas criticas; cualquier drift entre DB y TypeScript impacta fuerte.
- Sin CI que corra validaciones contra un entorno Supabase reproducible, el control depende del entorno local.

Recomendaciones:

- Mantener `migrate:validate` como gate obligatorio.
- Evaluar test DB local con Supabase CLI para RPCs criticas.
- Eliminar o resolver progresivamente `ventas_archivadas_activas` aceptadas si el dominio lo permite.

---

## 6. Seguridad

### 6.1 Estado actual

**Calificacion:** 8/10 bajo modelo single-tenant administrativo.

Fortalezas:

- `.env*` ignorado en `.gitignore`.
- Secret scan pasa.
- `SUPABASE_SERVICE_ROLE_KEY` documentado como server/script only.
- API routes con service role usan `requireAuthenticatedAdmin`.
- `next.config.ts` define headers:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - HSTS
  - Referrer Policy
  - COOP
  - DNS prefetch off
  - Permissions Policy
- `src/proxy.ts` genera CSP con nonce, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` restringido.
- Supabase security validation pasa sin RPCs sensibles abiertas a anon.
- RLS esta activo segun validacion.

### 6.2 Riesgos de seguridad

| Riesgo | Severidad | Comentario |
|---|---:|---|
| Modelo single-tenant | Alta si cambia el producto | RLS authenticated-wide es aceptable solo bajo ADR-0006. |
| Service role en API routes | Media | Correcto si todas las rutas validan admin antes de usarlo. |
| Datos sensibles de servicios | Media-alta | El dominio maneja correos/contrasenas/codigos de servicios; requiere cuidado en logs/UI. |
| Logging sin sanitizacion central | Media | Hay `console.error` con objetos; puede filtrar payloads sensibles. |
| CSP con `unsafe-inline` para styles | Baja-media | Habitual en Next/Tailwind, pero sigue siendo relajacion. |
| Dependencia externa de tasas | Media | Necesita timeouts, fallback observable y validacion. |

### 6.3 Recomendaciones de seguridad

Prioridad alta:

1. Agregar CI que ejecute `secrets:scan`, lint, tests, build y migracion validation.
2. Crear logger central con redaccion de campos sensibles: passwords, tokens, auth, endpoint push, p256dh.
3. Mantener ADR-0006 visible: cualquier requerimiento multiusuario debe reabrir RLS.

Prioridad media:

1. Tests de autorizacion para API routes con service role.
2. Revision de logs para evitar imprimir datos de servicio o credenciales.
3. Politica de rotacion de claves VAPID, Supabase anon/service role y cron secrets.

---

## 7. Rendimiento y escalabilidad

### 7.1 Estado actual

**Calificacion:** 7.5/10

Fortalezas:

- React Query aporta cache, deduplicacion e invalidacion.
- Dashboard y pronostico usan read models/RPCs en lugar de calculos completos en UI.
- Supabase tiene indexes y views en migraciones.
- Build usa Turbopack y compila correctamente.
- Paginacion server-side existe.

### 7.2 Riesgos de rendimiento

| Riesgo | Severidad | Detalle |
|---|---:|---|
| Read models dependientes de RPCs | Media | Correcto, pero necesita monitoreo de latencia y planes de query. |
| Invalidaciones amplias | Media | Algunas reacciones invalidan dominios completos; puede escalar mal. |
| Componentes client-heavy | Media | Muchas rutas son dinamicas y cliente intensivo. |
| PWA/offline sync | Media | Puede crecer en complejidad y costo si se amplian mutaciones offline. |
| Currency service externo | Media | Llamadas externas y fallback pueden afectar experiencia y precision. |

### 7.3 Recomendaciones de rendimiento

1. Medir RPCs principales con `EXPLAIN ANALYZE` en datasets representativos.
2. Registrar latencia por endpoint/RPC en observabilidad.
3. Revisar invalidaciones broad por evento y reemplazar por query keys mas granulares donde sea seguro.
4. Agregar tests/perfiles para listas grandes de ventas, servicios, terceros y notificaciones.
5. Definir presupuestos de bundle y revisar componentes pesados como charts/dialogs.

---

## 8. Mantenibilidad, desacoplamiento y cohesion

### 8.1 Nivel de desacoplamiento

**Evaluacion:** Bueno, con acoplamientos intencionales.

Acoplamientos positivos:

- UI -> hooks/use-cases.
- Use-cases -> repositories/adapters.
- Adapters -> Supabase.
- Eventos -> invalidacion sin DOM events.
- Payments como modulo canonical.

Acoplamientos a vigilar:

- UI -> stores para auth/PWA/WhatsApp/filtros.
- `lib/services/currencyService` -> fetch externo + Supabase + cache + policy.
- `src/lib/supabase/record-core` -> generico multi-entidad.
- Store reactions -> query keys multiples.

### 8.2 Nivel de cohesion

**Evaluacion:** Bueno.

Alta cohesion:

- `payments`
- `forecasting`
- `dashboard-read-models`
- `events`
- `use-cases/servicios`
- `use-cases/ventas`

Cohesion media:

- `notifications`: buen modulo, pero con orchestration/sync/event listeners parcialmente cubiertos.
- `pwa`: responsabilidades relacionadas, pero complejas.
- `services`: currency concentra varias responsabilidades.

Cohesion baja o a vigilar:

- Componentes/controladores UI grandes.
- Reacciones/invalidation si siguen creciendo.

### 8.3 Deuda tecnica principal

| Item | Severidad | Tipo |
|---|---:|---|
| CI/CD ausente en repo | Alta | Operacional |
| Coverage global baja | Alta | Calidad |
| Observabilidad limitada | Alta | Operacional |
| Currency service poco testeado | Media-alta | Dominio/rendimiento |
| Stores legacy/compat residuales | Media | Arquitectura |
| Componentes UI grandes | Media | Mantenibilidad |
| Casts Supabase y `Record<string, unknown>` | Media | Type safety |
| `ventas_archivadas_activas` aceptadas | Media | Datos/dominio |
| Warnings hooks en pago dialog | Baja-media | Calidad |

---

## 9. Testing

### 9.1 Estado actual

**Calificacion:** 6.8/10

Resultados:

- 78 archivos de test pasan.
- 294 tests pasan.
- Coverage global:
  - Statements: 46.13%
  - Branches: 36.82%
  - Functions: 42.59%
  - Lines: 49.46%

Umbrales configurados:

- Statements: 45
- Branches: 36
- Functions: 42
- Lines: 48

Esto significa que el proyecto **pasa por poco** a nivel global. Algunos modulos criticos tienen umbrales altos y cumplen, lo cual es positivo. Pero el promedio global todavia es bajo para un sistema con dinero, pagos, reembolsos, credenciales y notificaciones.

### 9.2 Zonas fuertes

- `src/lib/payments`: alta cobertura.
- `src/lib/dashboard-read-models`: alta cobertura.
- `src/lib/forecasting`: alta cobertura.
- `src/lib/events`: alta cobertura.
- `src/lib/use-cases/notificaciones`: alta cobertura.
- Tests de adapters RPC e idempotency presentes.

### 9.3 Zonas debiles

- `src/lib/services`: coverage muy bajo.
- `src/lib/supabase`: coverage bajo.
- `src/lib/store-reactions`: coverage bajo.
- `src/lib/pwa`: coverage media y varios archivos en cero.
- `components/ventas` y flows de formularios: coverage baja.
- Orquestadores de notificaciones: coverage baja o cero en algunos archivos.

### 9.4 Recomendaciones de testing

Prioridad alta:

1. Subir umbral global progresivamente a 60% lines/statements.
2. Agregar tests de contrato para:
   - crear venta con pago inicial;
   - registrar pago de venta;
   - refund;
   - crear servicio con pago inicial;
   - renovar servicio;
   - transfer/cut venta;
   - push subscription auth.
3. Tests de invalidacion evento -> query keys.

Prioridad media:

1. Tests del currency service con fake fetch y fake repository.
2. Tests PWA offline read/copy/db.
3. Tests de API routes con tokens validos/invalidos.
4. Tests de UI para dialogs de pago/refund/transferencia.

---

## 10. Documentacion

**Calificacion:** 8.8/10

Fortalezas:

- `README.md` explica stack, comandos, arquitectura y variables.
- `CONTEXT.md` define vocabulario de dominio y reglas arquitectonicas.
- `ARCHITECTURE_ROADMAP.md` resume estado enterprise.
- `docs/adr` tiene decisiones activas.
- Hay auditorias y planes previos con contexto historico.
- `docs/README.md` indexa documentacion.

Riesgos:

- Hay muchos documentos historicos; puede ser dificil distinguir fuente activa vs historia si no se mantiene el indice.
- Algunas decisiones operativas dependen de convencion, no de automatizacion.

Recomendaciones:

1. Mantener `docs/README.md` como puerta de entrada unica.
2. Marcar auditorias historicas como historical/superseded cuando aplique.
3. Crear `docs/operations/runbook.md` para incidentes: Supabase, push, cron, Vercel, env vars, recovery.
4. Crear matriz de ownership por modulo.

---

## 11. Observabilidad y logging

**Calificacion:** 4.5/10

Estado observado:

- Hay `console.error` y `console.warn` en componentes, hooks, notifications, executive push, currency service y error boundaries.
- Existe dependencia `@opentelemetry/api`, pero no se observo instrumentacion activa.
- No se observo Sentry, Logtail, Datadog, Axiom, OpenTelemetry SDK configurado, ni logger central.
- No hay correlation id por request.
- No hay metricas de negocio/operacion versionadas.

Problemas:

- Los errores no tienen formato consistente.
- No hay severidad, scope, request id, user id redacted ni event id.
- No hay redaccion central de campos sensibles.
- No hay tracking de latencia RPC/API.
- Los fallos parciales de notification sync o currency fallback pueden quedar solo en consola.

Recomendaciones prioritarias:

1. Crear `src/lib/observability/logger.ts` con interfaz minima:
   - `debug/info/warn/error`
   - `scope`
   - `event`
   - `metadata`
   - redaccion de claves sensibles.
2. Reemplazar `console.*` en modulos criticos:
   - API routes
   - notifications
   - executive push
   - currency
   - payment/refund flows
   - auth
3. Integrar plataforma:
   - Sentry para errores frontend/backend.
   - OpenTelemetry si se quiere tracing.
   - Logs de Vercel/Supabase como fuente operativa minima.
4. Crear metricas:
   - push enviado/fallido/skipped
   - sync notificaciones parcial/fallido
   - RPC latency
   - currency fallback usado
   - errores por dominio

---

## 12. CI/CD

**Calificacion:** 3/10 dentro del repositorio auditado.

Estado observado:

- No se encontro `.github/workflows`.
- Existen scripts adecuados:
  - `lint`
  - `test`
  - `test:coverage`
  - `build`
  - `env:validate`
  - `secrets:scan`
  - `migrate:validate`
- Existe `.vercel`, indicando deployment configurado localmente o enlazado.

Riesgo:

Sin workflow versionado, el equipo no puede probar desde el repositorio que cada PR ejecuta los gates. Puede existir CI externo, pero no fue verificable en esta auditoria.

Workflow minimo recomendado:

```yaml
name: quality

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run secrets:scan
      - run: npm run lint
      - run: npm test -- --run
      - run: npm run test:coverage
      - run: npm run build
```

Para Supabase, se recomienda un job separado si hay entorno controlado:

```yaml
  supabase-validation:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.changed_files, 'supabase/')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run migrate:validate
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## 13. Riesgos tecnicos priorizados

### P0 - Debe resolverse antes de crecimiento operativo

1. **CI/CD ausente**
   - Impacto: regresiones no bloqueadas en PR.
   - Accion: agregar workflow de calidad.

2. **Observabilidad insuficiente**
   - Impacto: incidentes dificiles de diagnosticar.
   - Accion: logger central + Sentry/OTel + metricas.

3. **Modelo single-tenant puede no soportar nuevos requisitos**
   - Impacto: exposicion entre usuarios si se interpreta como multi-tenant.
   - Accion: mantener ADR-0006 como gate de producto; reabrir antes de roles/tenants.

### P1 - Debe entrar en el siguiente ciclo tecnico

4. **Coverage global baja**
   - Impacto: regresiones en flows financieros/notificaciones.
   - Accion: subir umbrales y cubrir workflows criticos.

5. **Currency service sin pruebas suficientes**
   - Impacto: errores financieros silenciosos.
   - Accion: separar adapters y probar fallback/cache.

6. **Invalidaciones y store reactions poco cubiertas**
   - Impacto: UI stale tras mutaciones.
   - Accion: tests evento -> invalidacion.

7. **Casts Supabase y tipos genericos**
   - Impacto: errores runtime por schema drift.
   - Accion: contracts + reducir casts en critical paths.

### P2 - Mejora continua

8. **Componentes/controladores grandes**
   - Impacto: mantenimiento lento.
   - Accion: extracciones por workflow.

9. **Warnings de hooks**
   - Impacto: bug potencial por memo stale.
   - Accion: corregir dependencias en `usePagoDialogController`.

10. **Datos aceptados `ventas_archivadas_activas`**
    - Impacto: ambiguedad de dominio/reportes.
    - Accion: decidir limpieza o documentar como excepcion permanente.

---

## 14. Roadmap tecnico recomendado

### Fase 0 - Gates y visibilidad basica (1 semana)

Objetivo: asegurar que el estado actual no retroceda.

Tareas:

1. Agregar GitHub Actions o workflow equivalente versionado.
2. Ejecutar en PR:
   - `npm run secrets:scan`
   - `npm run lint`
   - `npm test -- --run`
   - `npm run test:coverage`
   - `npm run build`
3. Documentar variables requeridas para CI.
4. Corregir warnings de `usePagoDialogController`.
5. Crear checklist de merge en `docs/DEVELOPER_GUIDE.md`.

Criterio de salida:

- PR no puede mergear si falla calidad.
- Lint sin warnings nuevos.

### Fase 1 - Observabilidad operativa (1-2 semanas)

Objetivo: poder diagnosticar incidentes reales.

Tareas:

1. Crear logger central con redaccion.
2. Reemplazar `console.*` en:
   - API routes push
   - executive push
   - notifications
   - currency
   - auth
   - payment/refund actions
3. Integrar Sentry o plataforma equivalente.
4. Agregar correlation id en API routes.
5. Definir eventos operativos de negocio.

Criterio de salida:

- Errores de produccion llegan a plataforma.
- Logs no contienen secretos o credenciales.
- Push/currency/notification sync tienen eventos rastreables.

### Fase 2 - Testing de flujos criticos (2-3 semanas)

Objetivo: subir confianza en dinero, ventas, servicios y notificaciones.

Tareas:

1. Tests de contrato para RPC adapters criticos.
2. Tests de workflows:
   - crear venta con pago inicial;
   - renovar venta;
   - refund;
   - crear servicio;
   - registrar pago servicio;
   - transfer/cut venta;
   - notification sync.
3. Tests de store reactions.
4. Subir coverage global minimo:
   - lines 55%
   - statements 55%
   - branches 45%
   - functions 50%

Criterio de salida:

- Coverage sube sin bajar umbrales de modulos fuertes.
- Flujos criticos tienen tests que fallan ante cambios de contrato.

### Fase 3 - Hardening Supabase y datos (2 semanas)

Objetivo: reducir drift DB/TypeScript y deuda de datos.

Tareas:

1. Automatizar regeneracion/verificacion de `database.types.ts`.
2. Agregar validacion de migraciones en CI con entorno Supabase controlado.
3. Revisar `ventas_archivadas_activas: 7`.
4. Agregar tests SQL/RPC si Supabase CLI local es viable.
5. Documentar procedimiento de rollback/migration recovery.

Criterio de salida:

- Cambios SQL no pueden entrar sin tipos actualizados.
- Validaciones de seguridad/datos corren en CI.

### Fase 4 - Modularizacion UI incremental (continuo)

Objetivo: reducir costo de mantenimiento sin reescritura.

Tareas:

1. Refactorizar dialogs/controladores grandes por workflow.
2. Separar componentes presentacionales de controladores de accion.
3. Mantener pruebas por comportamiento, no por snapshots fragiles.
4. Eliminar compatibilidad legacy de stores cuando ya no tenga callers.

Criterio de salida:

- Archivos UI criticos por debajo de complejidad razonable.
- Menos acoplamiento directo UI -> stores legacy.

### Fase 5 - Escalabilidad de permisos si el producto cambia

Objetivo: preparar transicion si se abandona single-tenant.

Disparador:

- Se requieren roles no admin.
- Se requiere multi-tenant.
- Se requiere ownership por tercero/servicio/venta.
- Se abren accesos a clientes/revendedores.

Tareas:

1. Reabrir ADR-0006.
2. Modelar tenants/roles/ownership.
3. Migrar RLS de `authenticated` broad a politicas por entidad.
4. Crear tests de autorizacion por rol.

---

## 15. Recomendaciones priorizadas

### Alta prioridad

1. Versionar CI/CD.
2. Implementar observabilidad central.
3. Aumentar cobertura de flujos financieros y notificaciones.
4. Probar API routes con service role y admin auth.
5. Mantener ADR-0006 como restriccion activa.

### Media prioridad

1. Refactorizar `currencyService`.
2. Cubrir `store-reactions`.
3. Cubrir PWA offline DB/read/copy.
4. Reducir casts Supabase en paths criticos.
5. Resolver warnings de hooks.

### Baja prioridad

1. Reorganizar documentos historicos.
2. Crear ownership map por modulo.
3. Reducir tamanos de componentes UI por oportunidad.
4. Revisar bundle/performance budgets.

---

## 16. Matriz de cobertura de objetivos

| Objetivo solicitado | Estado en esta auditoria | Secciones principales |
|---|---|---|
| Evaluacion tecnica global | Cubierto | 1, 2, 4.1 |
| Evaluacion arquitectonica | Cubierto | 3, 4.2 |
| Evaluacion por modulos o apartados | Cubierto | 5 |
| Riesgos tecnicos | Cubierto | 13 |
| Deuda tecnica | Cubierto | 8.3 |
| Problemas de escalabilidad | Cubierto | 7 |
| Problemas de seguridad | Cubierto | 6 |
| Problemas de rendimiento | Cubierto | 7 |
| Problemas de mantenibilidad | Cubierto | 8 |
| Calidad de codigo | Cubierto | 4.4 |
| Calidad de estructura | Cubierto | 4.3 |
| Nivel de desacoplamiento | Cubierto | 8.1 |
| Nivel de cohesion | Cubierto | 8.2 |
| Estado de testing | Cubierto | 9 |
| Estado de documentacion | Cubierto | 10 |
| Estado de observabilidad/logging | Cubierto | 11 |
| Estado de CI/CD | Cubierto | 12 |
| Estado de patrones arquitectonicos | Cubierto | 3, 4.2, 17 |
| Recomendaciones priorizadas | Cubierto | 15 |
| Roadmap tecnico recomendado | Cubierto | 14 |

## 17. Estado de patrones arquitectonicos

| Patron / decision | Estado | Evidencia | Riesgo residual |
|---|---|---|---|
| Monolito modular | Adoptado | ADR-0005, estructura `src/lib/*`, modulos por dominio | Puede degradarse si se agregan agregadores shallow. |
| Source of truth en Postgres | Adoptado | `CONTEXT.md`, migraciones, RPCs, read models | Requiere pruebas DB/contract mas fuertes. |
| Read models para dashboard | Adoptado | ADR-0001, `dashboard-read-models`, RPC adapters | Dependencia de shape SQL/RPC. |
| React Query para lecturas remotas | Adoptado en gran parte | Hooks en `src/hooks`, `queryKeys` | Stores de compatibilidad aun existen. |
| Zustand para estado UI | Adoptado | ADR-0002/0007, stores sin repos Supabase directos | Auth/PWA/WhatsApp siguen siendo puntos sensibles. |
| RPC adapters tipados | Adoptado en critical paths | `ventas-rpc-adapter`, `servicios-rpc-adapter`, `payments-rpc-adapter` | Casts y genericos aun reducen type safety. |
| Idempotencia en operaciones criticas | Adoptado | Migraciones `rpc_idempotency_keys`, adapters de RPC | Necesita pruebas de integracion RPC. |
| Event bus cliente tipado | Adoptado | `src/lib/events/store-event-bus.ts` | Store reactions necesitan mas cobertura. |
| Security by RLS + server admin checks | Adoptado bajo single-tenant | ADR-0006, `requireAuthenticatedAdmin`, validations | No apto para multi-tenant sin rediseno. |
| PWA offline read-only | Adoptado | `src/lib/pwa`, reglas en `CONTEXT.md` | Cobertura parcial en offline DB/read/copy. |
| Observabilidad estructurada | No adoptado | Uso dominante de `console.*` | Riesgo operativo alto. |
| CI/CD versionado | No adoptado en repo | No se observo `.github/workflows` | Riesgo de regresiones no bloqueadas. |

## 18. Conclusion

MovieTime PTY tiene una arquitectura madura para su contexto: monolito modular, Supabase como fuente de verdad, read models SQL, RPCs atomicas, idempotencia, ADRs, tests y validaciones. La direccion tecnica es correcta y no requiere reescritura.

El siguiente salto de calidad no esta en crear mas capas, sino en **operacionalizar la disciplina existente**: CI/CD, observabilidad, pruebas de flujos criticos y contratos DB/API. Si esos puntos se cierran, el sistema quedaria en una posicion fuerte para crecer manteniendo control sobre seguridad, calidad y mantenibilidad.

El riesgo mas serio a futuro es confundir el modelo actual con una plataforma multi-tenant. Mientras MovieTime siga siendo single-tenant administrativo, las decisiones actuales son coherentes. Si cambia el modelo de producto, la seguridad y RLS deben redisenarse antes de abrir nuevos roles o accesos.
