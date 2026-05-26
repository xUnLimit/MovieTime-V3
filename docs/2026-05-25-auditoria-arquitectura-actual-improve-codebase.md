# Auditoria actual de arquitectura y estado del proyecto

**Fecha:** 2026-05-25  
**Proyecto:** MovieTime PTY / MovieTime-Supabase  
**Skill usada:** `improve-codebase-architecture`  
**Alcance:** repo completo en el workspace local, con foco en arquitectura, dominio, Supabase/Postgres, estado cliente, PWA, seguridad, pruebas, operaciones, documentacion y oportunidades de profundizar Modules.

## Resumen ejecutivo

MovieTime PTY esta en un estado sano para seguir evolucionando como monolito modular. La direccion arquitectonica documentada en `CONTEXT.md` y `docs/adr/` esta mayormente reflejada en el codigo actual: Supabase/Postgres es la fuente de verdad, las operaciones criticas usan RPC Adapters tipados, existe idempotencia por usuario, el dashboard lee read models, React Query ya cubre muchas lecturas remotas y Zustand esta quedando como frontera de UI/compatibilidad.

La diferencia mas importante frente a auditorias anteriores es que varios hallazgos criticos ya fueron cerrados. En el estado actual:

- `/api/push/pending` ya exige admin autenticado y filtra el endpoint por `user.id`.
- La tabla `rpc_idempotency_keys` ya usa `PRIMARY KEY (created_by, rpc_name, idempotency_key)`.
- `npm test -- --run` pasa completo: 66 archivos de test, 243 tests.
- `npm run lint`, `npm run build`, `npm run migrate:validate` y `npm run secrets:scan` pasan.

Los riesgos actuales no justifican una reescritura. La deuda real esta en terminar de profundizar algunos Modules, reducir interfaces shallow, concentrar casts estructurales en Adapters, adelgazar stores de dominio y ordenar documentos historicos que ya no representan el runtime actual.

## Evidencia usada

Documentos revisados:

- `CONTEXT.md`
- `README.md`
- `ARCHITECTURE_ROADMAP.md`
- `docs/adr/0001-dashboard-read-models-postgres.md`
- `docs/adr/0002-react-query-zustand-ownership.md`
- `docs/adr/0003-typed-rpc-adapters-and-idempotency.md`
- `docs/adr/0004-typed-client-events.md`
- `docs/adr/0005-modular-monolith-deep-modules.md`
- `docs/adr/0006-single-tenant-admin-rls-model.md`
- `docs/2026-05-25-enterprise-project-audit.md`
- `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`

Codigo y estructura revisada:

- `src/app`
- `src/components`
- `src/hooks`
- `src/store`
- `src/lib/use-cases`
- `src/lib/supabase`
- `src/lib/payments`
- `src/lib/notifications`
- `src/lib/dashboard-read-models`
- `src/lib/forecasting`
- `src/lib/pwa`
- `src/lib/executive-push`
- `supabase/migrations`
- `scripts`

Comandos ejecutados para estado actual:

```bash
git status --short --branch
rg --files src tests docs supabase scripts
rg --files -g "*.test.*" src tests
rg --files supabase/migrations
rg -n "as unknown|Record<string, unknown>|window.dispatchEvent|new CustomEvent|localStorage.setItem|dynamic import|import(" src
rg -n "TODO|FIXME|HACK|legacy|deprecated|any\b|eslint-disable|@ts-ignore|@ts-expect-error" src scripts supabase docs
npm test -- --run
npm run lint
npm run build
npm run migrate:validate
npm run secrets:scan
```

## Estado git y workspace

```txt
## main...origin/main [ahead 3]
```

No habia archivos modificados en `git status --short` antes de crear este documento. La rama local `main` esta 3 commits por delante de `origin/main`.

## Inventario actual

| Area | Valor |
| --- | ---: |
| Archivos auditables en `src`, `tests`, `docs`, `supabase`, `scripts` | 722 |
| Archivos de prueba en `src` y `tests` | 66 |
| Migraciones Supabase | 82 |
| Archivos en `src/app` | 98 |
| Archivos en `src/components` | 261 |
| Archivos en `src/lib` | 178 |
| Archivos en `src/hooks` | 31 |
| Archivos en `src/store` | 17 |
| Archivos en `src/types` | 12 |
| Archivos en `src/features` | 4 |
| Archivos en `src/config` | 4 |

## Stack actual

Desde `package.json`:

- App: Next.js `^16.2.4`, React `19.2.3`, TypeScript `^5`.
- Datos remotos/cache: `@tanstack/react-query` `^5.100.13`.
- Estado local: Zustand `^5.0.10`.
- Backend: Supabase JS `^2.105.3`, `@supabase/ssr` `^0.10.2`.
- Formularios/validacion: React Hook Form `^7.71.1`, Zod `^4.3.6`.
- UI: Tailwind 4, Radix UI, shadcn-style components, lucide-react.
- Tests: Vitest `^4.1.5`, Testing Library, jsdom, coverage V8.

## Validaciones actuales

| Comando | Estado | Detalle |
| --- | --- | --- |
| `npm test -- --run` | Pasa | 66 archivos, 243 tests, 22.42s. |
| `npm run lint` | Pasa con warnings | 0 errores, 7 warnings de imports/params no usados. |
| `npm run build` | Pasa | Next 16.2.4 con Turbopack; build y TypeScript correctos. |
| `npm run migrate:validate` | Pasa | Validaciones funcionales y de seguridad sin failures bloqueantes. |
| `npm run secrets:scan` | Pasa | Sin salida de hallazgos. |

Warnings actuales de lint:

- `src/lib/notifications/notification-event-listeners.ts`: 3 params `event` no usados.
- `src/lib/use-cases/activity-log-use-cases.ts`: 2 imports no usados.
- `src/lib/use-cases/categorias-use-cases.ts`: 2 imports no usados.

`migrate:validate` reporto datos actuales del proyecto Supabase vinculado:

```json
{
  "terceros": 496,
  "servicios": 166,
  "categorias": 10,
  "metodos_pago": 18,
  "tipos_gasto": 6,
  "gastos": 16,
  "templates": 9,
  "activity_log": 620,
  "pagos_servicio": 284,
  "ventas": 498,
  "pagos_venta": 755
}
```

Validaciones importantes:

- `doble_venta_perfil`: 0
- `ventas_sin_servicio`: 0
- `pagos_venta_sin_periodo`: 0
- `pagos_servicio_sin_periodo`: 0
- `servicios_archivados_activos`: 0
- `periodos_venta_saldo_distinto`: 0
- `ventas_categoria_inconsistente`: 0
- `perfiles_ocupados_inconsistentes`: 0
- `periodos_servicio_saldo_distinto`: 0
- `ventas_archivadas_activas`: 7, aceptado por el script como reporte permitido.

Validaciones de seguridad:

- `rls_disabled_app_tables`: 0
- `required_rpc_executable_by_anon`: 0
- `security_definer_executable_by_anon`: 0
- `security_definer_missing_search_path`: 0
- `required_rpc_missing_authenticated_execute`: 0
- `unapproved_security_definer_executable_by_authenticated`: 0

## Dominio actual

El vocabulario vigente esta en `CONTEXT.md`. Los conceptos principales son:

- `Tercero`: persona o negocio administrado por la app; puede ser cliente o revendedor.
- `Categoria`: agrupacion comercial para servicios, ventas, planes, contadores, ingresos y gastos.
- `Servicio`: cuenta o suscripcion de proveedor con perfiles, periodos, pagos y renovaciones.
- `Venta`: suscripcion de cliente asignada a un servicio/perfil.
- `Pago de venta`: dinero recibido para un periodo de venta.
- `Pago de servicio`: gasto pagado para un periodo de servicio.
- `Plan`: oferta vendible dentro de una categoria, con snapshots historicos en ventas.
- `Notificacion`: recordatorio operacional derivado de ventas y servicios proximos a vencer.
- `Reposo`: estado pausado temporal de un servicio.
- `Pronostico financiero`: read model usado por dashboard para ingresos y gastos proximos.
- `Metodo de pago`: metadata copiada en pagos para auditoria.
- `Copia offline`: fallback de lectura en navegador; mutaciones requieren online.
- `Push ejecutiva`: resumen push programado de metricas operativas.
- `Feature flag`: rollout runtime almacenado en Supabase.
- `Store event`: evento cliente tipado para invalidar queries/stores.
- `Idempotency key`: UUID de cliente para evitar duplicacion en retries de RPCs criticas.

El codigo actual todavia conserva nombres internos como `usuario` en algunos sitios por historia de migracion, pero el lenguaje de dominio nuevo es `Tercero`.

## ADRs vigentes y cumplimiento

### ADR-0001: Dashboard read models desde Postgres

Estado actual: cumplida.

Evidencia:

- `src/lib/dashboard-read-models/dashboard-read-models.ts` lee via `getDashboardStatsLiveRpc`, `getDashboardHomeRpc` y `getDashboardChurnStatsRpc`.
- Las metricas derivadas no se mutan como estado de cliente.
- Hooks como `use-dashboard-home.ts` y `use-dashboard-stats.ts` usan React Query.

Riesgo residual:

- Algunos componentes todavia invalidan queries manualmente. No rompe ADR-0001, pero reduce Locality de invalidacion.

### ADR-0002: React Query para lecturas remotas y Zustand para UI

Estado actual: cumplida parcialmente e incremental.

Evidencia:

- Muchos hooks de lectura ya usan `useQuery` y `queryKeys`.
- `src/lib/query-keys.ts` centraliza keys.
- `src/lib/query-client.ts` centraliza cliente/defaults.

Riesgo residual:

- Stores como `ventasStore`, `serviciosStore`, `tercerosStore`, `notificacionesStore`, `metodosPagoStore`, `gastosStore`, `categoriasStore` y `templatesStore` todavia importan repositorios Supabase y mantienen cache/acciones remotas. Esto esta documentado como frontera legacy/compatibilidad, pero sigue siendo una Interface shallow.

### ADR-0003: RPCs criticas con Adapters tipados e idempotencia

Estado actual: mayormente cumplida.

Evidencia:

- `src/lib/supabase/ventas-rpc-adapter.ts`
- `src/lib/supabase/servicios-rpc-adapter.ts`
- `src/lib/supabase/payments-rpc-adapter.ts`
- `src/lib/supabase/idempotency.ts`
- `supabase/migrations/20260523183000_rpc_idempotency_keys.sql`
- `supabase/migrations/20260524131500_lock_idempotent_rpc_permissions.sql`

Estado actual confirmado:

- Idempotencia esta aislada por usuario con `PRIMARY KEY (created_by, rpc_name, idempotency_key)`.
- `required_rpc_executable_by_anon` y `security_definer_executable_by_anon` estan en 0.

Riesgo residual:

- `typedRpcClient<TClient>()` usa `supabase as unknown as TClient`. Esto es aceptable como Adapter interno, pero el repo todavia tiene muchos `Record<string, unknown>` y casts fuera de Adapters profundos.

### ADR-0004: Eventos cliente tipados

Estado actual: cumplida parcialmente.

Evidencia:

- `src/lib/events/store-event-bus.ts` define eventos tipados.
- `src/lib/events/cache-reactions.ts` concentra varias invalidaciones.
- No se detectaron `window.dispatchEvent` ni `new CustomEvent` para comunicacion de negocio.

Riesgo residual:

- Aun existen invalidaciones directas de React Query en paginas/componentes.
- Algunas dependencias de store se concentran en archivos como `venta-detalle-store-dependencies.ts` y `servicio-detalle-store-dependencies.ts`, lo cual es mejor que imports dispersos, pero todavia expone la frontera de compatibilidad.

### ADR-0005: Monolito modular con Modules profundos

Estado actual: buena direccion, con deuda residual en Depth.

Modules ya profundizados o encaminados:

- `dashboard-read-models`
- `notifications`
- `payments`
- `events`
- `pwa/offline-facade`
- `executive-push`
- `supabase/*-rpc-adapter`

Modules todavia shallow o mixtos:

- Stores de dominio.
- Algunos use-cases agregadores antiguos en `src/lib/use-cases/*.ts`.
- `record-core`, `pagination`, `read-models`, `write-utils` como core generico Supabase.
- Formularios complejos de venta/servicio/metodo de pago.

### ADR-0006: Modelo RLS single-tenant administrativo

Estado actual: documentado y validado.

Evidencia:

- Rutas sensibles con service role exigen admin via `requireAuthenticatedAdmin`.
- `migrate:validate` no reporta failures de RLS/RPC.

Riesgo residual:

- El modelo es single-tenant administrativo. Si el producto cambia a multiusuario con permisos finos o multi-tenant, esta ADR debe reabrirse antes de tocar RLS.

## Estado por Module

| Module | Estado actual | Depth | Riesgo |
| --- | --- | --- | --- |
| `src/lib/dashboard-read-models` | Read model claro sobre RPCs de dashboard. | Deep | Bajo |
| `src/lib/supabase/*-rpc-adapter` | Seam real para RPCs criticas. | Deep parcial | Bajo/medio |
| `src/lib/payments` | Ya tiene `financialPayments`, snapshots y movimientos firmados, pero aun reexporta factories/calculators. | Deep parcial | Medio |
| `src/lib/notifications` | Orquestacion, sync, cleanup y event listeners concentrados. | Deep parcial | Medio |
| `src/lib/events` | Event bus tipado y cache reactions. | Deep parcial | Medio |
| `src/lib/pwa/offline-facade.ts` | Fachada clara para Copia offline. | Deep | Bajo |
| `src/lib/executive-push` | API/settings/delivery separados. | Deep parcial | Bajo/medio |
| `src/lib/use-cases/ventas` | Split por query/write/payment/refund/detail/shared. | Deep parcial | Medio |
| `src/lib/use-cases/servicios` | Split por query/write/payment/detail/dependencies/shared. | Deep parcial | Medio |
| `src/store/*` | Mezcla UI, cache remota, acciones y compatibilidad. | Shallow | Medio/alto |
| `src/lib/supabase/record-core.ts` | Utilidad generica con excepciones por entidad. | Deep parcial | Medio |
| `src/lib/forecasting` | Module pequeno, pero el Pronostico financiero esta repartido con dashboard/hooks. | Shallow parcial | Medio |

## Seguridad y autorizacion

### Fortalezas actuales

- `/api/push/pending` exige `requireAuthenticatedAdmin(request)`.
- `/api/push/test` exige admin.
- `/api/push/subscriptions` exige admin en `POST` y `DELETE`.
- `/api/push/daily` exige `x-push-cron-secret` o `Authorization: Bearer`.
- `requireAuthenticatedAdmin` valida JWT con Supabase, busca perfil en `usuarios` y exige `active` + `role = admin`.
- `migrate:validate` reporta 0 RPCs criticas ejecutables por `anon`.
- `security_definer_missing_search_path` es 0.

### Riesgos residuales

1. `requireAuthenticatedAdmin` consulta la tabla `usuarios` aunque el dominio actual habla de `Tercero`. Puede estar justificado por la tabla de perfiles/auth, pero conviene documentar el nombre fisico para que no se confunda con el `Tercero` comercial.
2. El modelo single-tenant administrativo es aceptado por ADR-0006. No es un bug, pero si el negocio cambia a multiusuario/roles finos, la seguridad actual no debe reutilizarse como si fuera multi-tenant.
3. `PUSH_CRON_SECRET` en produccion puede venir de `PUSH_CRON_SECRET` o `CRON_SECRET`; esta bien validado, pero conviene mantenerlo documentado para deploy.

## Supabase/Postgres

### Fortalezas actuales

- 82 migraciones con schema, RLS, views, RPCs, triggers, validaciones, push, idempotencia y hardening.
- Validaciones de datos operativos pasan.
- Validaciones de seguridad pasan.
- Idempotencia critica ya incluye `created_by`.
- RPC permissions endurecidas en migracion posterior.
- `database.types.ts` esta generado y es usado por Adapters.

### Riesgos residuales

- `database.types.ts` tiene 3581 lineas. Es normal para Supabase generated types, pero aumenta ruido en revisiones.
- Existen casts estructurales en repositorios genericos. Deben quedar confinados a Adapters y core interno.
- `legacy_orphan_records` y referencias historicas a legacy siguen en migraciones por preservacion de datos. No es deuda runtime necesariamente, pero la documentacion debe aclarar que es historico.

## Cliente, estado y cache

### Lo que esta bien

- React Query ya esta extendido en lecturas: dashboard, categorias, gastos, metodos de pago, notificaciones, pagos, terceros, ventas, servicios, paginacion y feature flags.
- `queryKeys` centraliza claves.
- `QueryProvider` registra el query client activo.
- `StoreEventBus` existe y se usa.
- `cache-reactions` concentra varias invalidaciones.

### Friccion actual

- Todavia hay imports directos de stores desde pantallas y componentes complejos.
- Todavia hay imports directos de repositorios Supabase desde hooks/componentes.
- Algunos use-cases importan repositorios fisicos directamente. Esto no siempre es malo; el problema aparece cuando la Interface obliga al caller a conocer detalles fisicos.
- Stores de dominio siguen haciendo lecturas/mutaciones remotas. Es una frontera legacy aceptada, pero es el principal lugar donde ADR-0002 sigue incompleta.

## PWA y offline

### Estado actual

La Copia offline esta bien encaminada. `src/lib/pwa/offline-facade.ts` expone:

- `prepare`
- `status`
- `hasSnapshot`
- `shouldReadOffline`
- `readDashboardHome`
- `readCollection`
- `readById`
- `count`
- `paginate`
- `assertOnlineMutation`

Esto es un Module relativamente Deep: la UI no necesita conocer todos los detalles de IndexedDB/offline-copy para los casos principales.

### Riesgo residual

- Revisar que callers nuevos importen la facade y no los internals de `offline-copy`, salvo codigo dentro del Module PWA.
- Offline mutations siguen fuera de alcance por decision arquitectonica. No cambiar sin ADR.

## Push ejecutiva

### Estado actual

El Module esta mejor separado:

- `executive-push-api.ts` autoriza cron y expone funciones para rutas.
- `executive-push-delivery.ts` maneja envio/resumen.
- Rutas API validan admin o cron secret.
- `push_subscriptions` se actualiza server-side con service role, pero despues de validar admin.

### Riesgo residual

- La seguridad depende de que el service worker o cliente envie `Authorization` donde corresponde. Las pruebas actuales pasan, pero es un punto sensible para regresiones.
- El endpoint de pending ya no es publico en el codigo actual. Las auditorias viejas que lo marcan como critico estan desactualizadas.

## Testing

### Estado actual

La suite esta verde:

```txt
Test Files  66 passed (66)
Tests       243 passed (243)
Duration    22.42s
```

Areas cubiertas por tests:

- stores
- use-cases de ventas, servicios, terceros, categorias, metodos de pago
- RPC Adapters
- pagos
- notificaciones
- PWA/offline/push
- dashboard read models
- UI especifica de formularios y detalle

### Riesgos residuales

- No se observo umbral de coverage obligatorio en `vitest.config.ts`.
- El numero de tests es bueno, pero Modules criticos podrian tener thresholds por area: payments, RPC Adapters, notifications, dashboard-read-models, PWA.
- Los warnings de lint son pequenos y conviene limpiarlos para que lint sea una senal mas fuerte.

## Build y rutas

`npm run build` pasa. Next reporto rutas dinamicas para casi toda la app operativa:

- `/dashboard`
- `/ventas`
- `/ventas/[id]`
- `/servicios`
- `/servicios/detalle/[id]`
- `/terceros`
- `/categorias`
- `/metodos-pago`
- `/notificaciones`
- `/reposo`
- `/gastos`
- rutas API de push

Rutas estaticas/prerender:

- `/apple-icon`
- `/icon`
- `/manifest.webmanifest`

Esto es coherente con auth/CSP/estado operativo. Quitar `force-dynamic` global o cambiar estrategia de rendering no debe hacerse sin ADR porque puede afectar CSP nonce, auth y cache.

## Archivos grandes o complejos

Archivos no generados con mas lineas, excluyendo `database.types.ts`, que deberian vigilarse por complejidad:

| Archivo | Lineas |
| --- | ---: |
| `src/app/(dashboard)/servicios/detalle/[id]/components/ServicioTransferVentaDialog.tsx` | 283 |
| `src/components/servicios/form/ServicioFinanzasSection.tsx` | 276 |
| `src/components/shared/pago-dialog/usePagoDialogController.ts` | 275 |
| `src/components/terceros/useTerceroFormController.ts` | 273 |
| `src/components/ventas/form/edit/useVentasEditFormController.ts` | 272 |
| `src/components/layout/Sidebar.tsx` | 270 |
| `src/components/notificaciones/NotificationBell.tsx` | 267 |
| `src/components/notificaciones/ventas-proximas/VentasProximasTableRow.tsx` | 266 |
| `src/components/ventas/form/create/venta-create-controller-helpers.ts` | 266 |
| `src/app/(dashboard)/servicios/detalle/[id]/ServicioDetalleClient.tsx` | 265 |
| `src/components/metodos-pago/ServiciosMetodosPagoTable.tsx` | 265 |
| `src/lib/supabase/categorias-repository.ts` | 264 |
| `src/lib/supabase/notifications-repository.ts` | 263 |
| `src/components/shared/DataTable.tsx` | 263 |
| `src/components/metodos-pago/TercerosMetodosPagoTable.tsx` | 262 |
| `src/app/(dashboard)/servicios/detalle/[id]/components/ServicioProfilesSection.tsx` | 260 |
| `src/components/ventas/VentasForm.tsx` | 257 |
| `src/components/servicios/CategoriasTable.tsx` | 257 |
| `src/app/(dashboard)/ventas/[id]/components/useVentaDetalleActions.ts` | 256 |
| `src/components/shared/pago-dialog/helpers.ts` | 255 |
| `src/store/notificacionesStore.ts` | 252 |
| `src/components/ventas/form/create/useVentaCreateWorkflow.ts` | 251 |

Un archivo de 250-280 lineas no es automaticamente malo. La senal importante es si la Interface es shallow: si el caller debe entender demasiados estados, efectos, stores, queries y payloads para hacer una accion.

## Documentacion actual vs historica

Hay documentos historicos que ya no describen completamente el estado runtime actual:

- `docs/2026-05-25-enterprise-project-audit.md` marca como criticos varios puntos que el codigo actual ya corrigio.
- `docs/2026-05-25-backlog-detallado-deuda-riesgos.md` mantiene los hallazgos, pero tambien contiene una seccion de evidencia de cierre.
- `ARCHITECTURE_ROADMAP.md` dice que la migracion arquitectural principal esta cerrada.

Riesgo:

- Un maintainer nuevo puede leer primero una auditoria vieja y creer que siguen abiertos bugs ya cerrados.

Solucion:

- Mantener este documento o el backlog detallado como documento activo.
- Mover planes superados a una carpeta de archivo o marcar claramente "historico".
- Agregar un indice en `docs/README.md` o `docs/adr/README.md` que diga que documento representa el estado actual.

## Estado documental

Fuente activa principal:

- `docs/2026-05-25-auditoria-arquitectura-actual-improve-codebase.md`: auditoria actual y plan de fases con compuertas estrictas.

Documentos activos de apoyo:

- `docs/README.md`: indice de documentacion activa, historica y ADRs.
- `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`: backlog activo; conserva hallazgos criticos iniciales como trazabilidad, pero su evidencia de cierre prevalece para el estado actual.
- `ARCHITECTURE_ROADMAP.md`: resumen enterprise vigente.
- `README.md`: entrada general del proyecto.
- `CONTEXT.md`: vocabulario de dominio y reglas de arquitectura.
- `docs/adr/README.md`: indice de decisiones arquitecturales.

Documentos historicos:

- `docs/2026-05-25-enterprise-project-audit.md`: auditoria historica. Sus hallazgos sobre `/api/push/pending`, idempotencia por usuario y timeouts de tests no representan el estado actual.
- `docs/2026-05-22-rpc-type-drift-audit.md`: auditoria puntual historica.
- `docs/plans/*`: trazabilidad de planes y disenos por fecha, no fuente principal de estado.
- `docs/archive/*`: documentos archivados.

Clarificacion de naming:

- `Tercero` es el concepto comercial para clientes y revendedores.
- `Usuario auth` o la tabla fisica `usuarios` representa perfil de autenticacion/autorizacion, como checks de `active` y `role = admin`.
- Codigo nuevo de dominio comercial debe usar `Tercero`; codigo de auth puede usar `usuario` cuando se refiera al perfil autenticado.

## Oportunidades de profundizar Modules

Las siguientes oportunidades usan el vocabulario de `improve-codebase-architecture`: Module, Interface, Implementation, Depth, Seam, Adapter, Leverage y Locality.

### 1. Adelgazar stores de dominio como frontera de compatibilidad

**Files**

- `src/store/ventasStore.ts`
- `src/store/serviciosStore.ts`
- `src/store/tercerosStore.ts`
- `src/store/notificacionesStore.ts`
- `src/store/metodosPagoStore.ts`
- `src/store/gastosStore.ts`
- `src/store/categoriasStore.ts`
- `src/store/templatesStore.ts`
- `src/hooks/*`
- `src/lib/events/cache-reactions.ts`

**Problem**

Los stores siguen mezclando cache remota, UI, mutaciones, rollback, counts, Activity Log y compatibilidad. La Interface de cada store es shallow porque el caller termina dependiendo de detalles de carga, refresco e invalidacion.

**Deletion test**

Si se elimina un store de dominio hoy, la complejidad reaparece en varias pantallas. Eso indica que el store todavia carga comportamiento real. Pero parte de ese comportamiento pertenece a React Query/use-cases/reactions, no al store.

**Solution**

Migrar por vertical slice:

- lecturas remotas a React Query;
- acciones de negocio a use-cases;
- invalidaciones a `StoreEventBus`/cache reactions;
- Zustand solo para estado UI, filtros, seleccion, modales, colas y optimismo.

**Benefits**

- Mas Locality: una lectura remota se entiende desde su hook/query key.
- Mas Leverage: las pantallas no necesitan saber TTL/cache/store internals.
- Tests mejores: se prueba el use-case y la query por Interface, no el store completo.

### 2. Cerrar mas la Interface de `payments`

**Files**

- `src/lib/payments/financial-payments-module.ts`
- `src/lib/payments/payment-factory.ts`
- `src/lib/payments/payment-calculator.ts`
- `src/lib/payments/currency-converter.ts`
- `src/lib/payments/index.ts`
- `src/lib/supabase/payments-repository.ts`
- `src/lib/use-cases/ventas/ventas-payment-use-cases.ts`
- `src/lib/use-cases/servicios/servicios-payment-use-cases.ts`

**Problem**

`financialPayments` ya es una mejora clara, pero `index.ts` reexporta factories, calculator y converter. Eso permite que callers salten la Interface profunda y vuelvan a construir pagos con detalles posicionales o formatos internos.

**Deletion test**

Si se elimina `financialPayments`, la complejidad de moneda, snapshots, pagos iniciales/renovacion y movimientos firmados reaparece en ventas/servicios. El Module esta ganando Depth, pero su Interface publica todavia deja puertas laterales.

**Solution**

Hacer que el consumo nuevo use `financialPayments` como Interface primaria. Mantener exports bajos solo si son Adapters internos o helpers explicitamente estables. Reducir parametros posicionales en favor de comandos de dominio.

**Benefits**

- Mas Locality financiera.
- Menos riesgo en Pago de venta, Pago de servicio y refunds.
- Tests por contrato de pagos mas claros.

### 3. Confinar casts estructurales en Adapters Supabase

**Files**

- `src/lib/supabase/record-core.ts`
- `src/lib/supabase/pagination.ts`
- `src/lib/supabase/read-models.ts`
- `src/lib/supabase/write-utils.ts`
- `src/lib/supabase/notifications-repository.ts`
- `src/lib/supabase/categorias-repository.ts`
- `src/lib/supabase/domain-read-adapters.ts`
- `src/lib/supabase/*-rpc-adapter.ts`

**Problem**

El repo usa muchos `Record<string, unknown>`, `as unknown`, `as never` y mappers genericos. Esto es tolerable dentro de un Adapter que encapsula Supabase, pero se vuelve shallow cuando callers de dominio tienen que conocer shapes fisicos.

**Solution**

Definir una regla simple:

- casts fisicos viven en `src/lib/supabase/*adapter*`, `record-core`, mappers o repositorios internos;
- use-cases y UI consumen interfaces de dominio;
- si una pantalla necesita `Record<string, unknown>`, falta un Adapter o un mapper.

**Benefits**

- Mas type safety.
- Menos drift entre `database.types.ts` y dominio.
- Tests se enfocan en contrato del Adapter.

### 4. Profundizar `notifications` actions/renewal hasta outcomes de dominio

**Files**

- `src/lib/use-cases/notificaciones/notificaciones-renewal-use-cases.ts`
- `src/lib/use-cases/notificaciones/notificaciones-actions-use-cases.ts`
- `src/lib/use-cases/notificaciones/notificaciones-reposo-use-cases.ts`
- `src/lib/notifications/*`
- `src/components/notificaciones/*`
- `src/store/notificacionesStore.ts`
- `src/lib/store-reactions/*`

**Problem**

Las Notificaciones estan mucho mejor separadas que antes, pero los flujos de UI siguen necesitando conocer stores, query invalidations y detalles de acciones. La Interface del Module puede ser mas profunda si devuelve outcomes de dominio y deja feedback/cache al Adapter de UI.

**Solution**

Formalizar outcomes:

- `notificationRenewed`
- `ventaCut`
- `servicioInactivated`
- `reposoActivated`
- `whatsappMessageQueued`
- `cacheInvalidationNeeded`

Luego conectar esos outcomes a reactions/UI.

**Benefits**

- Mas Locality en reglas de Notificacion.
- Menos tests con DOM.
- Mas claridad entre regla de negocio y feedback visual.

### 5. Consolidar detalle Venta/Servicio como Modules de workflow

**Files**

- `src/app/(dashboard)/ventas/[id]/components/*`
- `src/app/(dashboard)/servicios/detalle/[id]/components/*`
- `src/lib/use-cases/ventas/venta-detail-use-cases.ts`
- `src/lib/use-cases/servicios/servicio-detail-use-cases.ts`
- `src/app/(dashboard)/ventas/[id]/components/venta-detalle-store-dependencies.ts`
- `src/app/(dashboard)/servicios/detalle/[id]/components/servicio-detalle-store-dependencies.ts`

**Problem**

Las pantallas de detalle coordinan lectura, pagos, perfiles, acciones, WhatsApp, delete, refresh e invalidaciones. Hay seams mejores que antes, pero el caller todavia ve muchos detalles.

**Solution**

Crear o reforzar una Interface de workflow por detalle:

- cargar bundle de detalle;
- registrar pago/renovacion;
- cortar/transferir venta;
- reembolsar;
- borrar con pagos;
- devolver outcomes para UI.

**Benefits**

- Pantallas mas declarativas.
- Tests del workflow sin render completo.
- Menos imports directos de stores y repositorios en hooks de pantalla.

### 6. Separar `forecasting` de invalidacion de dashboard

**Files**

- `src/lib/forecasting/financial-forecast.ts`
- `src/lib/forecasting/forecast-sync.ts`
- `src/hooks/use-pronostico-financiero.ts`
- `src/lib/dashboard-read-models/dashboard-read-models.ts`

**Problem**

`Pronostico financiero` es un concepto de dominio/read model, pero parte de su uso vive como hook de dashboard y parte como sync/invalidation. La Interface puede confundirse entre calculo, read model e invalidacion.

**Solution**

Decidir si `forecasting` es:

- Module de calculo puro de Pronostico financiero; o
- facade de read model de dashboard para pronostico.

Luego mover invalidaciones a `dashboard-read-models`/cache reactions si no pertenecen al dominio de forecasting.

**Benefits**

- Locality del Pronostico financiero.
- Menos coupling con dashboard.
- Tests mas pequenos.

### 7. Limpiar warnings de lint y comentarios historicos

**Files**

- `src/lib/notifications/notification-event-listeners.ts`
- `src/lib/use-cases/activity-log-use-cases.ts`
- `src/lib/use-cases/categorias-use-cases.ts`
- `docs/*`

**Problem**

Lint pasa, pero warnings reducen la fuerza de la senal. Ademas, documentos historicos y planes pueden contradecir el estado actual.

**Solution**

- Eliminar imports/params no usados.
- Marcar docs historicos.
- Crear indice de docs activas.

**Benefits**

- Menos ruido en CI.
- Menos riesgo de decisiones basadas en auditorias viejas.

## Riesgos priorizados

### Alto

1. Stores de dominio siguen siendo la mayor Interface shallow.
2. Casts estructurales todavia pueden filtrarse fuera de Adapters.
3. Documentacion historica puede inducir a corregir problemas ya cerrados.

### Medio

1. `payments` todavia expone helpers de bajo nivel por `index.ts`.
2. Workflows de detalle Venta/Servicio siguen repartidos en varios hooks.
3. Notificaciones todavia puede mejorar outcomes de dominio.
4. Sin thresholds de coverage por Modules criticos.
5. Warnings de lint pendientes.

### Bajo

1. Naming mixto `usuario`/`tercero` en zonas historicas.
2. Archivos UI de 250+ lineas que conviene vigilar.
3. `database.types.ts` grande, esperado pero ruidoso.

## Plan de fases con compuertas estrictas

Este plan reemplaza el roadmap resumido. La regla principal es: **no se avanza de fase hasta que la fase actual este completamente cerrada con evidencia verificable**. No se permite cerrar una fase dejando pendientes para "despues", "seguimiento", "deuda aceptada" o "lo vemos en otra fase", salvo que el pendiente este explicitamente fuera del alcance de la fase y no contradiga ningun criterio de salida.

### Reglas globales de avance

Estas reglas aplican a todas las fases:

1. Una fase solo puede marcarse como cerrada cuando todos sus entregables estan implementados, documentados y validados.
2. Si una tarea descubre deuda nueva dentro del alcance de la fase, esa deuda se resuelve en la misma fase antes de avanzar.
3. Si aparece deuda nueva fuera del alcance, se documenta en la seccion de backlog del documento activo, pero no puede ser usada para ocultar un criterio de cierre incumplido.
4. No se permite avanzar con tests rotos, build roto, migraciones invalidas, warnings nuevos de lint o documentacion contradictoria creada durante la fase.
5. Cada fase debe terminar con una entrada de cierre en este documento: fecha, commits o archivos tocados, comandos ejecutados, resultado y pendientes explicitos fuera de alcance.
6. Si un comando requerido no puede ejecutarse, la fase queda bloqueada. No se acepta "no ejecutado" como cierre.
7. Si se toca Supabase, seguridad, auth, RLS, RPCs o service role, `npm run migrate:validate` es obligatorio.
8. Si se toca UI, formularios, hooks, stores, React Query o componentes, `npm test -- --run`, `npm run lint` y `npm run build` son obligatorios.
9. Si se toca documentacion de arquitectura, `CONTEXT.md` y `docs/adr/` deben revisarse para confirmar que no hay contradiccion.
10. Cada fase debe respetar las ADRs vigentes. Si una fase necesita contradecir una ADR, se detiene y primero se crea o modifica la ADR correspondiente.

### Evidencia minima por fase

Cada cierre de fase debe registrar:

- Archivos modificados.
- Resumen de cambios.
- Riesgos eliminados.
- Riesgos residuales fuera de alcance.
- Comandos ejecutados.
- Resultado literal de validacion: passed, failed o bloqueado.
- Confirmacion de que no quedan criterios de cierre pendientes.

Formato recomendado para cada cierre:

```md
#### Cierre Fase X - YYYY-MM-DD

- Archivos modificados:
- Cambios realizados:
- Validaciones:
  - `npm run lint`: passed
  - `npm test -- --run`: passed
  - `npm run build`: passed
  - `npm run migrate:validate`: passed/no aplica
- Criterios de salida: completos
- Pendientes fuera de alcance:
```

## Fase 0: estabilizar la fuente de verdad documental

### Objetivo

Eliminar ambiguedad entre auditorias viejas, backlog activo, ADRs y estado runtime actual. La fase termina cuando un maintainer puede identificar sin duda que documentos son historicos, cuales son activos y que decisiones no deben reabrirse sin ADR.

### Alcance

Incluye:

- Documentacion activa e historica en `docs/`.
- `CONTEXT.md`.
- `README.md`.
- `ARCHITECTURE_ROADMAP.md`.
- ADR index en `docs/adr/README.md`.
- Este documento como auditoria activa.

No incluye:

- Cambios funcionales de codigo.
- Refactors de stores, pagos o Supabase.
- Cambios a RLS, auth o migraciones.

### Tareas obligatorias

1. Crear o actualizar un indice de documentacion activa.
   - Debe indicar cual documento es la auditoria activa.
   - Debe indicar cual backlog esta vigente.
   - Debe listar ADRs aceptadas.
   - Debe marcar planes viejos como historicos o superados.
2. Marcar `docs/2026-05-25-enterprise-project-audit.md` como historico si conserva hallazgos ya cerrados.
   - Debe quedar claro que no representa el estado runtime actual.
   - Debe enlazar a este documento como auditoria actual.
3. Revisar `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`.
   - Si sigue activo, debe decir que hallazgos criticos viejos estan cerrados.
   - Si queda como historico, debe enlazar al documento activo.
4. Actualizar `README.md` o `CONTEXT.md` para aclarar la diferencia entre:
   - `usuarios` como tabla/perfil de auth si aplica;
   - `Tercero` como concepto comercial del dominio.
5. Confirmar que `ARCHITECTURE_ROADMAP.md` no contradice este plan.
6. Agregar una seccion de "Estado documental" en este documento con:
   - documento activo;
   - documentos historicos;
   - documentos de decision;
   - documentos operativos.

### Validaciones obligatorias

```bash
npm run lint
npm test -- --run
npm run build
```

`npm run migrate:validate` no es obligatorio si solo se toca documentacion, pero debe ejecutarse si se toca cualquier archivo en `supabase/`, `src/lib/supabase/`, auth server-side o scripts de migracion.

### Criterios de salida

La fase 0 solo queda cerrada si:

- Existe una fuente documental activa y explicita.
- Ningun documento activo contradice que `/api/push/pending` e idempotencia por usuario ya estan corregidos.
- Las auditorias historicas estan marcadas como historicas o enlazan al estado actual.
- `README.md`, `CONTEXT.md` o un doc activo aclara `usuarios` vs `Tercero`.
- Los comandos obligatorios pasan.
- No quedan warnings nuevos.
- Este documento incluye el bloque de cierre de Fase 0.

### Bloqueadores de avance

- Cualquier documento activo que siga listando como abierto un hallazgo ya cerrado sin aclaracion.
- Cualquier ADR contradicha por el plan.
- Cualquier comando obligatorio fallido o no ejecutado.

#### Cierre Fase 0 - 2026-05-25

- Archivos modificados:
  - `docs/README.md`
  - `docs/2026-05-25-enterprise-project-audit.md`
  - `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`
  - `docs/2026-05-25-auditoria-arquitectura-actual-improve-codebase.md`
  - `docs/adr/README.md`
  - `ARCHITECTURE_ROADMAP.md`
  - `README.md`
  - `CONTEXT.md`
- Cambios realizados:
  - Se creo un indice documental activo en `docs/README.md`.
  - Se marco `docs/2026-05-25-enterprise-project-audit.md` como documento historico y se aclaro que `/api/push/pending`, idempotencia por usuario y tests ya no estan abiertos en el runtime actual.
  - Se aclaro que `docs/2026-05-25-backlog-detallado-deuda-riesgos.md` sigue activo como backlog, pero sus hallazgos criticos iniciales deben leerse junto con la evidencia de cierre.
  - Se actualizo `ARCHITECTURE_ROADMAP.md` para enlazar al plan activo y al ADR-0006.
  - Se actualizo `docs/adr/README.md` con enlaces al plan activo y al indice documental.
  - Se aclaro en `README.md`, `CONTEXT.md` y esta auditoria que `Tercero` es el dominio comercial y `usuarios`/`Usuario auth` pertenece al perfil de autenticacion/autorizacion.
  - Se agrego la seccion `Estado documental` en esta auditoria.
- Validaciones:
  - `npm run lint`: passed con 0 errores y 7 warnings preexistentes de Fase 1.
  - `npm test -- --run`: passed, 66 archivos y 243 tests.
  - `npm run build`: passed.
  - `npm run migrate:validate`: no aplica; no se tocaron Supabase, auth runtime, RLS, RPCs ni scripts de migracion.
- Criterios de salida:
  - Fuente documental activa definida.
  - Auditoria enterprise anterior marcada como historica.
  - Backlog activo aclarado.
  - ADR index enlaza al plan activo.
  - `usuarios` vs `Tercero` aclarado.
  - `ARCHITECTURE_ROADMAP.md` no contradice este plan.
- Pendientes fuera de alcance:
  - Los 7 warnings de lint quedan para Fase 1, donde son objetivo explicito de cierre.
- Estado: Fase 0 cerrada. No avanzar a Fase 1 sin iniciar su checklist y mantener las reglas de no avance.

## Fase 1: higiene de calidad y senales de CI

### Objetivo

Dejar las senales basicas de calidad limpias: lint sin warnings, tests verdes, build verde y validaciones operativas reproducibles. Esta fase prepara el terreno para refactors sin ruido.

### Alcance

Incluye:

- Warnings actuales de ESLint.
- Imports no usados.
- Parametros no usados.
- Scripts de validacion ya existentes.
- Documentacion minima de comandos requeridos.

No incluye:

- Cambios de arquitectura grandes.
- Migracion de stores.
- Cambios en comportamiento de dominio.
- Cambios de thresholds de coverage, que quedan para Fase 6.

### Tareas obligatorias

1. Limpiar warnings en `src/lib/notifications/notification-event-listeners.ts`.
   - Revisar si los parametros `event` deben usarse o eliminarse.
   - No silenciar con comentarios si se puede resolver con codigo claro.
2. Limpiar warnings en `src/lib/use-cases/activity-log-use-cases.ts`.
   - Eliminar imports no usados o usar exports directos de forma consistente.
3. Limpiar warnings en `src/lib/use-cases/categorias-use-cases.ts`.
   - Eliminar imports no usados o reestructurar exports para que no generen warning.
4. Ejecutar lint y confirmar 0 errores, 0 warnings.
5. Ejecutar suite completa de tests.
6. Ejecutar build.
7. Ejecutar secrets scan.
8. Registrar en este documento el resultado exacto.

### Validaciones obligatorias

```bash
npm run lint
npm test -- --run
npm run build
npm run secrets:scan
```

### Criterios de salida

La fase 1 solo queda cerrada si:

- `npm run lint` devuelve 0 errores y 0 warnings.
- `npm test -- --run` pasa completo.
- `npm run build` pasa.
- `npm run secrets:scan` pasa.
- No se agregaron `eslint-disable`, `@ts-ignore`, `@ts-expect-error` ni casts nuevos para resolver warnings.
- Este documento incluye el bloque de cierre de Fase 1.

### Bloqueadores de avance

- Cualquier warning de lint.
- Cualquier test skipped o deshabilitado para forzar cierre.
- Cualquier cambio funcional no cubierto por test existente o nuevo.

#### Cierre Fase 1 - 2026-05-25

- Archivos modificados:
  - `src/lib/notifications/notification-event-listeners.ts`
  - `src/lib/notifications/notification-sync-behavior.test.ts`
  - `src/lib/use-cases/activity-log-use-cases.ts`
  - `src/lib/use-cases/categorias-use-cases.ts`
  - `docs/2026-05-25-auditoria-arquitectura-actual-improve-codebase.md`
- Cambios realizados:
  - Se eliminaron 3 parametros `event` no usados en listeners de notificaciones.
  - Se eliminaron imports no usados en `activity-log-use-cases.ts`.
  - Se eliminaron imports no usados en `categorias-use-cases.ts`.
  - Se estabilizo `notification-sync-behavior.test.ts` usando mocks con `vi.hoisted` e import unico de `sincronizarUnServicio`, evitando imports dinamicos dentro de pruebas con fake timers.
  - No se agregaron `eslint-disable`, `@ts-ignore` ni `@ts-expect-error`.
- Validaciones:
  - `npm run lint`: passed con 0 errores y 0 warnings.
  - `npm test -- --run src/lib/notifications/notification-sync-behavior.test.ts`: passed, 3 tests.
  - `npm test -- --run`: passed, 66 archivos y 243 tests.
  - `npm run build`: passed.
  - `npm run secrets:scan`: passed.
- Criterios de salida:
  - Lint sin warnings.
  - Suite completa estable.
  - Build verde.
  - Secrets scan verde.
  - Sin suppressions nuevas.
- Pendientes fuera de alcance:
  - Ninguno para Fase 1.
- Estado: Fase 1 cerrada. No avanzar a Fase 2 sin declarar el slice exacto de store a migrar y cumplir su checklist.

## Fase 2: reducir stores de dominio shallow

### Objetivo

Reducir la dependencia de stores Zustand como cache remota y concentrar lecturas en React Query, manteniendo Zustand para estado UI, seleccion, filtros, modales, colas y optimismo. Esta fase no termina con "un store iniciado"; termina cuando el slice elegido queda completamente migrado segun los criterios.

### Alcance recomendado

Empezar por un solo slice para cierre estricto. Orden recomendado:

1. `ventasStore`
2. `serviciosStore`
3. `tercerosStore`
4. `notificacionesStore`
5. catalogos: `metodosPagoStore`, `categoriasStore`, `gastosStore`, `tiposGastoStore`, `templatesStore`

La fase puede cerrarse despues del primer slice solo si el alcance declarado al inicio fue "slice ventas" y todos sus criterios estan completos. Si se declara "todos los stores", no se puede cerrar hasta terminar todos.

### Tareas obligatorias por slice

1. Inventariar la Interface publica del store.
   - Estado remoto.
   - Estado UI.
   - Mutaciones.
   - Counts.
   - Cache/TTL.
   - Reactions.
   - Dependencias a repositorios.
2. Clasificar cada miembro de la Interface:
   - conservar en Zustand;
   - mover a React Query;
   - mover a use-case;
   - mover a `StoreEventBus`/reactions;
   - eliminar por obsoleto.
3. Migrar lecturas remotas a hooks con React Query.
   - Usar `queryKeys`.
   - Evitar keys ad hoc.
   - Mantener estados loading/error equivalentes.
4. Mover invalidaciones post-mutacion a reactions o a un seam claro.
   - Preferir eventos de negocio.
   - Evitar imports directos cruzados entre stores.
5. Mantener use-cases como lugar de reglas de negocio.
   - Stores no deben contener invariantes transaccionales.
6. Actualizar componentes consumidores.
   - No dejar doble fuente de verdad entre store y query.
   - No duplicar counts manuales si existe query.
7. Actualizar tests existentes.
   - Tests del store para estado UI que queda.
   - Tests de hooks/use-cases donde se mueva comportamiento.
8. Buscar imports residuales.
   - Confirmar que el slice no mantiene repositorios remotos salvo excepcion documentada.
9. Documentar el cierre del slice en este documento.

### Busquedas obligatorias

Ejecutar busquedas antes y despues:

```bash
rg -n "useVentasStore|ventasStore" src
rg -n "useServiciosStore|serviciosStore" src
rg -n "useTercerosStore|tercerosStore" src
rg -n "from ['\"]@/lib/supabase" src/app src/components src/hooks src/store
rg -n "invalidateQueries" src/app src/components src/hooks src/store
```

Ajustar las busquedas al slice declarado.

### Validaciones obligatorias

```bash
npm run lint
npm test -- --run
npm run build
```

Si se toca Supabase o scripts:

```bash
npm run migrate:validate
```

### Criterios de salida

La fase 2 solo queda cerrada si, para el slice declarado:

- No quedan lecturas remotas principales en el store migrado.
- No hay doble fuente de verdad entre Zustand y React Query.
- Las mutaciones siguen pasando por use-cases o Adapters adecuados.
- Las invalidaciones estan en reactions, query hooks o un seam documentado.
- Los componentes actualizados no importan repositorios Supabase directamente si existe un use-case/read Adapter adecuado.
- Tests pasan.
- Build pasa.
- Lint pasa sin warnings.
- Este documento incluye el bloque de cierre de Fase 2 con el slice completado.

### Bloqueadores de avance

- Dejar una lectura migrada a medias.
- Mantener dos caches remotas activas para el mismo dato.
- Cambiar comportamiento de negocio sin test.
- Agregar invalidaciones dispersas nuevas en pantallas.

#### Cierre Fase 2 - 2026-05-25

- Slice declarado:
  - `ventasStore`
- Archivos modificados:
  - `src/store/ventasStore.ts`
  - `src/store/ventasStore.test.ts`
  - `src/lib/store-reactions/notificaciones-workflow-reactions.ts`
  - `docs/2026-05-25-auditoria-arquitectura-actual-improve-codebase.md`
- Cambios realizados:
  - Se elimino de `ventasStore` la cache remota de ventas: `ventas`, `isLoading`, `lastFetch`, `fetchVentas`, `fetchCounts`, counts y helpers de lectura local.
  - `ventasStore` queda como frontera de mutaciones y estado UI minimo: `error`, `selectedVenta`, `createVenta`, `updateVenta`, `deleteVenta`, `setSelectedVenta`.
  - `createVenta`, `updateVenta` y `deleteVenta` siguen pasando por use-cases y `ventas-mutation-reactions`.
  - `updateVenta` ya no depende de una venta cacheada; el use-case carga la venta actual cuando no recibe `currentVenta`.
  - `deleteVenta` ya no hace rollback sobre lista local; la fuente de listas queda en React Query/paginacion.
  - `refreshVentasStoreCache` ya no llama `useVentasStore.getState().fetchVentas(true)`; ahora invalida `queryKeys.ventas.all` y `queryKeys.pagination.all`.
  - Se agrego `src/store/ventasStore.test.ts` para fijar el nuevo contrato del store sin cache remota.
- Busquedas ejecutadas:
  - `rg -n "fetchVentas\\(|fetchCounts\\(|totalVentas|ventasActivas|ventasInactivas|getVenta\\(|getVentasByEstado\\(|state\\.ventas|lastFetch|logCacheHit\\(ENTITIES\\.VENTAS" src\\store\\ventasStore.ts src\\lib\\store-reactions src\\app src\\components src\\hooks tests`
  - `rg -n "useVentasStore|ventasStore" src tests`
  - `rg -n "@/lib/supabase" src\\app src\\components src\\hooks src\\store`
  - `rg -n "invalidateQueries" src\\app src\\components src\\hooks src\\store`
- Resultado de busquedas:
  - No quedan `fetchVentas`, `fetchCounts`, lista remota, counts ni TTL en `ventasStore`.
  - Los usos restantes de `useVentasStore` consumen mutaciones o `selectedVenta`.
  - Los imports Supabase encontrados pertenecen a otros stores/slices o hooks React Query existentes; no se agrego un nuevo import Supabase desde UI para el slice `ventasStore`.
  - Las invalidaciones de ventas existentes quedan via React Query y reactions; no se agrego una nueva invalidacion dispersa en pantalla para este slice.
- Validaciones:
  - `npm test -- --run src/store/ventasStore.test.ts`: passed, 4 tests.
  - `npm run lint`: passed con 0 warnings.
  - `npm test -- --run`: passed, 67 archivos y 247 tests.
  - `npm run build`: passed.
  - `npm run migrate:validate`: no aplica; no se tocaron Supabase, auth runtime, RLS, RPCs ni scripts de migracion.
- Criterios de salida:
  - Lecturas remotas principales de ventas ya no viven en `ventasStore`.
  - No queda doble cache remota para la lista/counts de ventas dentro del store.
  - Mutaciones siguen pasando por use-cases.
  - Invalidacion posterior queda en reactions/React Query.
  - Tests del nuevo contrato del store agregados.
  - Lint, tests y build pasan.
- Pendientes fuera de alcance:
  - Otros stores de dominio (`serviciosStore`, `tercerosStore`, `notificacionesStore`, catalogos) siguen siendo slices pendientes para fases futuras.
  - Algunos hooks/componentes existentes importan repositorios Supabase directamente como parte de sus React Query/use-cases actuales; no pertenecen al cierre del slice `ventasStore`.
- Estado anterior: cierre parcial valido solo para `ventasStore`. Este estado fue insuficiente cuando el alcance se corrigio a "todos los stores de dominio".

#### Correccion de alcance Fase 2 - 2026-05-25

- Motivo:
  - El cierre anterior no completo todos los slices recomendados por Fase 2.
  - El criterio operativo queda corregido: Fase 2 no se considera cerrada hasta terminar `ventasStore`, `serviciosStore`, `tercerosStore`, `notificacionesStore` y catalogos.
- Slices cerrados ahora:
  - `ventasStore`
  - `serviciosStore`
  - `tercerosStore`
  - `notificacionesStore`
  - `categoriasStore`
  - `metodosPagoStore`
  - `gastosStore`
  - `tiposGastoStore`
  - `templatesStore`
- Archivos principales modificados en la correccion:
  - `src/store/store-query-invalidation.ts`
  - `src/store/serviciosStore.ts`
  - `src/store/tercerosStore.ts`
  - `src/store/notificacionesStore.ts`
  - `src/store/categoriasStore.ts`
  - `src/store/metodosPagoStore.ts`
  - `src/store/gastosStore.ts`
  - `src/store/tiposGastoStore.ts`
  - `src/store/templatesStore.ts`
  - `src/hooks/use-servicios.ts`
  - `src/lib/store-reactions/catalogos-mutation-reactions.ts`
  - `src/lib/store-reactions/notificaciones-workflow-reactions.ts`
  - `src/lib/use-cases/terceros/tercero-metodo-pago-use-cases.ts`
  - `src/app/(dashboard)/servicios/detalle/[id]/ServicioDetalleClient.tsx`
  - `src/app/(dashboard)/servicios/detalle/[id]/components/servicio-detalle-store-dependencies.ts`
  - `src/app/(dashboard)/servicios/detalle/[id]/components/useServicioSaleActions.ts`
  - `src/store/serviciosStore.test.ts`
  - `tests/unit/store/tercerosStore.test.ts`
- Cambios realizados:
  - Se agrego `store-query-invalidation` como Seam comun para invalidar React Query desde stores sin mantener cache remota local.
  - `serviciosStore` ya no mantiene `servicios`, `isLoading`, `lastFetch`, counts, getters de lista ni TTL.
  - `serviciosStore` conserva mutaciones, `selectedServicio`, `error`, actualizacion de perfil ocupado y refresh por invalidacion.
  - `tercerosStore` ya no mantiene `terceros`, counts, loading, TTL ni getters locales.
  - `tercerosStore` conserva mutaciones, `selectedTercero`, `error` y refresh por invalidacion.
  - `notificacionesStore` ya no mantiene lista/counts/cache local de notificaciones.
  - `notificacionesStore` conserva acciones de mutacion: marcar leida/resaltada y eliminar notificaciones por item, venta o servicio.
  - `categoriasStore` ya no mantiene lista/counts/cache local; conserva mutaciones, seleccion y refresh por invalidacion.
  - `metodosPagoStore` ya no mantiene lista/counts/cache local ni helpers de lectura por tipo; conserva mutaciones y seleccion.
  - `gastosStore` ya no mantiene lista/cache local; conserva mutaciones y usa lecturas puntuales solo para validar o construir payloads de mutacion.
  - `tiposGastoStore` ya no mantiene lista/counts/cache local; conserva mutaciones y usa lecturas puntuales solo para unicidad, toggle y validacion de borrado.
  - `templatesStore` ya no persiste ni cachea `templates`; conserva mutaciones y seleccion.
  - `ServicioDetalleClient` obtiene servicios y templates por React Query (`useServicios`, `useTemplates`) y no desde stores.
  - `useServicioSaleActions` obtiene el tercero puntual por use-case de lectura para armar WhatsApp, no desde cache local de `tercerosStore`.
  - `notificaciones-workflow-reactions` obtiene snapshot de metodos de pago desde React Query si existe, no desde `metodosPagoStore`.
  - `catalogos-mutation-reactions` invalida queries de gastos/tipos en vez de editar lista local inexistente.
- Busquedas ejecutadas:
  - `rg -n "useVentasStore|ventasStore|useServiciosStore|serviciosStore|useTercerosStore|tercerosStore|useNotificacionesStore|notificacionesStore|useMetodosPagoStore|metodosPagoStore|useCategoriasStore|categoriasStore|useGastosStore|gastosStore|useTiposGastoStore|tiposGastoStore|useTemplatesStore|templatesStore" src tests`
  - `rg -n "@/lib/supabase" src/app src/components src/hooks src/store`
  - `rg -n "invalidateQueries" src/app src/components src/hooks src/store`
  - `rg -n "lastFetch|lastCountsFetch|fetch[A-Za-z]+: async \\(force|logCacheHit\\(|state\\.(ventas|servicios|terceros|notificaciones|categorias|metodosPago|gastos|tiposGasto|templates)|totalVentas|totalServicios|totalClientes|totalMetodos|totalTipos" src/store src/lib/store-reactions src/lib/use-cases/terceros`
- Resultado de busquedas:
  - No quedan caches remotas principales en los stores de dominio/catalogos cerrados.
  - Los usos restantes de stores consumen mutaciones, seleccion o refresh por invalidacion.
  - Quedan imports Supabase en stores solo para soporte de mutacion puntual, validaciones o Adapter concreto; no para TTL/listas remotas.
  - Quedan imports Supabase en hooks/componentes ya existentes que funcionan como React Query/read Adapter o paginas de paginacion; no se introdujo doble cache Zustand.
  - `activityLogStore`, `configStore` y `authStore` aun tienen estado/loading/TTL propios, pero no pertenecen a los slices de dominio/catalogos declarados en Fase 2.
- Validaciones ejecutadas:
  - `npm test -- --run src/store/ventasStore.test.ts src/store/serviciosStore.test.ts tests/unit/store/tercerosStore.test.ts src/lib/use-cases/terceros/tercero-metodo-pago-use-cases.test.ts`: 4 archivos, 9 tests pasan.
  - `npm run lint`: pasa sin warnings.
  - `npm test -- --run`: 67 archivos, 252 tests pasan.
  - `npm run build`: pasa con Next.js 16.2.4.
  - `npm run migrate:validate`: no aplica; no se tocaron migraciones, RLS, RPCs ni schema Supabase.
- Criterios de salida:
  - Todos los slices declarados ya no usan Zustand como cache remota principal.
  - Las listas/counts principales quedan en React Query, paginacion, hooks o read Adapters.
  - Las mutaciones permanecen detras de stores/use-cases/Adapters y disparan invalidaciones por un Seam documentado.
  - No queda doble fuente de verdad activa para listas/counts de ventas, servicios, terceros, notificaciones ni catalogos cerrados.
  - Lint, tests y build pasan.
- Estado: Fase 2 cerrada al 100% para todos los slices declarados. Fase 3, que ya fue implementada despues del cierre parcial, queda secuencialmente validada a partir de este cierre completo.

## Fase 3: cerrar la Interface publica de `payments`

### Objetivo

Hacer que `financialPayments` sea la Interface principal para pagos criticos y evitar que ventas/servicios construyan pagos mediante factories posicionales o helpers de bajo nivel cuando hay una Interface de dominio disponible.

### Alcance

Incluye:

- `src/lib/payments/index.ts`
- `src/lib/payments/financial-payments-module.ts`
- `src/lib/payments/payment-factory.ts`
- `src/lib/payments/payment-calculator.ts`
- `src/lib/payments/currency-converter.ts`
- `src/lib/use-cases/ventas/ventas-payment-use-cases.ts`
- `src/lib/use-cases/servicios/servicios-payment-use-cases.ts`
- `src/lib/supabase/payments-repository.ts`
- tests de pagos y use-cases.

No incluye:

- Cambiar schema de pagos.
- Cambiar semantica de refunds.
- Cambiar tasas de conversion sin ADR o decision explicita.

### Tareas obligatorias

1. Inventariar imports actuales desde `@/lib/payments`.
2. Separar exports publicos de exports internos.
   - `financialPayments` debe ser el camino preferido para registrar pagos.
   - Helpers de bajo nivel solo deben quedar si son necesarios y su uso esta justificado.
3. Reemplazar llamadas posicionales por comandos de dominio donde aporte Depth.
4. Confirmar que Pago de venta, Pago de servicio y refund usan snapshots monetarios consistentes.
5. Confirmar que los Adapters Supabase reciben payloads fisicos solo desde el Module adecuado.
6. Agregar o ajustar tests de contrato:
   - registrar Pago de venta inicial;
   - registrar Pago de venta de renovacion;
   - registrar Pago de servicio inicial;
   - registrar Pago de servicio de renovacion;
   - normalizar refund como movimiento firmado;
   - conversion USD y moneda default.
7. Revisar que no haya cambios en resultados financieros existentes sin test que lo demuestre.

### Busquedas obligatorias

```bash
rg -n "createInitialVentaPayment|createRenewalVentaPayment|createInitialServicioPayment|createRenewalServicioPayment" src
rg -n "financialPayments" src
rg -n "from ['\"]@/lib/payments" src
rg -n "payment-factory" src
```

### Validaciones obligatorias

```bash
npm run lint
npm test -- --run
npm run build
```

Si se toca RPC, repository o migracion:

```bash
npm run migrate:validate
```

### Criterios de salida

La fase 3 solo queda cerrada si:

- Los flujos criticos de pagos consumen `financialPayments` o una Interface equivalente de dominio.
- No quedan nuevas llamadas posicionales desde use-cases a factories internas.
- Los tests de pagos y use-cases pasan.
- No se redujo cobertura efectiva en pagos.
- No hay casts nuevos fuera de Adapters.
- Lint, tests y build pasan.
- Este documento incluye el bloque de cierre de Fase 3.

### Bloqueadores de avance

- Cualquier cambio financiero sin test.
- Cualquier payload fisico de Supabase construido en UI.
- Cualquier helper interno promovido como API publica sin justificacion.

#### Cierre Fase 3 - 2026-05-25

- Slice cerrado:
  - Interface publica de `src/lib/payments` para escrituras criticas de pagos.
- Cambios aplicados:
  - `src/lib/payments/payments-module.ts` dejo de reexportar los factories posicionales de escritura:
    - `createInitialVentaPayment`
    - `createRenewalVentaPayment`
    - `createInitialServicioPayment`
    - `createRenewalServicioPayment`
  - `src/lib/payments/payments-module.ts` conserva como API publica:
    - `financialPayments` y tipos/funciones del Module financiero.
    - conversion de moneda, porque hoy la consumen hooks, forecasting, use-cases y repositorios existentes.
    - agregadores/read helpers (`sumInUSD`, `sumPaymentsInUSD`, `formatAggregateInUSD`).
    - consultas/contadores legacy de pagos en aliases en espanol, porque aun son consumo de lectura, no creacion fisica de pagos.
  - `src/lib/payments/financial-payments-module.test.ts` ahora cubre el contrato por comandos:
    - registro de Pago de venta inicial;
    - registro de Pago de venta de renovacion;
    - registro de Pago de servicio inicial;
    - registro de Pago de servicio de renovacion;
    - exposicion de la API por `financialPayments`;
    - snapshots monetarios;
    - refund como movimiento firmado negativo;
    - conversion USD asincrona y sincrona.
  - Tests de use-cases dejaron de mockear factories publicos inexistentes:
    - `src/lib/use-cases/servicios-use-cases.test.ts`
    - `src/lib/use-cases/ventas-use-cases.test.ts`
    - `src/lib/use-cases/ventas-refund-use-cases.test.ts`
    - `src/lib/use-cases/ventas-query-use-cases.test.ts`
- Busquedas obligatorias ejecutadas:
  - `rg -n "createInitialVentaPayment|createRenewalVentaPayment|createInitialServicioPayment|createRenewalServicioPayment" src tests`
    - Solo quedan referencias en:
      - `src/lib/payments/payment-factory.ts`
      - `src/lib/payments/payment-factory.test.ts`
      - `src/lib/payments/financial-payments-module.ts`
      - `src/lib/payments/financial-payments-module.test.ts`
    - No quedan callers de aplicacion ni use-cases importando esos factories desde `@/lib/payments`.
  - `rg -n "financialPayments" src tests`
    - Los flujos de renovacion de venta y servicio consumen `financialPayments`.
  - `rg -n "@/lib/payments" src tests`
    - Quedan imports publicos para conversion/agregacion/lectura y para `financialPayments`; ninguno para factories posicionales de escritura.
  - `rg -n "payment-factory" src tests`
    - `payment-factory` queda referenciado por `payments-module.ts` para lecturas legacy, por `financial-payments-module.ts` como implementacion interna y por tests internos.
- Validaciones ejecutadas:
  - `npm test -- --run src/lib/payments/financial-payments-module.test.ts src/lib/payments/payment-factory.test.ts`: 2 archivos, 13 tests pasan.
  - `npm run lint`: pasa sin warnings.
  - `npm test -- --run`: 67 archivos, 252 tests pasan.
  - `npm run build`: pasa con Next.js 16.2.4.
- Validaciones no ejecutadas:
  - `npm run migrate:validate` no aplica en esta fase porque no se tocaron RPC, repositorios Supabase ni migraciones.
- Criterios de salida:
  - Flujos criticos de pagos pasan por `financialPayments`.
  - No quedan llamadas posicionales nuevas desde use-cases hacia factories internos.
  - No se cambio semantica financiera ni payload fisico de Supabase.
  - Los factories posicionales existen solo como implementacion interna/test interno.
  - Lint, tests y build pasan.
- Pendientes fuera de alcance:
  - Reducir en una fase futura la API publica de conversion/agregacion si se crea un Module financiero de lectura mas profundo.
  - Migrar imports de lectura legacy (`obtenerPagosDeServicio`, agregadores y conversion directa) solo cuando exista un contrato sustituto sin romper pantallas actuales.
- Estado: Fase 3 cerrada al 100%. No avanzar a Fase 4 sin iniciar su checklist de workflows de detalle Venta/Servicio.

## Fase 4: consolidar workflows de detalle Venta y Servicio

### Objetivo

Concentrar workflows complejos de detalle detras de Interfaces profundas, para que las pantallas no coordinen manualmente demasiados stores, queries, repositories, WhatsApp, pagos, delete e invalidaciones.

### Alcance

Incluye:

- `src/app/(dashboard)/ventas/[id]/components/*`
- `src/app/(dashboard)/servicios/detalle/[id]/components/*`
- `src/lib/use-cases/ventas/venta-detail-use-cases.ts`
- `src/lib/use-cases/servicios/servicio-detail-use-cases.ts`
- `src/lib/use-cases/ventas/ventas-payment-use-cases.ts`
- `src/lib/use-cases/servicios/servicios-payment-use-cases.ts`
- store dependency facades de detalle.

### Tareas obligatorias

1. Inventariar acciones de detalle Venta:
   - cargar detalle;
   - renovar;
   - reembolsar;
   - editar pago;
   - eliminar pago;
   - eliminar venta;
   - refrescar notificaciones;
   - enviar/encolar WhatsApp.
2. Inventariar acciones de detalle Servicio:
   - cargar bundle;
   - renovar servicio;
   - registrar pago;
   - cortar venta;
   - transferir venta;
   - eliminar servicio;
   - manejar perfiles;
   - enviar/encolar WhatsApp.
3. Definir outcomes por accion.
   - La UI debe recibir resultado claro.
   - Reactions deben manejar invalidacion.
   - Stores deben quedar como Adapters UI si siguen siendo necesarios.
4. Mover coordinacion repetida a use-cases/facades de workflow.
5. Evitar que componentes de detalle importen repositories Supabase directamente si existe un use-case o Adapter.
6. Agregar tests de workflow donde se mueva comportamiento.
7. Confirmar que la UI conserva comportamiento observable.

### Busquedas obligatorias

```bash
rg -n "from ['\"]@/store" src/app/\\(dashboard\\)/ventas src/app/\\(dashboard\\)/servicios
rg -n "from ['\"]@/lib/supabase" src/app/\\(dashboard\\)/ventas src/app/\\(dashboard\\)/servicios
rg -n "invalidateQueries" src/app/\\(dashboard\\)/ventas src/app/\\(dashboard\\)/servicios
rg -n "window.open|toast\\." src/app/\\(dashboard\\)/ventas src/app/\\(dashboard\\)/servicios src/lib/use-cases
```

En PowerShell puede ser necesario ajustar escapes o buscar por subcarpetas exactas.

### Validaciones obligatorias

```bash
npm run lint
npm test -- --run
npm run build
```

### Criterios de salida

La fase 4 solo queda cerrada si:

- Cada accion de detalle tocada tiene un outcome definido.
- Las pantallas no contienen coordinacion duplicada que se movio a workflow.
- No se agregan imports directos nuevos a repositorios desde UI.
- No quedan invalidaciones nuevas dispersas sin seam.
- Tests de detalle/use-case pasan.
- Lint, tests y build pasan.
- Este documento incluye el bloque de cierre de Fase 4.

### Bloqueadores de avance

- Pantallas con comportamiento migrado a medias.
- Acciones movidas sin test o sin outcome claro.
- UI y use-case ambos ejecutando el mismo side effect.

#### Cierre Fase 4 - 2026-05-25

- Slice cerrado:
  - Workflows de detalle Venta.
  - Workflows de detalle Servicio.
- Modules profundizados:
  - `src/lib/use-cases/ventas/venta-detail-use-cases.ts`
  - `src/lib/use-cases/servicios/servicio-detail-use-cases.ts`
- Hooks/UI actualizados:
  - `src/app/(dashboard)/ventas/[id]/components/useVentaDetalle.ts`
  - `src/app/(dashboard)/ventas/[id]/components/useVentaDetalleActions.ts`
  - `src/app/(dashboard)/ventas/[id]/components/venta-detalle-store-dependencies.ts`
  - `src/app/(dashboard)/servicios/detalle/[id]/ServicioDetalleClient.tsx`
  - `src/app/(dashboard)/servicios/detalle/[id]/components/useServicioPaymentActions.ts`
  - `src/app/(dashboard)/servicios/detalle/[id]/components/useServicioDeleteAction.ts`
  - `src/app/(dashboard)/servicios/detalle/[id]/components/useServicioSaleActions.ts`
  - `src/app/(dashboard)/servicios/detalle/[id]/components/servicio-detalle-store-dependencies.ts`
  - `src/app/(dashboard)/servicios/detalle/[id]/servicio-detalle-helpers.ts`
- Tests agregados:
  - `src/lib/use-cases/ventas/venta-detail-use-cases.test.ts`
  - `src/lib/use-cases/servicios/servicio-detail-use-cases.test.ts`
- Acciones de Venta inventariadas y cerradas:
  - cargar detalle: queda en `fetchVentaDetalleQuery`.
  - renovar: `renewVentaDetalleWorkflow`.
  - reembolsar: `refundVentaDetalleWorkflow`.
  - editar pago: `updateVentaPagoDetalleWorkflow`.
  - eliminar pago: `deleteVentaPagoDetalleWorkflow`.
  - eliminar venta: `deleteVentaDetalleWorkflow`.
  - refrescar notificaciones: dependencia `invalidateNotifications` inyectada.
  - enviar WhatsApp: queda como Adapter UI (`showVentaRenovadaWhatsAppToast`) usando outcome `whatsappRequested`.
- Acciones de Servicio inventariadas y cerradas:
  - cargar bundle: `fetchServicioDetalleBundleUseCase`.
  - cargar perfiles/ventas: `fetchServicioVentasProfilesUseCase`.
  - renovar servicio: `renewServicioDetalleWorkflow`.
  - registrar/editar pago: `updateServicioPagoDetalleWorkflow`.
  - eliminar pago/renovacion: `deleteServicioPagoDetalleWorkflow`.
  - cortar venta: `cutVentaFromServicioDetalleWorkflow`.
  - transferir venta: `transferVentaFromServicioDetalleWorkflow`.
  - eliminar servicio: `deleteServicioDetalleWorkflow`.
  - manejar perfiles: dependencia `updatePerfilOcupado` inyectada.
  - enviar/encolar WhatsApp: queda como Adapter UI (`enqueueWhatsAppMessages`) usando outcome `whatsappRequested` y `tercero`.
- Outcomes definidos:
  - Venta:
    - `ventaDeleted`
    - `ventaRenewed`
    - `ventaRefunded`
    - `ventaPaymentUpdated`
    - `ventaPaymentDeleted`
  - Servicio:
    - `servicioDeleted`
    - `servicioPaymentUpdated`
    - `servicioPaymentDeleted`
    - `servicioRenewed`
    - `servicioVentaCut`
    - `servicioVentaTransferred`
- Cambios de Depth:
  - Los hooks de detalle ya no contienen la secuencia completa de reglas de negocio, invalidaciones, forecast y notificaciones.
  - Los hooks quedan como Adapters UI: estado de dialogos, toasts, navegacion, mensajes WhatsApp y actualizacion visual local.
  - Los workflow Modules concentran orden, side effects de dominio y outcomes verificables.
  - `servicio-detalle-helpers.ts` dejo de importar repositorios Supabase directamente para cargar bundle/perfiles; delega al Module de use-cases.
- Busquedas obligatorias ejecutadas:
  - `rg -n "@/store" "src/app/(dashboard)/ventas" "src/app/(dashboard)/servicios"`
    - Resultados esperados:
      - `venta-detalle-store-dependencies.ts` y `servicio-detalle-store-dependencies.ts` importan stores como facades de detalle.
      - `ventas/page.tsx` conserva uso de `useVentasStore` fuera del scope de detalle.
      - imports type-only de `PendingWhatsAppToast` quedan para tipar el Adapter UI de WhatsApp.
  - `rg -n "@/lib/supabase" "src/app/(dashboard)/ventas" "src/app/(dashboard)/servicios"`
    - En detalle Servicio ya no quedan imports Supabase directos para bundle/perfiles/acciones.
    - Quedan imports fuera del scope de detalle:
      - paginacion/listas (`FilterOption`) en paginas de lista.
      - `ventas/[id]/editar/page.tsx`, que pertenece al flujo de edicion, no al detalle cerrado en esta fase.
  - `rg -n "invalidateQueries" "src/app/(dashboard)/ventas" "src/app/(dashboard)/servicios"`
    - En acciones tocadas las invalidaciones se pasan como dependencias de workflow (`invalidateNotifications`, `invalidateCategorias`), no se duplican junto a reglas de negocio.
    - Permanecen invalidaciones de paginas/listas o Adapters UI no migrados en esta fase.
  - `rg -n "window.open|toast\\." "src/app/(dashboard)/ventas" "src/app/(dashboard)/servicios" src/lib/use-cases`
    - En los workflow Modules nuevos no se agregaron `toast` ni `window.open`.
    - Los toasts y `window.open` de detalle permanecen en UI/Adapter.
    - Los casos de `src/lib/use-cases/notificaciones/*` pertenecen a Fase 5.
- Validaciones ejecutadas:
  - `npm test -- --run src/lib/use-cases/ventas/venta-detail-use-cases.test.ts src/lib/use-cases/servicios/servicio-detail-use-cases.test.ts`: 2 archivos, 13 tests pasan.
  - `npm run lint`: pasa sin warnings.
  - `npm test -- --run`: 69 archivos, 265 tests pasan.
  - `npm run build`: pasa con Next.js 16.2.4.
- Criterios de salida:
  - Cada accion de detalle tocada tiene outcome definido.
  - Las pantallas ya no contienen la coordinacion principal movida a workflows.
  - No se agregaron imports Supabase nuevos desde UI; se redujo el uso directo en detalle Servicio.
  - No se agregaron invalidaciones nuevas dispersas sin Seam; las nuevas quedan inyectadas a workflows.
  - Tests de workflow agregados y suite completa pasa.
  - Lint y build pasan.
- Pendientes fuera de alcance:
  - `ventas/[id]/editar/page.tsx` aun usa Adapter Supabase de lectura; corresponde a flujo de edicion, no al detalle.
  - `ventas/page.tsx`, `servicios/page.tsx` y `servicios/[id]/page.tsx` conservan paginacion/listas.
  - `src/lib/use-cases/notificaciones/*` aun contiene toasts/window.open; esto esta asignado a Fase 5.
- Estado: Fase 4 cerrada al 100%. No avanzar a Fase 5 sin iniciar su checklist de Notificaciones y Reposo.

## Fase 5: profundizar Notificaciones y Reposo

### Objetivo

Hacer que los flujos de Notificacion y Reposo tengan Interfaces orientadas a dominio, separando reglas de negocio de feedback visual, browser APIs, stores e invalidaciones.

### Alcance

Incluye:

- `src/lib/notifications/*`
- `src/lib/use-cases/notificaciones/*`
- `src/store/notificacionesStore.ts`
- `src/components/notificaciones/*`
- `src/app/(dashboard)/notificaciones/page.tsx`
- `src/app/(dashboard)/reposo/*`
- `src/lib/store-reactions/*`

### Tareas obligatorias

1. Inventariar flujos de Notificacion:
   - renovar Venta;
   - renovar Servicio;
   - cortar Venta;
   - inactivar Servicio;
   - activar Reposo;
   - limpiar/sincronizar notificaciones;
   - calcular montos.
2. Definir outcomes de dominio.
   - `renewed`
   - `cut`
   - `inactivated`
   - `reposoActivated`
   - `notificationSynced`
   - `whatsappQueued`
   - `cacheInvalidationNeeded`
3. Revisar que use-cases no dependan innecesariamente de UI/browser.
4. Mover toasts, `window.open` y feedback visual a UI o Adapter.
5. Mover invalidaciones a reactions cuando aplique.
6. Asegurar que `StoreEventBus` cubra cambios relevantes.
7. Agregar tests de use-cases sin DOM para reglas de negocio.
8. Mantener tests de UI solo para render/interaccion.

### Busquedas obligatorias

```bash
rg -n "toast\\.|window\\.open|localStorage|document\\." src/lib/use-cases src/lib/notifications
rg -n "useNotificacionesStore" src/lib src/components src/app
rg -n "invalidateQueries" src/lib/use-cases src/lib/notifications src/components/notificaciones src/app/\\(dashboard\\)/notificaciones src/app/\\(dashboard\\)/reposo
```

### Validaciones obligatorias

```bash
npm run lint
npm test -- --run
npm run build
```

### Criterios de salida

La fase 5 solo queda cerrada si:

- Los use-cases de Notificacion tocados pueden probarse sin DOM.
- Feedback visual esta fuera de reglas de dominio.
- Invalidaciones tienen seam claro.
- No se duplican syncs entre store y Module.
- Tests de notifications/reposo pasan.
- Lint, tests y build pasan.
- Este documento incluye el bloque de cierre de Fase 5.

### Bloqueadores de avance

- `toast`, `window.open` o browser APIs dentro de use-cases de dominio sin Adapter explicito.
- Store y use-case ejecutando la misma sincronizacion.
- Tests que dependen de timers/promises sin control.

#### Cierre Fase 5 - 2026-05-25

- Slice cerrado:
  - Workflows de Notificaciones.
  - Workflows de Reposo.
  - Reactions de cache/query para Notificaciones y Reposo.
- Modules profundizados:
  - `src/lib/use-cases/notificaciones/notificaciones-renewal-use-cases.ts`
  - `src/lib/use-cases/notificaciones/notificaciones-actions-use-cases.ts`
  - `src/lib/use-cases/notificaciones/notificaciones-reposo-use-cases.ts`
  - `src/lib/store-reactions/notification-cache-reactions.ts`
  - `src/lib/store-reactions/notification-query-reactions.ts`
- UI/Adapters actualizados:
  - `src/components/notificaciones/ventas-proximas/useVentasProximasController.ts`
  - `src/components/notificaciones/servicios-proximos/useServiciosProximosController.ts`
  - `src/components/notificaciones/ReposoNotificacionesTable.tsx`
  - `src/app/(dashboard)/notificaciones/page.tsx`
  - `src/app/(dashboard)/reposo/page.tsx`
- Tests agregados o actualizados:
  - `src/lib/use-cases/notificaciones/notificaciones-actions-use-cases.test.ts`
  - `src/lib/use-cases/notificaciones/notificaciones-renewal-use-cases.test.ts`
  - `src/lib/use-cases/notificaciones/notificaciones-reposo-use-cases.test.ts`
- Flujos inventariados y cerrados:
  - renovar Venta desde Notificacion: `confirmVentaRenewalFromNotificationUseCase`.
  - renovar Servicio desde Notificacion: `confirmServicioRenewalFromNotificationUseCase`.
  - cortar Venta desde Notificacion: `cutVentaFromNotificationUseCase`.
  - inactivar Servicio desde Notificacion: `inactivateServicioFromNotificationUseCase`.
  - activar Reposo: `activateReposoServicioUseCase`.
  - activar y renovar Reposo: `activateAndRenewReposoServicioUseCase`.
  - eliminar Servicio en Reposo: `deleteReposoServicioUseCase`.
  - limpiar notificaciones de Reposo: `clearReposoNotificationsUseCase`.
  - calcular montos: se mantiene en hooks/read models existentes; no se cambio semantica de calculo.
- Outcomes definidos:
  - `NotificationRenewalOutcome`:
    - `renewed`
    - `warnings`
    - `cacheInvalidations`
    - `notificationInvalidationNeeded`
    - `storeRefreshes`
    - `whatsappMessage`
  - `NotificationActionOutcome`:
    - `completed`
    - `cacheInvalidations`
    - `notificationInvalidationNeeded`
    - `storeRefreshes`
  - `ReposoWorkflowOutcome`:
    - `reposoNotificationsCleared`
    - `reposoDependenciesInvalidationNeeded`
    - `reposoActivated`
    - `reposoActivatedAndRenewed`
    - `reposoServicioDeleted`
- Cambios de Depth:
  - Los use-cases de Notificaciones y Reposo ya no importan `sonner`, `window`, `document`, `localStorage` ni `QueryClient`.
  - WhatsApp y feedback visual quedaron en UI/Adapter.
  - Invalidaciones de React Query se movieron a `applyNotificationQueryReactions`.
  - Mutaciones legacy del store de Notificaciones quedan confinadas a `src/lib/store-reactions/*`.
  - Los controllers de Notificaciones ya no importan `useNotificacionesStore`; usan reactions pequenas para marcar leida/resaltada.
- Busquedas obligatorias ejecutadas:
  - `rg -n "toast\\.|window\\.open|localStorage|document\\." src/lib/use-cases src/lib/notifications`
    - Sin resultados.
  - `rg -n "useNotificacionesStore" src/lib src/components src/app`
    - Resultados esperados solo en:
      - `src/lib/store-reactions/notification-cache-reactions.ts`
      - `src/lib/store-reactions/notificaciones-workflow-reactions.ts`
      - facades de detalle de Fase 4 (`venta-detalle-store-dependencies.ts`, `servicio-detalle-store-dependencies.ts`).
  - `rg -n "invalidateQueries" src/lib/use-cases src/lib/notifications src/components/notificaciones src/app/\\(dashboard\\)/notificaciones src/app/\\(dashboard\\)/reposo`
    - Sin resultados; las invalidaciones del slice quedan en `src/lib/store-reactions/notification-query-reactions.ts`.
- Validaciones ejecutadas:
  - `npm test -- --run src/lib/use-cases/notificaciones/notificaciones-actions-use-cases.test.ts src/lib/use-cases/notificaciones/notificaciones-renewal-use-cases.test.ts src/lib/use-cases/notificaciones/notificaciones-reposo-use-cases.test.ts src/lib/notifications/notification-cleanup.test.ts src/lib/notifications/notification-calculator.test.ts src/lib/notifications/notification-helpers.test.ts`: 6 archivos, 19 tests pasan.
  - `npm run lint`: pasa sin warnings.
  - `npm test -- --run`: 71 archivos, 273 tests pasan.
  - `npm run build`: pasa con Next.js 16.2.4.
- Criterios de salida:
  - Los use-cases de Notificacion tocados pueden probarse sin DOM.
  - Feedback visual esta fuera de reglas de dominio.
  - Invalidaciones tienen seam claro en `notification-query-reactions`.
  - No se duplican syncs entre store y Module dentro del slice tocado.
  - Tests de notifications/reposo pasan.
  - Lint, tests y build pasan.
- Pendientes fuera de alcance:
  - Los facades de detalle Venta/Servicio de Fase 4 siguen importando `useNotificacionesStore` como Adapter UI de detalle.
  - `src/store/notificacionesStore.ts` sigue siendo frontera legacy de mutacion/cache hasta una migracion React Query mas amplia.
- Estado: Fase 5 cerrada al 100%. No avanzar a Fase 6 sin iniciar su checklist de contratos, coverage y Adapters Supabase.

## Fase 6: endurecer contratos, coverage y Adapters Supabase

### Objetivo

Convertir los seams criticos en contratos verificables: RPC Adapters, payments, notifications, dashboard-read-models, PWA/offline y executive push.

### Alcance

Incluye:

- `vitest.config.ts`
- tests de `src/lib/payments`
- tests de `src/lib/supabase/*-rpc-adapter.ts`
- tests de `src/lib/notifications`
- tests de `src/lib/dashboard-read-models`
- tests de `src/lib/pwa`
- tests de rutas push si aplica.

### Tareas obligatorias

1. Medir coverage actual.
2. Definir thresholds progresivos por Module critico.
   - No exigir 100% global.
   - Empezar por umbrales realistas que eviten regresion.
3. Agregar tests faltantes para contratos criticos:
   - RPC success/error/invalid response;
   - idempotency key;
   - payment snapshots;
   - notification outcomes;
   - offline read guard;
   - push authorization.
4. Confinar casts detectados fuera de Adapters.
5. Revisar `Record<string, unknown>` en use-cases y UI.
6. Documentar excepciones aceptadas.
7. Ejecutar coverage.

### Busquedas obligatorias

```bash
rg -n "as unknown|as never|Record<string, unknown>" src/app src/components src/hooks src/store src/lib/use-cases
rg -n "typedRpcClient|\\.rpc\\(" src
rg -n "createServiceRoleClient" src
```

### Validaciones obligatorias

```bash
npm run lint
npm test -- --run
npm run test:coverage
npm run build
npm run migrate:validate
```

### Criterios de salida

La fase 6 solo queda cerrada si:

- Coverage corre y queda documentado.
- Hay thresholds o una decision documentada de thresholds progresivos.
- Modules criticos tienen tests de contrato suficientes para los cambios hechos.
- Casts nuevos quedan dentro de Adapters.
- No hay RPC critica sin Adapter tipado.
- No hay ruta con service role sin auth/rol validado.
- Todos los comandos obligatorios pasan.
- Este documento incluye el bloque de cierre de Fase 6.

### Bloqueadores de avance

- Coverage fallido o no ejecutado.
- Tests criticos omitidos por complejidad.
- Service role expuesto sin validacion.
- RPC directa desde UI o store.

#### Cierre Fase 6 - 2026-05-25

- Slice cerrado:
  - Coverage ejecutable con thresholds progresivos.
  - Contratos de rutas push sensibles.
  - Contratos criticos existentes de RPC Adapters, payments, notifications, dashboard-read-models y PWA confirmados por suite.
  - Confinamiento incremental de casts estructurales en use-cases.
- Archivos actualizados:
  - `vitest.config.ts`
  - `src/app/api/push/subscriptions/route.test.ts`
  - `src/app/api/push/test/route.test.ts`
  - `src/lib/use-cases/categorias-use-cases.ts`
  - `src/lib/use-cases/terceros-use-cases.ts`
  - `src/lib/use-cases/terceros/tercero-metodo-pago-use-cases.ts`
  - `src/lib/use-cases/ventas/ventas-shared.ts`
  - `src/lib/use-cases/ventas/ventas-write-use-cases.ts`
  - `src/lib/use-cases/servicios/servicios-shared.ts`
  - `src/lib/use-cases/servicios/servicios-write-use-cases.ts`
  - `src/lib/utils/activityLogHelpers.ts`
  - `src/types/ventas.ts`
  - `src/types/servicios.ts`
- Coverage final:
  - Statements: 45.91%.
  - Branches: 37.02%.
  - Functions: 42.85%.
  - Lines: 49.29%.
  - `npm run test:coverage`: 73 archivos, 280 tests pasan.
- Thresholds progresivos agregados:
  - Global:
    - statements 45
    - branches 36
    - functions 42
    - lines 48
  - `src/lib/payments/**`:
    - statements 85
    - branches 65
    - functions 80
    - lines 85
  - `src/lib/dashboard-read-models/**`:
    - statements 80
    - branches 60
    - functions 90
    - lines 85
  - `src/lib/use-cases/notificaciones/**`:
    - statements 85
    - branches 50
    - functions 85
    - lines 85
  - `src/lib/notifications/**`:
    - statements 45
    - branches 45
    - functions 40
    - lines 45
  - `src/lib/pwa/**`:
    - statements 50
    - branches 35
    - functions 50
    - lines 50
  - `src/lib/executive-push/**`:
    - statements 60
    - branches 45
    - functions 60
    - lines 65
- Tests agregados:
  - `/api/push/subscriptions`:
    - exige admin antes de usar service role.
    - valida payload antes de usar service role.
    - upsert usa `user.id` autenticado.
    - delete queda acotado por `user_id` + `endpoint`.
  - `/api/push/test`:
    - rechaza anonimo.
    - rechaza no-admin.
    - fuerza envio solo despues de autorizacion admin.
- Casts estructurales reducidos:
  - `detectarCambios` ahora acepta objetos de dominio y confina la conversion estructural dentro del helper.
  - `categorias-use-cases`, `terceros-use-cases`, `ventas-write-use-cases` y `servicios-write-use-cases` ya no castean entidades de dominio a `Record<string, unknown>` para activity log.
  - `tercero-metodo-pago-use-cases` elimina `as never` en el update de metodo de pago.
  - `ventas-shared` y `servicios-shared` usan listas tipadas de keys y helper `assignDefined`.
  - `VentaDoc` y `Servicio` declaran campos fisicos de archivado/corte usados por los update helpers.
- Excepciones de casts aceptadas tras busqueda:
  - Tests con `as never` para construir entradas invalidas deliberadas.
  - `whatsappToastStore` valida JSON desconocido desde storage runtime.
  - `DataTable`, tipos de rows y charts usan `Record<string, unknown>` como frontera generica de render.
  - `CambiosModal` expone metadata arbitraria de activity log.
  - `ventas-shared.ventaBaseFromRecord` sigue siendo Adapter de lectura legacy desde record fisico.
  - `terceros-use-cases.getTerceroSqlPayload` arma payload fisico para repository generico; queda aceptado hasta crear Adapter de escritura dedicado para Terceros.
- Busquedas obligatorias ejecutadas:
  - `rg -n "as unknown|as never|Record<string, unknown>" src/app src/components src/hooks src/store src/lib/use-cases`
    - Solo quedan las excepciones anteriores; no se agregaron casts nuevos en workflows criticos.
  - `rg -n "typedRpcClient|\\.rpc\\(" src`
    - Las llamadas `.rpc()` aparecen solo en `src/lib/supabase/*-rpc-adapter.ts` y `src/lib/supabase/rpc-client.ts`.
  - `rg -n "createServiceRoleClient" src`
    - Aparece en:
      - `src/app/api/push/subscriptions/route.ts`, protegido por `requireAuthenticatedAdmin`.
      - `src/lib/executive-push/executive-push-delivery.ts`, usado por rutas protegidas por cron secret o admin.
      - tests/mocks correspondientes.
- Validaciones ejecutadas:
  - `npm run lint`: pasa sin warnings.
  - `npm test -- --run`: 73 archivos, 280 tests pasan.
  - `npm run test:coverage`: 73 archivos, 280 tests pasan; thresholds pasan.
  - `npm run build`: pasa con Next.js 16.2.4.
  - `npm run migrate:validate`: pasa; 0 blocking/security failures.
- Criterios de salida:
  - Coverage corre y queda documentado.
  - Thresholds progresivos quedan activos.
  - Modules criticos tienen contratos suficientes para los cambios hechos.
  - Casts nuevos quedan confinados o documentados como excepcion.
  - No hay RPC critica directa fuera de Adapters tipados.
  - No hay ruta con service role sin auth/rol o cron secret validado.
  - Todos los comandos obligatorios pasan.
- Pendientes fuera de alcance:
  - Subir cobertura global de UI/stores legacy requiere una fase dedicada; los thresholds actuales son de no-regresion, no de calidad final ideal.
  - Crear Adapters dedicados para Terceros y lecturas legacy de Venta reduciria las excepciones restantes de `Record<string, unknown>`.
- Estado: Fase 6 cerrada al 100%. No avanzar a Fase 7 sin iniciar revision final de cierres, deuda residual y validacion completa.

## Fase 7: cierre final y congelamiento de deuda residual

### Objetivo

Cerrar el ciclo completo, confirmar que no queda trabajo parcial de fases anteriores y registrar explicitamente que deuda queda fuera de alcance por ADR, decision de producto o bajo impacto.

### Alcance

Incluye:

- Revision de todas las fases anteriores.
- Busquedas finales.
- Validaciones completas.
- Actualizacion de documentos activos.
- Backlog residual.

### Tareas obligatorias

1. Revisar cierres de Fase 0 a Fase 6.
2. Confirmar que ningun cierre tiene criterios incompletos.
3. Ejecutar busqueda final de deuda:
   - imports directos a stores desde use-cases;
   - imports directos a repositorios desde UI;
   - casts estructurales fuera de Adapters;
   - docs marcadas como activas pero desactualizadas;
   - TODO/FIXME/HACK nuevos.
4. Ejecutar validacion completa.
5. Actualizar el estado de este documento.
6. Actualizar backlog residual con:
   - deuda aceptada;
   - razon;
   - ADR relacionada si aplica;
   - criterio para reabrir.
7. Confirmar que no hay cambios sin documentar.

### Busquedas obligatorias

```bash
git status --short
rg -n "TODO|FIXME|HACK|@ts-ignore|@ts-expect-error|eslint-disable" src docs scripts supabase
rg -n "from ['\"]@/store" src/lib/use-cases
rg -n "from ['\"]@/lib/supabase" src/app src/components
rg -n "as unknown|as never|Record<string, unknown>" src/app src/components src/hooks src/store src/lib/use-cases
```

### Validaciones obligatorias

```bash
npm run lint
npm test -- --run
npm run test:coverage
npm run build
npm run migrate:validate
npm run secrets:scan
```

### Criterios de salida

La fase 7 solo queda cerrada si:

- Todas las fases anteriores tienen cierre completo.
- No hay criterios pendientes.
- Todos los comandos obligatorios pasan.
- La documentacion activa no contradice el codigo actual.
- El backlog residual solo contiene deuda explicitamente fuera de alcance o protegida por ADR.
- El proyecto queda en estado reproducible para otro maintainer.

### Bloqueadores de avance

- Cualquier fase anterior sin cierre.
- Cualquier validacion no ejecutada.
- Cualquier documento activo desactualizado.
- Cualquier deuda nueva sin clasificar.

#### Cierre Fase 7 - 2026-05-25

- Revision de fases:
  - Fase 0 cerrada.
  - Fase 1 cerrada.
  - Fase 2 cerrada al 100%.
  - Fase 3 cerrada al 100%.
  - Fase 4 cerrada al 100%.
  - Fase 5 cerrada al 100%.
  - Fase 6 cerrada al 100%.
- Documentacion activa actualizada:
  - `docs/2026-05-25-auditoria-arquitectura-actual-improve-codebase.md`
  - `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`
  - `README.md`
- Backlog residual actualizado con:
  - deuda aceptada;
  - razon;
  - ADR/decision relacionada;
  - criterio para reabrir.
- Busquedas finales ejecutadas:
  - `git status --short`
    - Worktree con cambios acumulados de fases 0-7; no hay commit realizado por este cierre.
  - `rg -n "\\b(TODO|FIXME|HACK)\\b|@ts-ignore|@ts-expect-error|eslint-disable" src docs scripts supabase`
    - Sin `TODO/FIXME/HACK` reales en `src`, `scripts` o `supabase`.
    - Hay referencias documentales al comando de busqueda.
    - Persisten `eslint-disable` puntuales de hooks React en UI, clasificados como deuda aceptada.
  - `rg -n 'from ["'']@/store' src/lib/use-cases`
    - Sin resultados.
  - `rg -n 'from ["'']@/lib/supabase' src/app src/components`
    - Sin resultados.
  - `rg -n "as unknown|as never|Record<string, unknown>" src/app src/components src/hooks src/store src/lib/use-cases`
    - Resultados clasificados:
      - tests con entradas invalidas deliberadas;
      - `whatsappToastStore` para parsear JSON desconocido;
      - `DataTable`, rows y charts como fronteras genericas;
      - metadata de activity log;
      - lectura legacy `ventaBaseFromRecord`;
      - payload fisico `getTerceroSqlPayload`.
- Validaciones finales ejecutadas:
  - `npm run lint`: pasa sin warnings.
  - `npm test -- --run`: 73 archivos, 280 tests pasan.
  - `npm run test:coverage`: 73 archivos, 280 tests pasan; thresholds pasan.
  - `npm run build`: pasa con Next.js 16.2.4.
  - `npm run migrate:validate`: pasa; 0 blocking/security failures.
  - `npm run secrets:scan`: pasa; solo warnings CRLF de Git, sin hallazgos de secretos.
- Deuda residual congelada:
  - Stores Zustand de dominio como frontera legacy.
  - Casts genericos en render/metadata/tests/adapters legacy.
  - `eslint-disable` puntuales de hooks React.
  - Coverage global moderado por UI/stores legacy, protegido con thresholds progresivos.
  - Decisiones no tocar sin ADR: multiusuario RLS, `force-dynamic`, offline mutations, metricas fuera de Postgres y reemplazo total de Zustand.
- Criterios de salida:
  - Todas las fases anteriores tienen cierre completo.
  - Todos los comandos obligatorios pasan.
  - La documentacion activa queda alineada con el codigo actual.
  - El backlog residual contiene deuda explicitamente aceptada o protegida por ADR/decision.
  - El proyecto queda reproducible para otro maintainer.
- Estado: Fase 7 cerrada al 100%. Plan de auditoria/arquitectura cerrado.

## Politica de no avance

Una fase queda bloqueada automaticamente si ocurre cualquiera de estos casos:

- falla un comando obligatorio;
- aparece un warning nuevo;
- se deshabilita un test para pasar;
- se agrega deuda dentro del alcance y no se resuelve;
- se toca una decision protegida por ADR sin actualizar ADR;
- se cambia comportamiento financiero sin test;
- se cambia auth/RLS/RPC/service role sin `migrate:validate`;
- se deja un TODO/FIXME/HACK nuevo dentro del alcance;
- se cambia una Interface publica sin actualizar callers y tests.

La respuesta correcta ante un bloqueo no es avanzar: es corregir, validar y registrar el cierre.

## Estado sano esperado al final

El proyecto se considera cerrado para este plan solo cuando:

- `npm run lint` pasa con 0 warnings.
- `npm test -- --run` pasa.
- `npm run test:coverage` pasa.
- `npm run build` pasa.
- `npm run migrate:validate` pasa.
- `npm run secrets:scan` pasa.
- Documentacion activa y runtime coinciden.
- Stores de dominio ya no son la fuente principal de lecturas remotas para los slices declarados.
- `financialPayments` o una Interface equivalente concentra pagos criticos.
- Workflows de detalle tienen outcomes claros y menos coordinacion dispersa.
- Notificaciones separa dominio, UI, browser APIs e invalidacion.
- Casts estructurales estan confinados a Adapters/core Supabase o documentados como excepcion.
- La deuda residual esta clasificada y no contradice criterios de fase.
