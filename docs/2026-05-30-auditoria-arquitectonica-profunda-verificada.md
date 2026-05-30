# Auditoría arquitectónica profunda y verificada en código

**Proyecto:** MovieTime PTY / MovieTime-Supabase
**Fecha:** 2026-05-30
**Método:** auditoría independiente con trazado real de dependencias archivo por archivo, ejecución de los quality gates y verificación de cada afirmación contra el código (no solo ADRs ni docs).
**Complementa (no reemplaza):** `docs/2026-05-29-auditoria-tecnica-arquitectonica-completa.md`, que es una revisión a nivel de documentación/ADR. Este informe valida o corrige sus afirmaciones contra el código fuente y añade hallazgos estructurales que aquel no detectó.

---

## ESTADO DE REMEDIACIÓN (actualizado 2026-05-30, mismo día)

Tras la auditoría se ejecutó la remediación de Fase 0 (garantías P0) + deuda seleccionada P1/P2. **Todos los gates verdes: lint 0/0, 299 tests, build OK, migrate:validate passed.**

| Hallazgo | Sev | Estado | Qué se hizo |
|---|---|---|---|
| §4.1 Fuga transitiva use-cases→store | P0 | ✅ Resuelto | `ActivityLogOptions` inyectado por parámetro en TODOS los use-cases/workflows; única llamada a `getActivityLogOptions()` movida a controllers UI (composition root). El boundary test transitivo confirma 0 fugas. |
| §4.1 Boundary test ciego | P0 | ✅ Resuelto | `architecture-boundaries.test.ts` reescrito para resolver el grafo de imports **transitivo** (ignora `import type`). **Detectó 6 fugas reales** (no solo las 3 del informe: además `notificaciones-actions`, `notificaciones-reposo`, `gastos-use-cases` vía `store-reactions`/`activity-log-writer`). Todas cerradas. |
| §4.2 Doble emisión de eventos | P0 | ✅ Resuelto | Use-case = único emisor. Eliminadas las re-emisiones en `*-mutation-reactions.ts` (ventas, servicios, terceros) y movidas `CATEGORIA_DELETED`/`TERCERO_*` al use-case. |
| §4.2 Múltiples caminos de invalidación | P0/P1 | 🟡 Parcial | Eliminada la duplicación por doble emisión (camino reactivo ya no se dispara 2×). La consolidación imperativo↔reactivo se documentó como ownership; eliminar suscriptores requiere análisis vista-por-vista (Fase 4, no Fase 0). |
| §4.3 Soft-delete (negocio) en infra | P1 | ✅ Resuelto | `record-core.remove` ahora es hard-delete puro; nuevo `archiveRecord()` solo ejecuta el UPDATE; la política "ventas/servicios se archivan" vive en sus repos específicos. Eliminado el `if (SERVICIOS||VENTAS)` del path genérico. |
| §4.3 Allowlist triple fuente de verdad | P1 | ⬜ Pendiente | Requiere derivar tipos de `database.types.ts`; cambio mayor, dejado para ciclo siguiente. |
| §4.4 UUID regex duplicado | P2 | ✅ Resuelto | `write-utils.ts` importa `isUuid` de `safety.ts`; regex local eliminado. |
| §4.4 DRY offline-auth decision | P2 | ✅ Resuelto | Extraído `tryPreserveOfflineSession()` en `authStore`; dos ramas duplicadas unificadas. `logout` ahora usa `logAsyncSideEffectError` (no `console.error`). |
| §4.5 Shim residual | P2 | ✅ Resuelto | `store/store-query-invalidation.ts` eliminado; único importador reapuntado a la fuente canónica. |
| §4.6 Dir `monitoring` vacío | P2 | ✅ Resuelto | Eliminado; en su lugar se creó `lib/observability/logger.ts` (logger central con redacción + tests). |
| §11/Observabilidad: currency degrada a 1.0 en silencio | P1 | ✅ Resuelto | `currencyService` reporta cada degradación/fallback vía logger central estructurado (con redacción). Sin `console.warn` silencioso. |
| §4.7 Naming/ubicación capa aplicación; §4.3 migrar record-core a repos específicos | P1/P2 | ⬜ Pendiente | Reorganización estructural (depende de ADR-0008 / §6). |
| §6 Reorganización a `modules/` | — | ⬜ No abordado | Es propuesta sujeta a ADR, explícitamente fuera de Fase 0. |

Lo pendiente es deuda estructural mayor (allowlist tipado, migración de `record-core` a repos específicos, reorganización `modules/`) que el propio informe ubica fuera de la remediación inmediata.

---

## 0. Cómo leer este informe

Cada hallazgo trae **evidencia con `archivo:línea`**. La severidad usa esta escala:

- **P0** — riesgo de corrección/seguridad o falla de garantías arquitectónicas que ya existen.
- **P1** — deuda estructural que escala mal y se debe atacar en el próximo ciclo.
- **P2** — mejora de mantenibilidad / consistencia.

Las afirmaciones de "esto está bien" también están verificadas: no es elogio decorativo.

---

## 1. Veredicto global

**Calificación arquitectónica: 7.4 / 10.** (La auditoría previa dio 8.2; la bajo medio punto porque al trazar el código aparecen fugas de capa reales que el test de boundaries no detecta y duplicación de responsabilidades entre tres capas de "mutación".)

MovieTime es un **monolito modular frontend con backend-as-a-service (Supabase)**. La intención de Clean Architecture / Hexagonal / DDD-lite **existe y en gran parte se respeta**, con piezas genuinamente excelentes (RPC adapters tipados, módulo `payments`, event bus, read models, errores de dominio, env Zod, CSP). Pero la implementación es **inconsistente**: el mismo concepto correcto se aplica en un módulo y se viola en el de al lado, y el guardrail automatizado que debería impedirlo tiene un punto ciego.

No requiere reescritura. Requiere **uniformar el patrón que el equipo ya conoce** y cerrar tres fugas concretas.

### Tabla de quality gates (ejecutados en esta auditoría, no citados)

| Gate | Resultado verificado |
|---|---|
| `npm test -- --run` | ✅ 78 archivos, **294 tests** pasan |
| `npm run lint` | ✅ 0 errores, **2 warnings** (`usePagoDialogController.ts:124,132`) |
| `npm run test:coverage` | ✅ pasa umbrales. **Stmts 46.11%, Branch 36.8%, Funcs 42.59%, Lines 49.44%** (2012/4363 stmts) |
| `npm run migrate:validate` | ✅ `status: passed`. Invariantes de dominio OK, seguridad RLS/RPC OK, 1 reporte aceptado (`ventas_archivadas_activas: 7`) |
| `npm run build` | ✅ pasa (exit 0). Next.js 16, TypeScript OK, todas las rutas (estáticas/dinámicas) generadas, middleware/proxy activo |

Las métricas coinciden con la auditoría previa → **los números son honestos**.

### Lo que la auditoría previa NO vio (y este informe sí)

1. **Fuga transitiva de capa** desde `use-cases` → `store`, que **el test de boundaries no detecta** (§4.1). El test da falsa confianza.
2. **Múltiples caminos de invalidación para el mismo hecho de dominio** (invalidación imperativa en el composition root + invalidación dentro de la reacción + invalidación reactiva por evento), agravado por **emisión doble de eventos** (`VENTA_CREATED` etc. se emite en el use-case Y en la store-reaction) → invalidación redundante y solapada (§4.2).
3. **God-adapter genérico** (`record-core.ts` + `write-utils.ts`) que concentra schema + reglas de negocio en infraestructura, con **triple fuente de verdad** del esquema (§4.3).
4. **Emisión de eventos repartida en tres capas** distintas (use-cases, store-reactions, cache-reactions) → ownership ambiguo (§4.2).
5. **Directorio `src/lib/monitoring` vacío** — husk muerto de observabilidad (§4.6).
6. **`src/store/store-query-invalidation.ts`** es un re-export shim residual (pass-through que el refactor decía haber eliminado) (§4.5).
7. **Regex UUID duplicado** entre `safety.ts` y `write-utils.ts` (§4.4).

---

## 2. Forma arquitectónica real (verificada por imports)

El flujo de dependencias **real** (no el documentado) es:

```
                 ┌────────────────────────── UI ──────────────────────────┐
  app/ (pages, API routes)      components/ (+ controllers use*.ts)
        │                               │
        │  React Query hooks            │  controllers
        ▼                               ▼
  hooks/  ───────────────────────────────────────────► store/ (Zustand: UI/auth/PWA/filtros)
        │                                                     │
        │ (lecturas)                                          │ (delegan lógica a)
        ▼                                                     ▼
  client-domain-mutations/  ◄═══ COMPOSITION ROOT ═══►  use-cases/auth-use-cases
        │  (wire: use-case + cache-invalidation + store-reaction + activity-log)
        ├──────────────► use-cases/ (orquestación de negocio)
        │                      │
        │                      ├──► supabase/*-repository  (CRUD adapters)
        │                      ├──► supabase/*-rpc-adapter  (RPCs críticas tipadas) ✅ oro
        │                      ├──► payments/ forecasting/ notifications/ ✅
        │                      └──► events/store-event-bus (emite eventos)
        ▼
  store-reactions/  +  cache/  +  commands/  (invalidación de caché post-mutación)
                                    │
                                    ▼
                          events/cache-reactions (suscriptores → invalidateQueries)
```

**Hallazgo de forma:** hay **cuatro hogares distintos** para "lo que pasa al mutar": `use-cases/`, `client-domain-mutations/`, `store-reactions/`, y `commands/`+`cache/`+`events/cache-reactions`. Eso es el origen de la mayoría de los problemas de cohesión (§4.2). El `composition root` (`client-domain-mutations/`) está **bien concebido** — el problema es que no es el único que orquesta.

### Boundaries que SÍ se respetan (verificado)

- **UI → infra: 0 imports.** `grep "@/lib/supabase"` en `src/components` y `src/app` → **sin resultados**. Excelente.
- **stores → repos Supabase: 0 imports directos** (salvo vía use-cases). Cumple ADR-0007.
- **`as any` / `: any` en producción: 0.** Tipado estricto real.
- **`.catch(() => {})`: 0.** La regla de `CLAUDE.md` se cumple; se usa `safeAsyncSideEffect` (**17 llamadas de producción**; 18 contando tests).

---

## 3. Lo que está genuinamente bien (con evidencia)

| Pieza | Por qué es buena | Evidencia |
|---|---|---|
| **RPC adapters críticos** | Payloads tipados desde `Database['public']['Functions']`, `assertOnlineMutation()`, `withIdempotencyKey()`, `assertRpcStringId()`, throw explícito. Puerto hexagonal de libro. | `src/lib/supabase/ventas-rpc-adapter.ts:103-151` |
| **Módulo `payments`** | Funciones puras, converter **inyectable** (`= convertToUSD` por defecto) → DIP + testeable sin mocks. | `src/lib/payments/payment-calculator.ts:8-17` |
| **Event bus tipado** | Discriminated union `StoreEvent`, handlers tipados por evento, unsubscribe correcto. | `src/lib/events/store-event-bus.ts:1-47` |
| **Errores de dominio** | Jerarquía `DomainError` con `code` + `context`. | `src/lib/errors/domain-errors.ts` |
| **Validación de entorno** | Zod con estrictez condicional prod/dev, separación public/server. | `src/config/env.ts` |
| **CSP / proxy** | nonce + `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` acotado. | `src/proxy.ts:13-40` |
| **Auth de API routes** | Bearer → `getUser` → `active` + `role==='admin'`; mapea 401/403/500; service-role solo tras auth. | `src/lib/server/request-auth.ts`, `src/app/api/push/subscriptions/route.ts` |
| **Validación de migraciones** | Corre contra datos reales (508 ventas, 785 pagos) y verifica **invariantes de dominio** + seguridad RLS/RPC. | `npm run migrate:validate` → `status: passed` |
| **Read models dashboard** | RPC adapter + mappers tipados + fallback offline + factories de estado vacío. | `src/lib/dashboard-read-models/dashboard-read-models.ts` |
| **Inyección de logging en write use-cases** | `createVentaUseCase(data, { logContext, recordActivityLog })` recibe dependencias, no las busca. DI correcta. | `src/lib/use-cases/ventas/ventas-write-use-cases.ts:27-29` |

Estas piezas son el **estándar a replicar** en el resto del sistema.

---

## 4. Violaciones arquitectónicas (con evidencia y por qué importan)

### 4.1 — P0: Fuga transitiva `use-cases → store`, invisible al test de boundaries

**Qué pasa.** El test `src/lib/architecture-boundaries.test.ts:37-49` afirma que `src/lib/use-cases` es independiente de `@/store`. Pero solo hace `grep` del literal `@/store` **dentro de cada archivo de use-case**. No sigue la cadena de imports. Y tres use-cases la violan transitivamente:

```
use-cases/notificaciones/notificaciones-renewal-use-cases.ts:1
use-cases/ventas/venta-detail-payment-workflows.ts:4
use-cases/servicios/servicio-detail-sale-workflows.ts:2
        └─► import { getActivityLogOptions } from '@/lib/activity/activity-log-writer'
                └─► import { useActivityLogStore } from '@/store/activityLogStore'   (activity-log-writer.ts:4)
                └─► getStoreLogContext() ─► import { useAuthStore } from '@/store/authStore' (storeHelpers.ts:1)
```

**Por qué es un problema.**
- Rompe la regla DIP central de la arquitectura: la **capa de aplicación depende de la capa de estado de UI** (Zustand). El use-case ya no se puede ejecutar fuera del navegador (server action, cron, test) sin montar el store.
- Es **incoherente**: los write use-cases "base" (`ventas-write-use-cases.ts`) reciben `logContext`/`recordActivityLog` por parámetro (DI correcta), pero los "detail workflows" los **buscan ellos mismos** vía `getActivityLogOptions()`. Mismo equipo, mismo dominio, dos patrones opuestos.
- **El guardrail miente.** Un test verde hace creer que el boundary se respeta cuando no es así.

**Impacto técnico.** Acoplamiento aplicación↔UI, use-cases no portables, falsa confianza del CI. Severidad alta porque degrada una garantía que el proyecto cree tener.

**Fix.** (a) Inyectar `ActivityLogOptions` por parámetro en TODOS los use-cases (uniformar con `ventas-write-use-cases.ts`); el composition root (`client-domain-mutations/`) sigue siendo el único que llama `getActivityLogOptions()`. (b) Reemplazar el test de boundaries por uno que resuelva el **grafo de imports transitivo** (ver §8.4).

---

### 4.2 — P0: Doble emisión de eventos de dominio (ownership ambiguo)

**Qué pasa.** Cada evento de mutación se emite **dos veces**:

```
createVentaUseCase   → storeEventBus.emit({type:'VENTA_CREATED'})   ventas-write-use-cases.ts:101
afterVentaCreated    → storeEventBus.emit({type:'VENTA_CREATED'})   ventas-mutation-reactions.ts:34
```

Igual para `VENTA_UPDATED/DELETED` (`:179/:223` vs `:40/:47`) y para `SERVICIO_CREATED/UPDATED/DELETED` (`servicios-write-use-cases.ts:103,199,244` vs `servicios-mutation-reactions.ts:22,27,33`). Y existe **un tercer emisor**: `events/cache-reactions.ts:73-79` (`emitVentaUpdated`, `emitTerceroMetodoPagoUpdated`).

**El problema real es más amplio que "se emite dos veces": hay múltiples caminos de invalidación para el mismo hecho de dominio.** Trazando una sola `createVentaMutation` (`ventas-client-mutations.ts:15-19`) coexisten al menos **tres** caminos de invalidación de caché para el mismo hecho:

1. **Imperativo en el composition root:** `ventas-client-mutations.ts:18` → `invalidateStoreQueries(['ventas','servicios','terceros','pagination'])`.
2. **Dentro de la reacción:** `afterVentaUpdated/Deleted` → `applyServiceProfileDelta` → `invalidateStoreQueries(['servicios','ventas','pagination'])` (`ventas-mutation-reactions.ts:15`).
3. **Reactivo por evento:** la emisión de `VENTA_*` dispara los suscriptores de `cache-reactions.ts:33,46,58`, que invalidan sus propias query keys. **La doble emisión agrava este tercer camino** (cada suscriptor se dispara dos veces por mutación).

Es decir: la doble emisión (use-case `:101` + reacción `:34`) es **un síntoma** de un problema mayor — la invalidación del mismo evento de dominio está repartida entre invalidación imperativa, invalidación dentro de la reacción, e invalidación reactiva por evento, sin un dueño único.

**Por qué es un problema.**
- **DRY + SRP:** dos capas (use-case y store-reaction) reclaman la misma responsabilidad (emitir el evento de dominio), y tres caminos distintos reclaman la responsabilidad de invalidar la caché.
- **Ownership ambiguo:** ¿quién es la fuente de verdad de "ocurrió VENTA_CREATED" y de "qué caché se invalida por ello"? Hoy: repartido. Cualquier listener nuevo se dispara doble silenciosamente y cualquier query key nueva puede quedar invalidada por dos o tres rutas.
- **Costo:** invalidaciones/refetch redundantes y solapados (no corrompe datos por ser idempotente, pero escala mal, encarece la red y enmascara bugs de invalidación faltante).

**Fix.** Decidir **un solo emisor**. Recomendado: el evento de dominio lo emite **el use-case** (es quien sabe que el hecho ocurrió). La store-reaction solo reacciona a efectos de caché/forecast, **no re-emite**. Eliminar emisiones duplicadas en `*-mutation-reactions.ts` y consolidar los helpers `emit*` de `cache-reactions.ts`.

---

### 4.3 — P1: God-adapter genérico (`record-core` + `write-utils`) con reglas de negocio en infraestructura

**Qué pasa.** `src/lib/supabase/record-core.ts` es un repositorio genérico único para **todas** las entidades, con `if (collectionName === ENTITIES.X)` esparcido:

- `record-core.ts:74` notificaciones, `:101` terceros derived count, `:126-134` pagos/notificaciones en `create`, `:154` notificaciones en `update`.
- **Regla de negocio en infra:** `record-core.ts:173-183` — soft-delete (archivado) para `SERVICIOS`/`VENTAS` está **decidido en el repositorio**. `CLAUDE.md` dice textual: *"Repositories are thin Supabase adapters. They must not contain business decisions."* → **violación directa de la propia regla del proyecto.**
- `write-utils.ts:124-135` — mapeos de dominio en infra: `servicios.tipo → plan_tipo_id`, `gastos.monto → monto_original/monto_usd` con default `moneda='USD'`.

**Triple fuente de verdad del esquema.** El allowlist de columnas por entidad (`write-utils.ts:27-122`) **duplica** lo que ya está en (1) la migración SQL y (2) `database.types.ts`. Agregar una columna obliga a tocar **tres** lugares; si olvidas el allowlist, el campo se **descarta en silencio** (solo `console.warn` en dev, `write-utils.ts:149-158`).

**Por qué es un problema.**
- **Open/Closed:** cada entidad nueva edita estos archivos centrales.
- **SRP:** un módulo conoce notificaciones + pagos + soft-delete + terceros + offline + normalización a la vez.
- **Type safety:** 105 ocurrencias de `Record<string, unknown>` (productivo; 107 con tests) y los `as never`/`as unknown as` (record-core `:41,79,108,162,185,241`) viven aquí — el agujero de tipado se concentra en este god-layer.
- **Drift de esquema:** el riesgo nº1 de fallo en runtime del sistema.

**Contraste revelador.** El proyecto **ya tiene** el patrón correcto al lado: los `*-rpc-adapter.ts` son adapters específicos, tipados, por operación. La deuda es que conviven el patrón oro (RPC adapters) y el anti-patrón (generic repository).

**Fix incremental.** Mover el soft-delete a un use-case (`deleteVentaUseCase` ya existe — debe decidir él el archivado, no el repo). Reemplazar el allowlist manual por tipos derivados de `database.types.ts`. Migrar entidad por entidad de `record-core` genérico a repositorios específicos delgados (como ya son `categorias-repository`, `notifications-repository`).

---

### 4.4 — P2: Duplicación (DRY)

| Duplicado | Ubicaciones | Fix |
|---|---|---|
| **Regex UUID** | canónico en `utils/safety.ts:8`; copia idéntica en `write-utils.ts:172-174` | `write-utils` debe importar `isUuid` de `safety.ts` |
| **Lógica de decisión offline-auth** | bloque `decision !== 'clear'` casi idéntico en `authStore.ts:179-188` y `:206-215` | extraer a helper `applyOfflineAuthDecision()` |
| **Tres módulos de invalidación de caché** | `cache/store-query-invalidation.ts`, `commands/client-cache.ts`, `store/store-query-invalidation.ts` (shim) | consolidar (ver §4.5) |

---

### 4.5 — P2: Residuo de pass-through / re-export shim

`src/store/store-query-invalidation.ts` son **2 líneas** que re-exportan `@/lib/cache/store-query-invalidation`. Es exactamente el tipo de indirección muerta que `CLAUDE.md` y el refactor previo decían haber eliminado. Sea por compat: marcarlo `@deprecated` y eliminar cuando no haya callers, o borrar y reapuntar imports.

### 4.6 — P2: Directorio muerto

`src/lib/monitoring/` está **vacío**. Es el husk del "logger central" que nunca se construyó. O se implementa el logger ahí (§7) o se borra para no confundir.

### 4.7 — P2: Naming/ubicación inconsistente de la capa de aplicación

Adapters de orquestación dispersos: `lib/ventas/ventas-read-adapter.ts` y `lib/terceros/terceros-write-adapter.ts` viven **fuera** de `lib/use-cases/` aunque cumplen el mismo rol (mappers + orquestación de lectura/escritura). Tres convenciones para lo mismo: `use-cases/<dominio>/`, `lib/<dominio>/*-adapter.ts`, `client-domain-mutations/`. Decidir UNA (ver §6).

---

## 5. Evaluación por módulo (verificada)

| Módulo | Estado | Qué hace | Bien | Problema / riesgo |
|---|---|---|---|---|
| `app/` | ✅ Bueno | rutas, layouts, API routes push/dashboard | 0 imports a infra; API routes con auth admin | páginas client-heavy; sin tests de API routes con service-role |
| `components/` | 🟡 Medio-bueno | UI por dominio + controllers `use*.ts` | regla 300 líneas respetada; controllers separados de presentación | `usePagoDialogController` (329 líneas, 2 warnings); cobertura UI baja |
| `hooks/` | ✅ Bueno | lecturas React Query, paginación | `queryKeys` centralizadas; `useServerPagination` | algunos hooks mezclan optimismo |
| `store/` | 🟡 Medio-bueno | estado UI/auth/PWA/filtros | delega lógica a use-cases; sin repos directos | `authStore.initAuth` complejo + DRY (§4.4); shim residual (§4.5) |
| `lib/use-cases/` | 🟡 Bueno con fuga | orquestación de negocio | write use-cases con DI correcta; emiten eventos de dominio | **fuga a store (§4.1)**; **doble emisión (§4.2)** |
| `lib/client-domain-mutations/` | ✅ Bueno | composition root | wire limpio use-case+cache+reaction+log | es uno de cuatro orquestadores (§2) |
| `lib/supabase/` (RPC adapters) | ✅ Muy bueno | RPCs críticas tipadas | idempotencia, asserts, tipado DB | — |
| `lib/supabase/` (record-core/write-utils) | 🔴 Deuda | repositorio genérico + normalización | centraliza snake/camel | **god-adapter + regla negocio en infra + triple fuente esquema (§4.3)** |
| `lib/payments/` | ✅ Muy bueno | cálculo financiero, moneda | puro, converter inyectable, alta cobertura | depende de `currencyService` (débil) |
| `lib/services/currencyService` | 🔴 Bajo-medio | tasas externas + caché + conversión | fallback a stale cache | 4 responsabilidades en 1 clase; **degrada a 1.0 en silencio** (`:38,49,65,71`); cobertura ~4% |
| `lib/notifications/` | 🟡 Medio-bueno | cálculo/sync/cleanup/push | orchestrator bien estructurado | `orchestrator`/`event-listeners`/`bulk-sync` con cobertura ~0; `console.*` |
| `lib/dashboard-read-models/` + `forecasting/` | ✅ Muy bueno | lecturas/pronóstico | RPC + mappers + fallback; alta cobertura | depende de shape SQL |
| `lib/events/` | ✅ Bueno (bus) / 🟡 (reactions) | bus tipado + suscriptores | bus 100% cobertura | `cache-reactions` mezcla suscripción + emisión (§4.2) |
| `lib/pwa/` | 🟡 Medio | offline/SW/push | mutaciones requieren online | `offline-db/read/copy` cobertura ~0 |
| `lib/monitoring/` | 🔴 Muerto | — | — | **vacío (§4.6)** |
| `supabase/migrations` | ✅ Bueno | schema/RLS/RPC/triggers | 82 migraciones, validación con invariantes reales | `ventas_archivadas_activas: 7` (deuda de datos aceptada) |

---

## 6. Arquitectura objetivo (target) — propuesta de evolución, sujeta a ADR

> **Estatus: PROPUESTA, no conclusión inevitable.** Esta sección describe *una* dirección de evolución razonable, no la única correcta ni un prerrequisito. **El valor inmediato de esta auditoría está en §4.1, §4.2 y §10/Fase 0** — cerrar las garantías que el sistema ya cree tener (DI de logging, emisor/invalidación únicos, boundary transitivo). Eso se puede hacer **sin** reorganizar carpetas. La migración a `modules/` de abajo debe decidirse como **ADR-0008** propio, con costo/beneficio explícito, y solo tiene sentido *después* de cerrar la Fase 0. La estructura actual (`lib/use-cases` + `lib/<dominio>` + `client-domain-mutations`) puede converger a estas reglas sin renombrar todo si el equipo lo prefiere; lo no-negociable son las **reglas de dependencia**, no los nombres de carpeta.

Manteniendo el monolito modular, la dirección propuesta es **un solo modelo de capas por dominio** y nombres uniformes:

```
src/
  app/                      # SOLO rutas Next, layouts, API routes (orquestadores delgados)
  components/               # SOLO presentación + controllers de pantalla (use*.ts)
  hooks/                    # SOLO lecturas React Query + paginación (sin lógica de negocio)
  store/                    # SOLO estado de UI/auth-session/PWA/filtros (Zustand)

  modules/                  # ◄── un directorio por bounded context (reemplaza el sprawl actual)
    ventas/
      domain/               # entidades, value objects, reglas puras, errores de dominio
      application/          # use-cases (orquestación) — RECIBEN dependencias por parámetro
      infrastructure/       # repository + rpc-adapter (adapters Supabase, tipados)
      events.ts             # tipos de evento de este contexto
      index.ts              # API pública del módulo (lo único importable desde fuera)
    servicios/  terceros/  pagos/  notificaciones/  dashboard/  ...

  platform/                 # cross-cutting compartido (lo que hoy está disperso)
    supabase/               # client, database.types, helpers IO genéricos (SIN reglas de negocio)
    events/                 # store-event-bus (genérico)
    cache/                  # invalidación de caché (UNO solo)
    observability/          # logger central + redacción (reemplaza lib/monitoring vacío)
    errors/                 # DomainError base
    config/                 # env Zod, site
    utils/                  # helpers puros (isUuid, money, dates)
```

**Regla de oro de dependencias (flecha = "puede importar"):**

```
app/components/hooks/store  ──►  modules/<x>/index.ts  ──►  application ──► domain
                                                              │
                                                              └──► infrastructure ──► platform/supabase
domain ──► (nada externo: solo platform/errors y platform/utils puros)
platform/* ──► (no importa modules/, no importa store/)
```

### Reglas estrictas (qué puede / no puede importar cada capa)

| Capa | PUEDE importar | NO puede importar |
|---|---|---|
| `domain/` | `platform/errors`, `platform/utils` (puros) | Supabase, React, Zustand, otros módulos, `application/`, `infrastructure/` |
| `application/` (use-cases) | su `domain/`, su `infrastructure/`, `platform/events`, otros módulos **vía `index.ts`** | `@/store`, React, `@/components`, `@/hooks`, `@/lib/activity` (¡fuga §4.1!) |
| `infrastructure/` | su `domain/`, `platform/supabase`, `platform/utils` | `@/store`, `application/` de otros módulos, React |
| `store/` | `modules/<x>/index.ts` (use-cases), `platform/*` | repos/infra directamente, otro store con reglas de negocio |
| `components/` `hooks/` `app/` | `hooks/`, `modules/<x>/index.ts`, `store/`, `platform/utils` | `@/lib/supabase` (ya se cumple ✅), infra directa |

**Identidad y logging = dependencias inyectadas, nunca buscadas.** El `logContext` (usuario actual) y el `recordActivityLog` se pasan **por parámetro** desde el composition root. Ningún use-case llama `useAuthStore.getState()` ni `getActivityLogOptions()` por dentro.

**Un único composition root por mutación:** `modules/<x>/application/<accion>-use-case.ts` orquesta negocio + emite evento de dominio; la invalidación de caché la dispara **el llamador de UI** (hook/controller) reaccionando al evento, no una segunda capa que re-emite.

---

## 7. Reglas obligatorias de desarrollo (para humanos y para IAs)

Estas reglas deben vivir en `CLAUDE.md` / `CONTEXT.md` para que toda IA futura las siga:

### 7.1 Dónde vive cada tipo de lógica
- **Regla de negocio / invariante** → `domain/` o `application/`. **Nunca** en `infrastructure/`, `store/`, `components/` ni `hooks/`. (Hoy violado: soft-delete en `record-core.ts:173`.)
- **Acceso a datos** → `infrastructure/` (repository o rpc-adapter). Thin. Sin decisiones.
- **Estado de UI / sesión / filtros** → `store/`. Sin reglas transaccionales.
- **Lecturas remotas** → `hooks/` con React Query. Sin mutaciones de negocio.
- **Identidad del usuario** → se **inyecta**; se lee del store **solo** en el composition root.

### 7.2 Cómo crear un módulo nuevo
1. `modules/<contexto>/{domain,application,infrastructure}` + `index.ts` + `events.ts`.
2. Entidades/tipos y errores en `domain/`.
3. Repos/adapters en `infrastructure/` tipados desde `database.types.ts` (sin allowlist manual duplicado).
4. Use-cases en `application/`: firma `fn(input, deps)` donde `deps` incluye `{ logContext, recordActivityLog }` y puertos necesarios.
5. Exportar SOLO por `index.ts` (API pública). Prohibido importar archivos internos de otro módulo.

### 7.3 RPCs críticas (pagos/períodos/refunds/rollback)
- Siempre vía `*-rpc-adapter` tipado (patrón `ventas-rpc-adapter.ts`), con `assertOnlineMutation()`, `withIdempotencyKey()`, `assertRpcStringId()`. **Nunca** `String(data)`.

### 7.4 Eventos
- Tipos en `StoreEvent` (discriminated union). **Un solo emisor por hecho** (el use-case). Las reacciones **no re-emiten**. Comunicación entre módulos **solo** vía `storeEventBus`; nunca `window.dispatchEvent`/`localStorage` para eventos de negocio.

### 7.5 Errores
- Lanzar subclases de `DomainError` con `code` + `context`. Side-effects no críticos vía `safeAsyncSideEffect`. **Prohibido** `.catch(() => {})` (hoy cumplido ✅) y `console.*` directo en módulos críticos (usar logger central).

### 7.6 Tipado
- `strict: true`. **Cero** `any` (hoy cumplido ✅). `as unknown as` solo dentro de `infrastructure/`, nunca en `domain`/`application`/UI. Minimizar `Record<string, unknown>` (hoy 105 productivo) derivando tipos de `database.types.ts`.

### 7.7 Naming
- Use-cases: `<verbo><Entidad>UseCase` (`createVentaUseCase`). Repos: `infrastructure/<entidad>-repository.ts`. RPC: `<entidad>-rpc-adapter.ts`. Eventos: `ENTIDAD_ACCION`. Controllers UI: `use<Pantalla>Controller.ts`.

---

## 8. Ejemplos de código correcto

### 8.1 Use-case SIN fuga (corrige §4.1) — patrón obligatorio
```ts
// modules/servicios/application/cut-venta-from-servicio.ts
import type { ActivityLogPort } from '@/platform/observability/activity-log-port';
import { updateVentaUseCase } from '@/modules/ventas';        // ◄ vía index público
import type { VentaDoc } from '@/modules/ventas';

type Deps = {
  log: ActivityLogPort;                 // ◄ INYECTADO, no buscado en el store
  updatePerfilOcupado: (servicioId: string, inc: boolean) => Promise<void>;
};

export async function cutVentaUseCase(venta: VentaDoc, motivo: string, deps: Deps) {
  const { serviceProfileDelta } = await updateVentaUseCase(
    venta.id,
    { estado: 'inactivo', cortadaAt: new Date(), motivoCorte: motivo },
    { currentVenta: venta, log: deps.log },     // ◄ DI, no getActivityLogOptions()
  );
  if (serviceProfileDelta) {
    await deps.updatePerfilOcupado(serviceProfileDelta.servicioId, serviceProfileDelta.shouldIncrement);
  }
  return { ventaId: venta.id, serviceProfileUpdated: Boolean(serviceProfileDelta) };
  // NO invalida caché aquí, NO re-emite eventos: eso es del composition root / reacción única.
}
```

### 8.2 Composition root (único lugar que toca el store)
```ts
// modules/servicios/composition/cut-venta.command.ts  (llamado desde el controller de UI)
import { cutVentaUseCase } from '../application/cut-venta-from-servicio';
import { getActivityLogOptions } from '@/platform/observability/activity-log-writer'; // ◄ aquí SÍ
import { invalidateStoreQueries } from '@/platform/cache';

export async function cutVentaCommand(venta, motivo, ports) {
  const result = await cutVentaUseCase(venta, motivo, { log: getActivityLogOptions(), ...ports });
  await invalidateStoreQueries(['ventas', 'servicios', 'notificaciones', 'pagination']);
  return result;
}
```

### 8.3 Soft-delete como decisión de dominio (corrige §4.3)
```ts
// modules/ventas/application/delete-venta-use-case.ts
export async function deleteVentaUseCase(id: string, deps: { repo: VentaRepository; ... }) {
  // la DECISIÓN de archivar vs borrar vive aquí, no en el repo
  await deps.repo.archive(id, { motivo: 'Eliminado desde la app' }); // repo solo ejecuta
}
// infrastructure/ventas-repository.ts  → archive() solo hace el UPDATE archivado_at, sin decidir nada
```

### 8.4 Test de boundaries que SÍ atrapa fugas transitivas (corrige §4.1)
```ts
// reemplaza el grep literal por resolución del grafo de imports
import { buildImportGraph, reachableModules } from './import-graph';
it('use-cases no alcanzan @/store ni siquiera transitivamente', () => {
  const graph = buildImportGraph('src/lib/use-cases');
  for (const file of graph.entryFiles) {
    expect([...reachableModules(graph, file)].filter(m => m.includes('/store/'))).toEqual([]);
  }
});
```

---

## 9. Deuda técnica priorizada

| # | Item | Sev | Tipo | Evidencia |
|---|---|---|---|---|
| 1 | Fuga transitiva use-cases→store + test ciego | P0 | Arquitectura | `notificaciones-renewal-use-cases.ts:1`, `architecture-boundaries.test.ts:37` |
| 2 | Doble emisión de eventos / ownership ambiguo | P0 | Corrección/DRY | `ventas-write-use-cases.ts:101` + `ventas-mutation-reactions.ts:34` |
| 3 | God-adapter + regla de negocio en infra + triple fuente esquema | P1 | Arquitectura/Type-safety | `record-core.ts:173`, `write-utils.ts:27-135` |
| 4 | `currencyService` degrada a 1.0 silenciosamente, 4 responsabilidades | P1 | Dominio financiero | `currencyService.ts:38,49,65,71` |
| 5 | Cobertura global ~46% en sistema con dinero | P1 | Calidad | coverage report |
| 6 | Sin observabilidad central (79 `console.*`, `lib/monitoring` vacío) | P1 | Operacional | 40 archivos; `lib/monitoring/` vacío |
| 7 | `Record<string, unknown>` ×105 (productivo) | P2 | Type-safety | grep |
| 8 | Cuatro hogares de "mutación" / naming inconsistente | P2 | Cohesión | §2, §4.7 |
| 9 | DRY: UUID regex, offline-auth decision, shim de invalidación | P2 | Mantenibilidad | §4.4, §4.5 |
| 10 | Warnings hooks `usePagoDialogController:124,132` | P2 | Calidad | lint |
| 11 | `ventas_archivadas_activas: 7` | P2 | Datos | migrate:validate |

---

## 10. Roadmap de refactorización

### Fase 0 — Cerrar las garantías que ya creemos tener (3-5 días)
1. **Uniformar DI de logging:** inyectar `ActivityLogOptions` en los 3 use-cases con fuga; mover la llamada a `getActivityLogOptions()` al composition root. (§4.1)
2. **Eliminar doble emisión:** dejar al use-case como único emisor; quitar `emit` de `*-mutation-reactions.ts`. (§4.2)
3. **Reescribir `architecture-boundaries.test`** con grafo de imports transitivo. (§8.4)
4. Corregir 2 warnings de `usePagoDialogController`.
- *Salida:* el test de boundaries falla si reaparece una fuga; cada mutación invalida una sola vez.

### Fase 1 — Observabilidad (1 semana)
1. Implementar `platform/observability/logger.ts` (debug/info/warn/error + scope + redacción de `password/token/p256dh/endpoint`).
2. Reemplazar `console.*` en notifications, currency, push, auth, payment/refund (40 archivos). Borrar `lib/monitoring` vacío o usarlo como hogar del logger.
3. `currencyService`: emitir evento/log cuando se usa fallback; no degradar a 1.0 sin trazabilidad.

### Fase 2 — Domesticar la infraestructura genérica (1-2 semanas)
1. Mover soft-delete de `record-core.ts:173` a los use-cases de delete. (§4.3)
2. Derivar el allowlist de escritura desde `database.types.ts` (eliminar la tercera fuente de verdad).
3. `isUuid` único (importar de `safety.ts`). Reducir `Record<string,unknown>` en write-utils/record-core.
4. Migrar 1-2 entidades del `record-core` genérico a repositorios específicos (probar el patrón).

### Fase 3 — Cobertura de flujos con dinero (2-3 semanas)
1. Tests de contrato RPC: crear venta con pago inicial, renovar, refund, crear/renovar servicio, transfer/cut.
2. Tests `currencyService` (fetch falla, cache stale, moneda faltante).
3. Tests de invalidación: evento → query keys (consumidores de `cache-reactions`).
4. Subir umbrales: lines 55 / stmts 55 / branch 45 / funcs 50.

### Fase 4 — Reorganización a `modules/` (OPCIONAL, requiere ADR-0008, no bloqueante)
> Solo emprender **después** de Fase 0. Lo crítico (cerrar fugas/garantías) no depende de esta reorganización. Decidir vía ADR-0008 con costo/beneficio explícito; alternativa válida: aplicar las reglas de dependencia §6 sobre la estructura actual sin renombrar carpetas.
1. (Si se aprueba el ADR) adoptar `modules/<x>/{domain,application,infrastructure}` por dominio.
2. Consolidar los cuatro orquestadores en composition root único por módulo.
3. Eliminar shims/pass-through residuales y `lib/ventas`/`lib/terceros` sueltos hacia `infrastructure/`.

---

## 11. Cierre

MovieTime **no es un proyecto en problemas**: tiene boundaries reales (UI↔infra limpio, cero `any`, cero `.catch(()=>{})`), un patrón de RPC y de read models que son ejemplares, y una validación de migraciones que verifica invariantes contra datos de producción. La intención Clean/Hexagonal/DDD es real.

El problema es de **consistencia y de ownership**, no de concepto. El equipo conoce el patrón correcto (DI en write use-cases, RPC adapters tipados) pero no lo aplicó de forma uniforme, y el guardrail automatizado tiene un punto ciego que oculta la fuga.

**La recomendación principal, en orden:** (1) cerrar las garantías que el sistema ya cree tener — DI de logging uniforme, **un único dueño** de la emisión de evento y de la invalidación de caché por hecho de dominio, y un boundary test que resuelva el grafo transitivo. Esto es **barato** y no requiere mover carpetas. (2) Atacar la deuda de fondo: el **god-adapter genérico** y la **cobertura en flujos financieros**. (3) Solo entonces, y como decisión separada vía ADR, evaluar la reorganización a `modules/` de §6 — es una evolución razonable, no un prerrequisito ni una conclusión inevitable.

El mayor riesgo estratégico sigue siendo el modelo single-tenant (ADR-0006): correcto hoy, pero debe reabrirse antes de cualquier rol no-admin o multi-tenant.
