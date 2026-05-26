# Auditoría Arquitectural — Calificación por Apartado

**Fecha:** 2026-05-25
**Skill:** `/improve-codebase-architecture`
**Modelo:** Modular Monolith con Módulos Profundos (ADR-0005)
**Estado base:** 284 tests passing, 0 lint errors, build OK

> Vocabulario arquitectural: `Module`, `Interface`, `Seam`, `Adapter`, `Leverage`, `Locality`, `Deep`/`Shallow`.
> Vocabulario de dominio: `Tercero`, `Servicio`, `Venta`, `Pago`, `Notificacion`, `Categoria` (ver [CONTEXT.md](../CONTEXT.md)).

---

## Metodología de calificación

Cada apartado se califica de **1 a 10**:

| Rango | Significado |
|-------|-------------|
| 9–10 | Profundo, sin fricción visible, sirve de referencia |
| 7–8 | Sólido, pequeñas mejoras posibles |
| 5–6 | Funcional pero con friction documentada |
| 3–4 | Shallow o con violaciones concretas |
| 1–2 | Problemático, bloquea testabilidad o navega bilidad |

---

## 1. Capa de Use-Cases — **8.5 / 10**

### Archivos evaluados
- `src/lib/use-cases/ventas/ventas-write-use-cases.ts`
- `src/lib/use-cases/ventas/venta-detail-use-cases.ts` (313 líneas)
- `src/lib/use-cases/servicios/servicio-detail-use-cases.ts` (319 líneas)
- `src/lib/use-cases/ventas/ventas-shared.ts`
- `src/lib/use-cases/notificaciones/` (4 archivos)
- `src/lib/use-cases/activity-log-use-cases.ts`
- `src/lib/use-cases/catalogos-use-cases.ts`
- `src/lib/use-cases/metodos-pago-use-cases.ts`
- `src/lib/use-cases/templates-use-cases.ts`

### Fortalezas

- **Locality alta en el núcleo:** `createVentaUseCase`, `updateVentaUseCase`, `deleteVentaUseCase` concentran validación, conversión de moneda, logging y emisión de eventos detrás de una interfaz pequeña. Deletion test positivo — si se eliminaran, la complejidad reaparecería dispersa.
- **Typed outcome unions:** `VentaDetalleWorkflowOutcome` y `ServicioDetalleWorkflowOutcome` hacen que el caller no necesite adivinar qué pasó — el tipo lo dice.
- **Shared limpio:** `ventas-shared.ts` concentra cálculos puros (`getPagoValues`, `toVentaPronostico`, `getUsdValues`) con funciones libres de side effects, ideal para tests unitarios.
- **Separación query/write:** `ventas-query-use-cases.ts`, `ventas-write-use-cases.ts`, `ventas-payment-use-cases.ts` y `venta-detail-use-cases.ts` dividen responsabilidades sin solaparse.
- **Zero empty catches:** Ningún `catch(() => {})` en toda la capa.

### Fricción

- **`venta-detail-use-cases.ts` (313 líneas) y `servicio-detail-use-cases.ts` (319 líneas)** superan el umbral de CLAUDE.md y mezclan workflows distintos (delete, renew, transfer, cut, payment) en un mismo archivo. No violan cohesión, pero dificultan la navegación y favorecen el engorde incremental.
- **`activity-log-use-cases.ts` y `catalogos-use-cases.ts`** son módulos shallow: sus funciones no añaden política real (sin validación de retención, sin autorización, sin audit de la propia acción).
- **`templates-use-cases.ts`** es pass-through puro — deletion test negativo (deleting it moves complexity, not concentrates it).

### Veredicto

La capa es profunda donde más importa (ventas, servicios, pagos). La fricción está en los use-cases auxiliares que no ganaron depth real tras el refactor.

---

## 2. Repositorios Supabase — **9 / 10**

### Archivos evaluados
- `src/lib/supabase/ventas-repository.ts`
- `src/lib/supabase/servicios-repository.ts`
- `src/lib/supabase/ventas-rpc-adapter.ts`
- `src/lib/supabase/domain-read-adapters.ts`
- `src/lib/supabase/` (40+ archivos)

### Fortalezas

- **Repos thin por diseño:** CRUD puro, sin decisiones de negocio. Deletion test positivo — si se eliminara uno, la complejidad migra al use-case, no se dispersa.
- **RPC adapters tipados:** `CreateVentaWithInitialPaymentPayload` tiene 30+ parámetros tipados con prefijo `p_`. Ningún `any` visible en el camino crítico.
- **Idempotency keys:** `withIdempotencyKey()` integrado en los RPCs de creación. Cumple ADR-0003.
- **`assertRpcStringId`:** Validación del retorno de RPCs críticos, evitando `String(data)` directo.
- **`domain-read-adapters.ts`:** Después del refactor anterior, los shims puros fueron eliminados y quedan solo adapters con transformación real (`getVentaDetalleRead` reconstruye un `VentaDoc`).

### Fricción

- **Tres rutas de lectura todavía coexisten** para algunos dominios: `domain-read-adapters`, repos directos, y hooks React Query. La navegabilidad para IA y humanos se resiente cuando cambia el shape de un tipo — no es obvio cuál camino actualizar.
- **Seam único real:** `getVentaDetalleRead` es el único adapter con transformación genuina. El resto son wrappers de conveniencia que no constituyen un Seam real (necesitaría dos adapters para serlo).

### Veredicto

Capa sólida y disciplinada. El único punto de mejora estructural es unificar el camino de lectura (elegir entre adapter o repo directo de forma consistente).

---

## 3. Stores Zustand — **8 / 10**

### Archivos evaluados
- `src/store/activityLogStore.ts` (reescrito — 22 líneas)
- `src/store/configStore.ts` (reescrito — 68 líneas)
- `src/store/ventasStore.ts`
- `src/store/serviciosStore.ts`
- `src/store/whatsappToastStore.ts`
- `src/store/store-query-invalidation.ts`

### Fortalezas

- **ADR-0007 cumplido tras el refactor:** `activityLogStore` y `configStore` ya no importan repositorios. El store de activity log quedó en 22 líneas — solo `addLog`.
- **Pattern UI-state-only consistente:** `ventasStore`, `serviciosStore`, `categoriasStore`, etc. son stubs de 20-40 líneas con selecciones y flags UI. Ninguno hace IO remoto.
- **`store-query-invalidation.ts`:** Centraliza la invalidación por dominio; no hay `queryClient.invalidate` disperso en componentes.

### Fricción

- **`configStore` todavía acumula mutaciones** (`updateTasasCambio`, `updateDiasNotificacion`, `updateHoraEnvio`, `updatePrefijoWhatsApp`) que no tienen callers externos activos. Son dead code de escritura — nadie las llama fuera del propio store.
- **`whatsappToastStore`** actúa como cola de UI pero mezcla lógica de construcción de mensajes con estado de presentación — límite borroso con la capa de notificaciones.
- **Cobertura de tests:** Solo 2 archivos de test para 19 stores. Los stores más complejos (pwaStore, notificacionesStore) no tienen tests.

### Veredicto

Cumple ADR-0007 y mantiene UI state limpio. Las mutaciones sin caller en `configStore` deben auditarse y posiblemente eliminarse.

---

## 4. React Query Hooks — **9 / 10**

### Archivos evaluados
- `src/hooks/` (32 archivos)
- `src/lib/query-keys.ts`
- `src/hooks/use-config.ts` (nuevo)
- `src/hooks/use-metodos-pago-counts.ts`
- `src/hooks/use-dashboard-stats.ts`

### Fortalezas

- **Pattern 100% consistente:** Los 32 hooks siguen el mismo molde — `"use client"`, `useQuery`, `queryKeys.*`, queryFn desde use-case o repo. Ninguna excepción visible.
- **Query keys jerárquicas:** La estructura `queryKeys.ventas.all → lists() → detail(id) → pagos(id)` permite invalidar con precisión quirúrgica. No hay strings mágicos.
- **`useConfig` nuevo:** La lectura de configuración global ahora usa React Query. El cache de React Query reemplaza el TTL manual del store.
- **Separación reads/writes clara:** Los hooks son solo lectura. Las mutaciones van por `client-domain-mutations.ts`. No hay `useMutation` mezclado con hooks de lista.

### Fricción

- **Ausencia de `staleTime` explícito** en la mayoría de hooks — delegan en el default global. Si el default cambia, el comportamiento de todos los hooks cambia silenciosamente.
- **`useServerPagination`** es un hook complejo (paginación, filtros, orden, totalCount) que merece su propio test — actualmente sin coverage.

### Veredicto

La capa de hooks es la más uniforme del proyecto. Dos ajustes menores elevarían esto a 10.

---

## 5. Módulos Profundos (Payments, Notifications, Dashboard) — **8 / 10**

### Archivos evaluados
- `src/lib/payments/` (9 archivos, barrel vía `payments-module`)
- `src/lib/notifications/` (11 archivos)
- `src/lib/dashboard-read-models/` (3 archivos)
- `src/lib/forecasting/` (5 archivos)

### Fortalezas

- **`@/lib/payments` es genuinamente profundo:** Expone funciones de cálculo y fábrica de pagos detrás de una interfaz pequeña. Los callers no saben nada de conversión de moneda ni de cómo se suman los pagos en USD.
- **`@/lib/notifications` encapsula el sync:** `sincronizarNotificaciones`, `sincronizarUnaVenta`, `sincronizarUnServicio` — todo el ciclo de vida de notificaciones detrás de 5 exports. Si la política de sincronización cambia, solo cambia este módulo.
- **`@/lib/dashboard-read-models`** cumple ADR-0001: lectura pura desde Postgres, sin mutación client-side.
- **`@/lib/forecasting`** es autónomo — `syncVentaForecastReadModels()` es llamado desde las reactions sin que el caller sepa qué tablas lee ni cómo calcula.

### Fricción

- **`payments/index.ts` es un barrel de un solo re-export** (`export * from './payments-module'`). Si `payments-module.ts` agrupa todo, el barrel añade un nivel de indirección sin valor. Recomendación: exponer directamente o justificar la separación.
- **`notifications` tiene 11 archivos** — la frontera entre `notification-bulk-sync`, `notification-cleanup`, y `notification-sync-orchestrator` no es inmediatamente obvia. La Interface está bien; la Implementation podría beneficiarse de un diagrama de flujo en comentario.
- **`dashboard-read-models` con solo 3 archivos** — la profundidad depende de cuánta lógica vive en las RPCs de Postgres. Desde el cliente esto es opaco (bien), pero cualquier cambio en la query SQL requiere regenerar tipos manualmente.

### Veredicto

Los tres módulos cumplen ADR-0005. La fricción es de navegabilidad interna, no de diseño externo.

---

## 6. StoreEventBus y Reactions — **9.5 / 10**

### Archivos evaluados
- `src/lib/events/store-event-bus.ts`
- `src/lib/store-reactions/` (9 archivos)
- `src/lib/store-reactions/ventas-mutation-reactions.ts`

### Fortalezas

- **16 tipos de eventos fuertemente tipados:** Discriminated union con `EventOfType<TType>` — no hay `any` en los handlers. Un handler que escucha `VENTA_CREATED` recibe `{ type, ventaId }` con autocompletado.
- **Cero acoplamiento DOM:** `rg "window.dispatchEvent|localStorage.*emit"` en `src/lib/use-cases` y `src/store` — sin resultados. Cumple ADR-0004 sin excepciones.
- **Chain mutation → reaction:** Cada `after*` function sigue el mismo patrón: validar → cache ops → emit. Predecible y testable.
- **`safeAsyncSideEffect`:** Las reactions no bloquean al caller si fallan — el error se loguea con contexto (operation, entity, entityId) pero no revierte la transacción.
- **9 archivos de reactions bien segmentados** por dominio: ventas, servicios, terceros, templates, catálogos, notificaciones (3 variantes). Un bug en las reactions de Venta no toca las de Tercero.

### Fricción

- **Las reactions no tienen tests propios.** `afterVentaCreated`, `afterVentaUpdated`, `afterVentaDeleted` son funciones puras con side effects testeables — pero no hay ningún test que verifique que emiten el evento correcto o llaman `applyServiceProfileDelta`.
- **`notification-cache-reactions.ts` + `notification-query-reactions.ts` + `notificaciones-workflow-reactions.ts`** — tres archivos para notificaciones crea ambigüedad. ¿Cuál es el entry point? Una pequeña nota de intención en cada uno resolvería esto.

### Veredicto

El mejor Seam del proyecto. El único gap es cobertura de tests para las reactions.

---

## 7. Seguridad y Validación — **9 / 10**

### Archivos evaluados
- `src/lib/utils/safety.ts`
- `src/app/(dashboard)/*/page.tsx` (11 rutas dinámicas)
- `src/lib/supabase/ventas-rpc-adapter.ts`

### Fortalezas

- **Todas las rutas dinámicas validan UUID:** 11 rutas con `[id]` usan `isUuid()` o `assertUuid()` antes de hacer cualquier query. Ninguna ruta pasa el param crudo a Supabase.
- **`assertRpcStringId` en adapters críticos:** Los RPCs que devuelven IDs de registros creados pasan por validación antes de usarse.
- **Zero empty catches en use-cases:** `rg 'catch.*{}' src/lib/use-cases` — sin resultados. Todo error tiene contexto.
- **Un solo `console.error` controlado:** `gastos-use-cases.ts:52` con formato `[GastosUseCase] ${operation} failed`. Intencional, no un descuido.
- **Zero TODOs/FIXMEs en código:** El codebase está limpio de deuda técnica marcada.
- **Idempotency keys en writes críticos:** Ventas, servicios, pagos. Cumple ADR-0003.

### Fricción

- **`safeAsyncSideEffect` silencia errores** en reactions y side effects. Es correcto para no revertir transacciones, pero no hay alerting externo ni métricas de fallos silenciosos. Si `syncVentaForecastReadModels` falla silenciosamente durante semanas, el dashboard muestra datos incorrectos sin aviso.
- **RLS single-tenant (ADR-0006):** Aceptable para el modelo actual. Cualquier expansión multi-tenant requeriría revisitar todas las políticas. El riesgo está documentado en el ADR pero no en el código.

### Veredicto

Validación robusta y disciplinada. El único vector de riesgo real es la ausencia de alerting para fallos silenciosos en side effects.

---

## 8. Logging y Auditoría — **8.5 / 10**

### Archivos evaluados
- `src/lib/activity/activity-log-writer.ts`
- `src/store/activityLogStore.ts` (post-refactor)
- `src/app/(dashboard)/log-actividad/page.tsx`
- `src/lib/use-cases/ventas/ventas-write-use-cases.ts` (patrones de log)

### Fortalezas

- **`detalles` para display, `metadata` para audit:** El patrón está implementado consistentemente. `detalles` es string legible; `metadata` es objeto tipado con `origen`, IDs, monedas, fechas.
- **`getActivityLogOptions()` como injection point:** Los use-cases reciben `recordActivityLog` como callback — no importan el store directamente. Esto permite testear use-cases sin activar el store.
- **Paginación server-side en la UI:** El log de actividad usa `useServerPagination` con filtros por acción, entidad y usuario. No carga todo en memoria.
- **Permisos de borrado:** Solo `role === 'admin'` puede eliminar logs. Verificado en la página, no solo en el store.

### Fricción

- **`activityLogStore.addLog` no captura ni relanza** — si `createActivityLog` falla, el error se propaga al use-case caller. Esto puede interrumpir una transacción exitosa solo porque el log falló. La convención debería ser `safeAsyncSideEffect` o manejo explícito.
- **No hay tests de integración** que verifiquen que un `createVentaUseCase` efectivamente genera un log con los campos correctos. La cobertura de logging es de fe, no verificada.
- **`deleteActivityLogsUseCase`** y **`deleteActivityLogsOlderThanUseCase`** no logean su propia ejecución (ironic gap — borrar logs no crea un log de auditoría de la eliminación).

### Veredicto

El patrón de logging es sólido. Los gaps son de cobertura y edge-case handling, no de diseño.

---

## 9. Cobertura de Tests — **6.5 / 10**

### Datos
- **73 archivos `.test.ts`** en `src/`
- **284 tests passing**, 0 failing
- Distribución: use-cases (16 archivos), supabase/adapters (10), hooks/utils (18), stores (2)

### Fortalezas

- **RPC adapters testeados:** Los 4 RPC adapters críticos (ventas, servicios, payments, categorias) tienen tests de contrato. Si un RPC cambia su firma, los tests fallan.
- **Notifications bien cubiertas:** 4 archivos de tests para el módulo de notificaciones — el área de mayor complejidad de reglas de negocio.
- **Safety utils testeados:** `src/lib/utils/safety.test.ts` verifica UUID regex, assertions, y manejo de números.
- **Idempotency testeado:** `withIdempotencyKey` tiene su propio test.

### Fricción

- **0 tests de workflow completo:** No hay ningún test que verifique `createVentaMutation()` → `afterVentaCreated()` → query invalidation → refetch. Los tests unitarios no detectan bugs de integración en la cadena mutation → reaction.
- **19 stores, 2 con tests:** `pwaStore`, `notificacionesStore`, `dashboardFilterStore`, `whatsappToastStore` — sin tests. Los stores con lógica real (pwa, whatsapp queue) no tienen coverage.
- **0 tests para store-reactions:** `afterVentaCreated`, `afterVentaDeleted`, `afterServicioUpdated` no están testeados. Son funciones puras + side effects — perfectamente testeables.
- **0 tests para `client-domain-mutations.ts`:** El facade que orquesta todo no tiene tests.
- **Componentes sin tests:** La capa de UI no tiene tests de integración (acceptable para formularios complejos, pero un smoke test de renders ayudaría).

### Veredicto

La base de tests es sólida para las capas más profundas. El gap crítico es la ausencia de tests de integración para la cadena completa mutation → reaction → cache.

---

## 10. Componentes y Capa UI — **7 / 10**

### Archivos evaluados
- `src/components/` (16 subdirectorios)
- `src/components/ventas/form/create/venta-create-controller-helpers.ts` (266 líneas)
- `src/components/terceros/useTerceroFormController.ts` (275 líneas)
- `src/app/(dashboard)/servicios/detalle/[id]/ServicioDetalleClient.tsx` (275 líneas)
- `src/components/layout/Sidebar.tsx` (279 líneas)

### Fortalezas

- **Componentes bajo el umbral de 300 líneas:** Todos los componentes están entre 266-283 líneas — ninguno lo supera actualmente.
- **Mutaciones vía facade:** Los componentes llaman `createVentaMutation()`, no use-cases directamente. El Seam está respetado.
- **`ModuleErrorBoundary`** envuelve todas las páginas de dashboard — fallos de un módulo no crashean la app entera.
- **Sidebar y layout** manejan nav, permisos y mobile responsive en un archivo cohesivo — no es shallow, es complejo pero justificado.

### Fricción

- **`venta-create-controller-helpers.ts` (266 líneas)** mezcla helpers de UI (`getPerfilesDropdown`) con validación de dominio (`validateVentaCreateDatosStep`, `validateVentaItemSelection`). La validación de dominio debería vivir en el use-case, no en el helper de componente.
- **`useTerceroFormController.ts` (275 líneas)** es un hook de formulario que sabe demasiado — maneja RHF, validación, navegación entre tabs y mutaciones. Tres responsabilidades.
- **0 tests de componentes:** Ningún snapshot, render test, o integration test cubre la capa UI. Un bug de regresión visual no sería detectado por la suite actual.
- **Memoización ausente** en los helpers que ordenan listas (`sortTercerosByNewest`, `sortServiciosByNewest`) — se recalculan en cada render aunque los datos no cambien.

### Veredicto

La capa UI respeta los Seams y no tiene bypasses visibles. La fricción es de granularidad interna y ausencia de tests.

---

## 11. Documentación Arquitectural (ADRs + CONTEXT.md) — **9 / 10**

### Archivos evaluados
- `CONTEXT.md`
- `docs/adr/ADR-0001` a `ADR-0007`

### Fortalezas

- **7 ADRs documentados y vigentes:** Cada decisión crítica tiene su ADR — React Query vs Zustand, RPC idempotency, dashboard read models, event bus, RLS model, modular monolith.
- **CONTEXT.md define el lenguaje de dominio:** `Tercero`, `Servicio`, `Venta`, `Pago`, `Notificacion`, `Reposo`, `Pronostico Financiero` — todos definidos con precisión. Los archivos de código usan estos nombres consistentemente.
- **Los ADRs incluyen comandos de validación:** `rg -n "from '@/lib/supabase'" src/store` — se pueden verificar mecánicamente.
- **Decisiones justificadas con el motivo:** ADR-0006 explica por qué RLS single-tenant es aceptable y cuándo dejaría de serlo.

### Fricción

- **ADR-0007 fue violado antes del refactor de esta sesión** — indica que los ADRs no son verificados automáticamente en CI. Sin una regla de lint o un test que haga `rg` en CI, los ADRs son guías, no guardianes.
- **No hay ADR para el patrón de store-reactions** — un área de mediana complejidad que un futuro contribuidor podría reimplementar de manera distinta sin saber que ya existe esta convención.
- **CONTEXT.md no documenta `Reposo` como estado de Servicio** — aparece en el código y en nombres de archivos pero falta en el glosario principal.

### Veredicto

La documentación arquitectural es excepcional para un proyecto de este tamaño. Los gaps son menores y concretos.

---

## 12. Nomenclatura y Navegabilidad — **8.5 / 10**

### Observaciones

- **Consistencia alta:** `ventas-write-use-cases.ts`, `ventas-query-use-cases.ts`, `ventas-shared.ts` — el patrón `{domain}-{responsibility}-use-cases.ts` es predecible.
- **Prefijos de dominio en todos los archivos:** `servicios-payment-use-cases.ts`, `notificaciones-renewal-use-cases.ts`, `terceros-mutation-reactions.ts` — un archivo nuevo en el directorio incorrecto sería inmediatamente obvio.
- **Las funciones siguen el patrón `verbNounUseCase`:** `createVentaUseCase`, `deleteServicioDetalleWorkflow`, `fetchMetodosPagoCountsUseCase`. Ningún nombre genérico (`handleData`, `processItem`).
- **`domain-read-adapters.ts` todavía mezcla** adapters reales con funciones utilitarias (`fetchServiciosByIdsRead`, `getServicioContrasenaRead`). El nombre del archivo no comunica que tiene transformaciones sustantivas.

### Fricción menor

- `client-domain-mutations.ts` (263 líneas, 19 mutaciones) agrupa todas las mutaciones en un archivo. Navegar a la mutación de un dominio específico requiere scroll o búsqueda.
- Algunas funciones en `domain-read-adapters.ts` (`queryMetodosPagoServiciosRead`, `queryMetodosPagoTercerosRead`) tienen lógica de filtro que no es inmediatamente evidente desde el nombre.

---

## Resumen Global

| # | Apartado | Calificación |
|---|----------|-------------|
| 1 | Use-Cases (núcleo de negocio) | **8.5** |
| 2 | Repositorios Supabase | **9.0** |
| 3 | Stores Zustand | **8.0** |
| 4 | React Query Hooks | **9.0** |
| 5 | Módulos Profundos (Payments, Notifications, Dashboard) | **8.0** |
| 6 | StoreEventBus y Reactions | **9.5** |
| 7 | Seguridad y Validación | **9.0** |
| 8 | Logging y Auditoría | **8.5** |
| 9 | Cobertura de Tests | **6.5** |
| 10 | Componentes y Capa UI | **7.0** |
| 11 | Documentación Arquitectural | **9.0** |
| 12 | Nomenclatura y Navegabilidad | **8.5** |

### **Calificación Global: 8.4 / 10**

---

## Top 5 oportunidades de mejora (priorizadas)

| # | Oportunidad | Impacto | Esfuerzo |
|---|-------------|---------|---------|
| 1 | Tests de integración para la cadena mutation → reaction → cache | Alto | Medio |
| 2 | Tests para `store-reactions/` y `client-domain-mutations.ts` | Alto | Bajo |
| 3 | Extraer validación de dominio de `venta-create-controller-helpers.ts` a use-case | Medio | Bajo |
| 4 | Auditar y eliminar mutaciones sin caller en `configStore` | Medio | Bajo |
| 5 | Alerting para fallos silenciosos en `safeAsyncSideEffect` (reactions críticas) | Alto | Medio |

---

## Diagnóstico arquitectural

El proyecto tiene **una arquitectura madura y disciplinada**. Los módulos más críticos (payments, notifications, event bus, RPC adapters) son genuinamente profundos — interfaces pequeñas con implementación concentrada. Los ADRs reflejan decisiones reales, no aspiracionales.

La calificación global de **8.4** se sostiene: el único apartado por debajo de 7 es la cobertura de tests, que es la brecha más concreta entre la arquitectura declarada y la verificada. Todo lo demás está por encima de 8, lo que indica que la disciplina arquitectural se mantiene en la práctica, no solo en los documentos.

El siguiente paso natural, si se desea profundizar, es elegir uno de los candidatos del Top 5 y entrar al **grilling loop** para diseñar la interface del módulo profundizado antes de implementar.
