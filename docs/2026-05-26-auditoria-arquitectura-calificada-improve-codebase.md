# Auditoria de arquitectura calificada

**Fecha:** 2026-05-26  
**Proyecto:** MovieTime PTY / MovieTime-Supabase  
**Skill usada:** `improve-codebase-architecture`  
**Alcance:** repo completo local: `src`, `supabase`, `scripts`, `docs`, `tests`  
**Modelo evaluado:** monolito modular con Modules profundos, segun `CONTEXT.md` y ADRs vigentes.

## Resumen ejecutivo

El proyecto esta en buen estado operativo: lint, tests, coverage, build, validacion Supabase y escaneo de secretos pasan. La direccion arquitectonica es clara y esta bien documentada: Supabase/Postgres es la fuente de verdad, los RPCs criticos estan concentrados en Adapters tipados, React Query cubre muchas lecturas remotas, y los Modules de payments, notifications, dashboard-read-models, forecasting, events y PWA ya aportan Depth real.

La friccion principal no esta en errores de build ni en falta de estructura, sino en Seams incompletos: algunos stores todavia importan Supabase, algunas pantallas/componentes leen repositorios o read adapters directamente, y varias invalidaciones siguen dispersas fuera de `store-reactions`. Eso reduce Locality: para cambiar una lectura o una invalidacion hay que revisar UI, hooks, stores, use-cases y Adapters.

**Calificacion global: 7.9 / 10.**

Es una base sana y mantenible, pero no la calificaria como "cerrada enterprise" todavia porque ADR-0002 y ADR-0007 no estan completamente reflejadas en el codigo actual.

## Evidencia ejecutada

Estado de git:

```txt
## main...origin/main
```

Workspace limpio antes de crear este informe.

Inventario:

| Area | Valor |
| --- | ---: |
| Archivos auditables en `src`, `tests`, `docs`, `supabase`, `scripts` | 748 |
| Archivos de test en `src` y `tests` | 74 |
| Migraciones Supabase | 82 |
| Archivos en `src/app` | 100 |
| Archivos en `src/components` | 261 |
| Archivos en `src/lib` | 192 |
| Archivos en `src/hooks` | 33 |
| Archivos en `src/store` | 19 |

Validaciones:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Pasa sin warnings |
| `npm test -- --run` | Pasa: 74 archivos, 284 tests |
| `npm run test:coverage` | Pasa: 48.17% statements, 37.57% branches, 45.14% functions, 51.91% lines |
| `npm run build` | Pasa con Next.js 16.2.4 |
| `npm run migrate:validate` | Pasa, 0 blocking failures, 0 security failures |
| `npm run secrets:scan` | Pasa |

Validacion Supabase relevante:

```json
{
  "blockingFailures": {},
  "securityFailures": {},
  "securityValidations": {
    "rls_disabled_app_tables": 0,
    "required_rpc_executable_by_anon": 0,
    "security_definer_executable_by_anon": 0,
    "security_definer_missing_search_path": 0,
    "required_rpc_missing_authenticated_execute": 0,
    "unapproved_security_definer_executable_by_authenticated": 0
  },
  "acceptableReports": {
    "ventas_archivadas_activas": 7
  },
  "status": "passed"
}
```

## Calificaciones por apartado

| # | Apartado | Calificacion |
| ---: | --- | ---: |
| 1 | Documentacion, ADRs y lenguaje de dominio | 8.0 |
| 2 | Use-cases de dominio | 8.2 |
| 3 | Supabase/Postgres y RPC Adapters | 8.8 |
| 4 | React Query hooks y query keys | 8.2 |
| 5 | Zustand stores | 6.2 |
| 6 | StoreEventBus, reactions e invalidacion | 8.0 |
| 7 | Modules profundos: payments, notifications, dashboard, forecasting, PWA | 8.3 |
| 8 | UI, formularios y controllers | 7.0 |
| 9 | Seguridad, RLS y rutas server-side | 9.0 |
| 10 | Testing y coverage | 7.2 |
| 11 | Operabilidad, scripts y build | 8.0 |
| 12 | Navegabilidad y AI-navigability | 7.3 |

**Promedio ponderado:** 7.9 / 10.

## 1. Documentacion, ADRs y lenguaje de dominio - 8.0 / 10

**Fortalezas**

- `CONTEXT.md` define bien el dominio: Tercero, Usuario auth, Categoria, Servicio, Venta, Pago de venta, Pago de servicio, Plan, Notificacion, Reposo, Pronostico financiero, Copia offline, Push ejecutiva, Feature flag, Store event e Idempotency key.
- `docs/adr/0001` a `0007` fijan decisiones correctas: read models Postgres, React Query para lecturas, Adapters RPC tipados, eventos cliente tipados, monolito modular, RLS single-tenant administrativo y migracion final de stores remotos.
- Las ADRs son verificables con busquedas `rg`, no solo narrativas.

**Friccion**

- Hay documentos recientes que declaran un cierre mas fuerte que el codigo actual. Por ejemplo, la auditoria calificada previa afirma que los stores ya no importan repositorios, pero el codigo actual tiene imports Supabase en `src/store/activityLogStore.ts`, `src/store/authStore.ts`, `src/store/configStore.ts` y `src/store/notificacionesStoreHelpers.ts`.
- ADR-0007 esta aceptada, pero el criterio "stores no deben importar repositorios Supabase" no se cumple completamente.
- La documentacion activa y el runtime deben reconciliarse para que otro maintainer no confie en un estado que no existe.

## 2. Use-cases de dominio - 8.2 / 10

**Fortalezas**

- Ventas y Servicios tienen Modules por responsabilidad: query, write, payment, refund/detail/shared. Eso mejora Locality frente a agregadores antiguos.
- Los use-cases criticos concentran reglas de negocio, logging, payments, idempotency, y coordination detras de Interfaces relativamente pequenas.
- La prueba de eliminacion es positiva en `createVentaUseCase`, `updateVentaUseCase`, `createServicioUseCase`, `ventas-payment-use-cases` y `servicios-payment-use-cases`: si se borran, la complejidad reaparece en muchos callers.

**Friccion**

- `src/lib/use-cases/ventas/venta-detail-use-cases.ts` tiene 313 lineas y `src/lib/use-cases/servicios/servicio-detail-use-cases.ts` tiene 319 lineas. Son cohesivos, pero empiezan a acumular workflows distintos bajo una sola Implementation.
- Algunos use-cases auxiliares siguen siendo shallow o casi pass-through, especialmente catalogos/templates/activity-log en comparacion con ventas/servicios.
- `src/lib/client-domain-mutations.ts` orquesta 19 mutaciones en un solo archivo. Funciona, pero su Interface crece con cada dominio y reduce navegabilidad.

## 3. Supabase/Postgres y RPC Adapters - 8.8 / 10

**Fortalezas**

- `npm run migrate:validate` pasa con 0 failures bloqueantes y 0 failures de seguridad.
- Las llamadas `.rpc()` aparecen concentradas en `src/lib/supabase/*-rpc-adapter.ts` y `src/lib/supabase/rpc-client.ts`.
- Los Adapters criticos de ventas, servicios, pagos, categorias y dashboard estan tipados y tienen tests.
- Idempotency existe y esta probada con `src/lib/supabase/idempotency.test.ts`.

**Friccion**

- Hay 20 imports desde `@/lib/supabase` en `src/store`, `src/app` y `src/components`. Algunos son type-only o utilitarios de paginacion, pero otros son lecturas reales desde UI: `queryVentas`, `queryServicios`, `queryNotificationsRead`, `queryMetodosPagoTercerosRead`.
- Esa mezcla debilita el Seam de lectura: el caller necesita saber si debe ir a hook, use-case, repository o domain-read-adapter.
- `domain-read-adapters.ts` todavia es un nombre demasiado amplio para funciones de lectura con distintos niveles de transformacion.

## 4. React Query hooks y query keys - 8.2 / 10

**Fortalezas**

- `src/lib/query-keys.ts` centraliza claves por dominio y permite invalidacion precisa.
- Los hooks de `src/hooks` siguen un patron consistente de lectura remota con React Query.
- Coverage y tests protegen varias lecturas relevantes: dashboard, feature flags, pagos, ventas por tercero, notificaciones, etc.

**Friccion**

- Algunas pantallas y componentes saltan el hook/use-case y llaman Supabase directamente, por ejemplo `src/components/ventas/form/useVentaFormQueries.ts`, `src/components/ventas/form/useVentaPerfilDetalle.ts`, `src/components/servicios/ServiciosCategoriaMetrics.tsx`.
- Varias invalidaciones estan en UI o hooks, no solo en `store-reactions`.
- El default global de React Query soporta la mayoria de stale behavior; eso esta bien, pero cambios globales podrian alterar muchas lecturas sin una decision por Module.

## 5. Zustand stores - 6.2 / 10

**Fortalezas**

- Muchos stores ya son pequeños y orientados a UI: `ventasStore`, `serviciosStore`, `tercerosStore`, `categoriasStore`, `gastosStore`, `templatesStore`.
- Hay tests que verifican que `ventasStore` y `serviciosStore` no exponen fetch remoto legacy.
- `notificacionesStore.ts` es pequeño y solo mantiene `error`.

**Friccion**

- ADR-0007 no esta cerrada: `activityLogStore`, `authStore`, `configStore` y `notificacionesStoreHelpers` importan Supabase o Adapters de lectura.
- `configStore` contiene mutaciones remotas (`updateTasasCambio`, `updateDiasNotificacion`, `updateHoraEnvio`, `updatePrefijoWhatsApp`, `updateExecutivePush`) y actua como Adapter de escritura, no solo como estado UI.
- `authStore` mezcla estado UI, sesion Supabase, Copia offline y browser storage. Puede ser justificado por auth/offline, pero su Interface es grande y requiere conocer muchos modos de error.
- Coverage de `src/store` es bajo: 14.95% statements, 15.38% lines.

## 6. StoreEventBus, reactions e invalidacion - 8.0 / 10

**Fortalezas**

- `src/lib/events/store-event-bus.ts` esta bien tipado y sin acoplamiento DOM.
- `src/lib/store-reactions` concentra varias reacciones por dominio.
- No hay imports de `@/store` desde `src/lib/use-cases`, `payments`, `notifications`, `dashboard-read-models`, `forecasting` ni `supabase`.

**Friccion**

- `src/lib/client-domain-mutations.ts` tambien llama `invalidateStoreQueries`, y muchas UI/hooks hacen `queryClient.invalidateQueries` directamente.
- `src/lib/store-reactions/ventas-mutation-reactions.ts` importa `invalidateStoreQueries` desde `@/store/store-query-invalidation`; funciona, pero mantiene una dependencia desde `lib` hacia `store` para infraestructura de cache.
- Faltan tests directos para reactions. `store-event-bus.ts` esta cubierto al 100%, pero la cadena mutation -> reaction -> invalidacion/cache no tiene suficiente test de contrato.

## 7. Modules profundos - 8.3 / 10

**Fortalezas**

- `src/lib/payments` es un Module Deep: conversion, factories, snapshots y calculos quedan detras de una Interface compacta. Coverage: 89.23% statements, 90.9% lines.
- `src/lib/dashboard-read-models` cumple ADR-0001. Coverage: 86.66% statements, 92.85% lines.
- `src/lib/forecasting` esta bien protegido. Coverage: 92.1% statements, 97.05% lines.
- `src/lib/pwa/offline-facade.ts` ofrece una Interface clara para Copia offline.

**Friccion**

- `src/lib/notifications` tiene buena direccion, pero coverage mixto: 50% statements, 51.37% lines. Algunos internals como bulk sync, orchestrator y sync-state estan poco cubiertos.
- `src/lib/services` parece legacy o residual frente a Modules mas profundos; su coverage es 4.5% statements.
- Hay barrels y nombres genericos que anaden navegacion sin mucho Leverage, por ejemplo algunos `index.ts` o `domain-read-adapters`.

## 8. UI, formularios y controllers - 7.0 / 10

**Fortalezas**

- Los archivos grandes se mantienen alrededor de 250-320 lineas; no hay monstruos de 800+ lineas.
- Formularios y controllers estan segmentados por dominio y accion.
- La UI suele consumir hooks/use-cases/mutations en vez de ejecutar transacciones directamente.

**Friccion**

- Hay validacion de dominio y seleccion de negocio en helpers de UI, por ejemplo `src/components/ventas/form/create/venta-create-controller-helpers.ts`.
- `useTerceroFormController.ts`, `usePagoDialogController.ts`, `useVentasEditFormController.ts` y algunos controllers de notificaciones tienen mucha coordinacion de UI + dominio.
- Los imports directos a Supabase desde componentes reducen Depth de los hooks/use-cases.
- Coverage de componentes es irregular; formularios complejos de ventas/servicios tienen zonas bajas.

## 9. Seguridad, RLS y rutas server-side - 9.0 / 10

**Fortalezas**

- `migrate:validate` reporta 0 RLS disabled app tables, 0 RPCs requeridas ejecutables por anon, 0 security definer ejecutable por anon, y 0 missing search_path.
- `createServiceRoleClient` aparece en rutas/server Modules esperados: push subscriptions y executive push delivery.
- Rutas push tienen tests y el build valida rutas API.
- ADR-0006 declara correctamente el modelo single-tenant administrativo.

**Friccion**

- El modelo single-tenant administrativo no es multi-tenant. No es bug, pero cualquier expansion de roles/tenants requiere reabrir ADR-0006.
- Side effects no criticos usan logging local; no hay alerting externo para fallos silenciosos de reactions/sync.

## 10. Testing y coverage - 7.2 / 10

**Fortalezas**

- 74 archivos y 284 tests pasan.
- Hay thresholds progresivos en `vitest.config.ts`.
- Modules criticos tienen buena cobertura: payments, dashboard-read-models, forecasting, events, varios use-cases de notificaciones y servicios.

**Friccion**

- Coverage global todavia es moderado: 48.17% statements, 37.57% branches, 45.14% functions, 51.91% lines.
- `src/store` esta muy bajo: 14.95% statements.
- `src/lib/supabase` esta bajo en promedio porque repositorios/core generico tienen poca cobertura, aunque los RPC Adapters si estan mejor.
- Falta un test de contrato de la cadena completa mutation -> use-case -> reaction -> invalidacion.

## 11. Operabilidad, scripts y build - 8.0 / 10

**Fortalezas**

- `npm run build`, `npm run migrate:validate`, `npm run secrets:scan` pasan.
- `scripts/validate-supabase-migration.ts` aporta una compuerta real de datos y seguridad.
- `scripts/scan-secrets.mjs` existe y no reporta hallazgos.

**Friccion**

- No vi una compuerta que falle si vuelven imports prohibidos por ADR-0007.
- La documentacion enumera busquedas `rg`, pero esas reglas no parecen automatizadas como test/lint.

## 12. Navegabilidad y AI-navigability - 7.3 / 10

**Fortalezas**

- El naming por dominio es consistente: ventas, servicios, terceros, categorias, metodos-pago, notificaciones.
- La estructura de `src/lib/use-cases/{dominio}` es predecible.
- `CONTEXT.md` ayuda a que nuevos maintainers y agentes usen lenguaje correcto.

**Friccion**

- Hay multiples caminos para una lectura: hook, use-case, repository, domain-read-adapter y, en algunos casos, componente directo.
- `client-domain-mutations.ts` funciona como punto unico, pero al crecer se vuelve un mapa grande de todo el dominio.
- La documentacion previa y el codigo actual discrepan en algunos cierres, lo que aumenta el costo de orientacion.

## Hallazgos clave

1. **Validaciones verdes, arquitectura no totalmente cerrada.** El proyecto compila y pasa tests, pero todavia hay Seams incompletos en estado/cache/lecturas.
2. **ADR-0007 esta parcialmente incumplida.** Stores o helpers de store siguen importando Supabase.
3. **UI todavia conoce demasiada infraestructura de lectura.** Hay llamadas directas desde componentes/paginas a repositories/read adapters.
4. **Los Modules profundos mas importantes estan bien protegidos.** Payments, dashboard-read-models y forecasting destacan.
5. **El gap mas accionable es testear reactions y cadena de mutacion.** No requiere reescritura y aumentaria mucha confianza.

## Candidatos de profundizacion

### 1. Cerrar el Module de Configuracion

**Files**

- `src/store/configStore.ts`
- `src/hooks/use-config.ts`
- `src/lib/supabase/config-repository.ts`
- `src/components/layout/useConfiguracionDialogController.ts`

**Problem**

`configStore` tiene una Interface de store, pero su Implementation hace IO remoto y normaliza reglas de Push ejecutiva/configuracion. Es shallow como store UI porque el caller debe entender mutaciones remotas, shape fisico de config y estado visual.

**Solution**

Mover las mutaciones a un Module de use-case o config-domain-mutations y dejar el store solo para estado UI temporal del dialog.

**Benefits**

Mejora Locality de configuracion y cumple ADR-0007. La Interface del store queda pequena; las pruebas pueden cruzar el Seam de config sin montar Zustand.

### 2. Unificar lecturas UI -> hook/use-case

**Files**

- `src/components/ventas/form/useVentaFormQueries.ts`
- `src/components/ventas/form/useVentaPerfilDetalle.ts`
- `src/components/servicios/ServiciosCategoriaMetrics.tsx`
- `src/app/(dashboard)/dashboard/useDashboardNotificationToast.tsx`
- `src/app/(dashboard)/reposo/reposo-helpers.ts`
- `src/app/(dashboard)/terceros/useTercerosPageController.ts`

**Problem**

La UI importa `@/lib/supabase` directamente. Eso hace que el Seam de lectura sea ambiguo y reduce Leverage de React Query/use-cases.

**Solution**

Crear hooks o use-cases especificos por lectura y prohibir imports directos a Supabase desde `src/app` y `src/components`, salvo tipos compartidos documentados.

**Benefits**

Sube Locality: cambios de schema o mapping viven en Adapters/use-cases. Las pantallas quedan mas simples y los tests pueden mockear el Seam correcto.

### 3. Testear la cadena mutation -> reaction -> cache

**Files**

- `src/lib/client-domain-mutations.ts`
- `src/lib/store-reactions/*`
- `src/store/store-query-invalidation.ts`
- `src/lib/events/store-event-bus.ts`

**Problem**

Hay tests unitarios de Modules profundos, pero poca verificacion de la cadena que coordina mutacion, event bus, invalidacion y cache.

**Solution**

Agregar tests de contrato para `createVentaMutation`, `updateServicioMutation`, `deleteCategoriaMutation` y un flujo de Notificacion. Mockear use-cases y query client activo.

**Benefits**

Protege el comportamiento real que ve la UI. Aumenta Leverage de `store-reactions` y permite refactors sin miedo en cache/invalidation.

### 4. Dividir `client-domain-mutations` por dominio

**Files**

- `src/lib/client-domain-mutations.ts`
- `src/lib/store-reactions/*`

**Problem**

Un solo Module agrupa casi todas las mutaciones cliente. La Interface crece con cada dominio y la Implementation mezcla categorias, gastos, metodos de pago, terceros, servicios, ventas y templates.

**Solution**

Convertirlo en facade por dominio: `ventas-client-mutations`, `servicios-client-mutations`, `catalogos-client-mutations`, con un barrel publico si se quiere conservar imports.

**Benefits**

Mejora AI-navigability y Locality por dominio. La prueba de eliminacion indica que cada slice conservaria complejidad propia sin obligar a navegar todo el archivo.

### 5. Profundizar workflows de detalle Venta/Servicio

**Files**

- `src/lib/use-cases/ventas/venta-detail-use-cases.ts`
- `src/lib/use-cases/servicios/servicio-detail-use-cases.ts`
- `src/app/(dashboard)/ventas/[id]/components/useVentaDetalleActions.ts`
- `src/app/(dashboard)/servicios/detalle/[id]/components/useServicioSaleActions.ts`

**Problem**

Los detail use-cases son utiles, pero acumulan varios workflows. La Interface por archivo es mas grande que la accion mental del caller.

**Solution**

Agrupar workflows por accion real: renewal, transfer/cut, payment, delete, y exponer outcomes pequenos.

**Benefits**

Mas Depth por Module, menos scrolling y tests mas enfocados. Los callers aprenden una Interface por workflow en vez de una Interface grande de detalle.

## Reglas sugeridas para automatizar

Estas busquedas deberian pasar en CI si se quiere convertir ADR-0007 en compuerta:

```bash
rg -n "from ['\"]@/store" src/lib/use-cases src/lib/payments src/lib/notifications src/lib/dashboard-read-models src/lib/forecasting src/lib/supabase
rg -n "from ['\"]@/lib/supabase" src/store
rg -n "from ['\"]@/lib/supabase" src/app src/components
rg -n "typedRpcClient|\\.rpc\\(" src
```

La tercera busqueda necesitara allowlist temporal para tipos como `FilterOption` o una reubicacion de esos tipos fuera de `src/lib/supabase`.

## Veredicto

MovieTime PTY ya tiene una arquitectura por encima del promedio para un producto de este tamano. No necesita reescritura. El trabajo correcto es cerrar Seams concretos, no cambiar de stack.

La nota baja relativa esta concentrada en Zustand, UI directa contra Supabase y tests de integracion de cache/reactions. Si esos tres puntos se corrigen, el proyecto podria subir facilmente a 8.5+ sin tocar la arquitectura base.
