# Pendientes De Arquitectura Sin Testing

**Date:** 2026-05-25
**Scope:** Puntos arquitectonicos y de mantenibilidad pendientes.
**Excluded:** Testing, cobertura y metas de porcentaje de coverage.

## Resumen

MovieTime PTY tiene una base solida: ADRs vigentes, `CONTEXT.md`, Supabase/Postgres como fuente de verdad, RPC adapters tipados, idempotencia, React Query para lecturas y modulos profundos en pagos, notificaciones, dashboard y forecasting.

Lo pendiente no requiere reescritura. La prioridad es terminar la migracion desde stores/controllers legacy hacia interfaces mas profundas, con mayor locality y menos casts estructurales.

## Prioridad 1: Adelgazar Stores Legacy

### Archivos

- `src/store/tercerosStore.ts`
- `src/store/metodosPagoStore.ts`
- `src/store/gastosStore.ts`
- `src/store/categoriasStore.ts`
- `src/store/templatesStore.ts`
- `src/store/tiposGastoStore.ts`

### Problema

Varios stores todavia mezclan estado UI/cache con mutaciones, activity log, eventos, refreshes y coordinacion entre modulos. Eso contradice parcialmente ADR-0002: Zustand debe concentrarse en estado UI, filtros locales, seleccion, cache temporal y comandos optimistas, no en invariantes transaccionales ni coordinacion de dominio.

### Solucion

Crear modulos de reacciones y use-cases equivalentes a los ya agregados para Ventas y Servicios:

- `src/lib/store-reactions/terceros-mutation-reactions.ts`
- `src/lib/store-reactions/catalogos-mutation-reactions.ts`
- `src/lib/store-reactions/gastos-mutation-reactions.ts`
- `src/lib/store-reactions/templates-mutation-reactions.ts`

Los stores deben llamar una interface pequena despues de una mutacion confirmada. Esa interface concentra invalidaciones, eventos y side effects.

### Resultado Esperado

- Stores con menos imports cruzados.
- Menos llamadas directas a otros stores desde un store.
- Mejor locality: una mutacion de Tercero o Metodo de pago tiene un lugar claro donde ver sus reacciones.

## Prioridad 2: Profundizar Acciones Operativas De Notificacion

### Archivos

- `src/components/notificaciones/ventas-proximas/useVentasProximasController.ts`
- `src/components/notificaciones/servicios-proximos/useServiciosProximosController.ts`
- `src/components/notificaciones/ventas-proximas/venta-renewal-actions.ts`
- `src/app/(dashboard)/reposo/page.tsx`
- `src/app/(dashboard)/ventas/[id]/components/useVentaDetalleActions.ts`
- `src/app/(dashboard)/servicios/detalle/[id]/components/useServicioSaleActions.ts`

### Problema

Las pantallas y controllers de Notificacion conocen demasiados conceptos a la vez: Venta, Servicio, Metodo de pago, activity log, invalidaciones, stores y reglas de renovacion/corte. La interface de la UI es casi tan compleja como la implementacion.

### Solucion

Crear un modulo profundo para acciones operativas de Notificacion:

- `src/lib/use-cases/notificaciones/notificaciones-actions-use-cases.ts`
- `src/lib/use-cases/notificaciones/notificaciones-renewal-use-cases.ts`
- `src/lib/use-cases/notificaciones/notificaciones-reposo-use-cases.ts`

La UI deberia invocar acciones de alto nivel como:

- renovar Venta desde Notificacion.
- cortar Venta desde Notificacion.
- renovar Servicio desde Notificacion.
- finalizar Reposo.
- eliminar Notificacion asociada.

### Resultado Esperado

- Controllers con menos conocimiento de dominio.
- Menos duplicacion entre pantallas de Notificaciones, Venta detalle y Servicio detalle.
- Una sola interface para flujos operativos repetidos.

## Prioridad 3: Reducir Casts Estructurales En Supabase

### Archivos

- `src/lib/supabase/record-core.ts`
- `src/lib/supabase/pagination.ts`
- `src/lib/supabase/notifications-repository.ts`
- `src/lib/supabase/read-models.ts`
- `src/lib/supabase/categorias-repository.ts`
- `src/lib/supabase/write-utils.ts`

### Problema

Los repositories genericos usan muchos `Record<string, unknown>`, `as never` y casts para navegar limitaciones de tipos de Supabase. Algunos son inevitables, pero otros hacen que la interface sea demasiado ancha: los callers deben saber demasiado sobre tablas, vistas, mapeo camel/snake y shape de rows.

### Solucion

Mantener el core generico, pero agregar adapters profundos donde el dominio lo justifique:

- Adapter de lectura para Tercero.
- Adapter de lectura para Metodo de pago.
- Adapter de lectura para Servicio detalle.
- Adapter de lectura para Venta detalle.
- Adapter de Notificacion con payloads discriminados por entidad.

Los adapters deben ocultar:

- nombres fisicos de tablas/vistas;
- conversion camel/snake;
- normalizacion de fechas;
- detalles de joins/read models;
- errores de Supabase.

### Resultado Esperado

- Menos casts en UI/use-cases.
- Mas type safety en read models importantes.
- Menor dependencia de callers sobre estructura fisica de Supabase.

## Prioridad 4: Crear Table Adapters Por Dominio

### Archivos

- `src/components/shared/DataTable.tsx`
- `src/components/categorias/*Table*.tsx`
- `src/components/metodos-pago/*Table*.tsx`
- `src/components/gastos/*Table*.tsx`
- `src/components/terceros/*Table*.tsx`
- `src/components/servicios/*Table*.tsx`

### Problema

Muchas tablas fuerzan conversiones como `data as unknown as Record<string, unknown>[]` y `columns as unknown as Column<Record<string, unknown>>[]`. Eso filtra complejidad del DataTable hacia cada caller.

### Solucion

Crear adapters por dominio o mejorar la interface generica de DataTable para aceptar filas tipadas sin casts repetidos.

Opciones:

- `CategoriaTableAdapter`
- `MetodoPagoTableAdapter`
- `GastoTableAdapter`
- `TerceroTableAdapter`
- `ServicioTableAdapter`

Cada adapter traduce la fila de dominio al shape requerido por `DataTable`, incluyendo acciones y `onRowClick`.

### Resultado Esperado

- Tablas mas legibles.
- Menos casts por pantalla.
- La complejidad de renderizar tablas queda en un seam explicito.

## Prioridad 5: Centralizar Reacciones De Cache Y Eventos Restantes

### Archivos

- `src/lib/events/cache-reactions.ts`
- `src/hooks/use-ventas-tercero.ts`
- `src/hooks/use-ventas-por-terceros.ts`
- `src/hooks/use-entity-detail.ts`
- `src/app/(dashboard)/categorias/page.tsx`
- `src/app/(dashboard)/servicios/[id]/page.tsx`
- `src/app/(dashboard)/terceros/useTercerosPageController.ts`

### Problema

Ya existe `cache-reactions.ts`, pero todavia hay hooks y paginas que se suscriben directamente a `storeEventBus`. Esto mantiene la logica de invalidacion repartida.

### Solucion

Expandir `cache-reactions.ts` o dividirlo por dominio:

- `src/lib/events/ventas-cache-reactions.ts`
- `src/lib/events/servicios-cache-reactions.ts`
- `src/lib/events/terceros-cache-reactions.ts`
- `src/lib/events/categorias-cache-reactions.ts`
- `src/lib/events/metodos-pago-cache-reactions.ts`

Los hooks y paginas deberian llamar funciones de suscripcion nombradas, no registrar eventos uno por uno.

### Resultado Esperado

- Mapa claro de evento -> caches afectadas.
- Menos duplicacion de invalidaciones.
- Menos riesgo de olvidar una query al agregar un nuevo flujo.

## Prioridad 6: Ordenar Modulos Operacionales En `src/lib/services`

### Archivos

- `src/lib/services/servicioSyncService.ts`
- `src/lib/services/terceroMetodoPagoSyncService.ts`
- `src/lib/services/metodoPagoSyncService.ts`
- `src/lib/services/executivePushService.ts`
- `src/lib/services/currencyService.ts`

### Problema

`src/lib/services` todavia contiene comportamiento operacional con estilos mixtos: algunos servicios emiten eventos, otros importan stores, otros hablan directo con Supabase. `CONTEXT.md` permite que existan, pero indica no agregar dashboard metric mutation ni notification sync si ya hay modulos profundos.

### Solucion

Clasificar cada service:

- si es coordinacion cliente, mover hacia `store-reactions` o `events`;
- si es flujo de dominio, mover hacia `use-cases`;
- si es IO externo/server-side, mantener en `services`;
- si es lectura derivada, mover hacia read model dedicado.

### Resultado Esperado

- `services` deja de ser cajon mixto.
- Cada modulo tiene una razon clara para vivir ahi.
- Menos imports de stores dentro de `src/lib/services`.

## Prioridad 7: Profundizar PWA/Offline

### Archivos

- `src/lib/pwa/offline-sync.ts`
- `src/lib/pwa/offline-read.ts`
- `src/lib/pwa/offline-db.ts`
- `src/lib/pwa/mutation-guard.ts`
- `src/store/pwaStore.ts`
- `src/components/pwa/PwaBootstrap.tsx`

### Problema

La Copia offline esta bien separada conceptualmente, pero la implementacion se reparte entre store, bootstrap, helpers, IndexedDB y guards. La interface de alto nivel para "leer offline" y "sincronizar snapshot offline" podria ser mas profunda.

### Solucion

Crear un facade de Copia offline:

- `src/lib/pwa/offline-copy.ts`

Ese modulo deberia exponer pocas operaciones:

- preparar Copia offline;
- leer dashboard offline;
- leer coleccion offline;
- evaluar si una mutacion debe bloquearse;
- reportar estado de sincronizacion.

### Resultado Esperado

- Menos conocimiento de IndexedDB en callers.
- Mejor localidad para cambios de PWA.
- Mutaciones offline siguen bloqueadas desde un seam unico.

## Prioridad 8: Separar Push Ejecutiva De UI/Cliente

### Archivos

- `src/lib/services/executivePushService.ts`
- `src/lib/services/executive-push-summary-blocks.ts`
- `src/app/api/push/daily/route.ts`
- `src/app/api/push/pending/route.ts`
- `src/app/api/push/test/route.ts`
- `src/components/layout/ConfiguracionDialogExecutiveSection.tsx`

### Problema

Push ejecutiva mezcla configuracion, seleccion de bloques, delivery y lectura de notificaciones. Es un modulo valioso, pero puede ganar Depth separando la interface server-side de la configuracion UI.

### Solucion

Definir dos seams:

- `executive-push-delivery`: claim atomico, lectura server-side, envio, manejo de subscriptions.
- `executive-push-settings`: configuracion editable por UI.

### Resultado Esperado

- La UI no conoce detalles del delivery.
- Las rutas API no conocen detalles de formulario/configuracion.
- El delivery queda mas aislado ante cambios de cron o proveedores push.

## Prioridad 9: Normalizar Activity Log Como Dependencia De Dominio

### Archivos

- `src/lib/utils/activityLogHelpers.ts`
- `src/store/activityLogStore.ts`
- `src/lib/use-cases/**`
- `src/store/**`

### Problema

Activity log se pasa como callback desde stores hacia use-cases, pero otros stores todavia lo invocan directamente. Es funcional, pero el seam no esta completamente normalizado.

### Solucion

Crear una interface de registro de actividad:

- `src/lib/activity/activity-log-writer.ts`

Los use-cases reciben esa interface o una implementacion por defecto. Los stores no deberian construir metadata de dominio si el use-case puede hacerlo.

### Resultado Esperado

- Menos duplicacion de metadata.
- Activity log consistente entre entidades.
- Cambios de formato se concentran en un lugar.

## Prioridad 10: Consolidar Detalle De Venta Y Servicio

### Archivos

- `src/app/(dashboard)/ventas/[id]/components/*`
- `src/app/(dashboard)/servicios/detalle/[id]/components/*`
- `src/app/(dashboard)/ventas/[id]/components/venta-detalle-data.ts`
- `src/app/(dashboard)/servicios/detalle/[id]/components/useServicioDetalleData.ts`

### Problema

Los detalles de Venta y Servicio tienen muchos hooks y submodulos especificos que coordinan lectura, acciones, WhatsApp, pagos, perfiles y notificaciones. La UI esta razonablemente dividida, pero los workflows aun no tienen una interface compacta.

### Solucion

Crear modulos de detalle por dominio:

- `src/lib/use-cases/ventas/venta-detail-use-cases.ts`
- `src/lib/use-cases/servicios/servicio-detail-use-cases.ts`

Estos modulos deben entregar bundles de datos y acciones orientadas a la pantalla, sin que la pantalla conozca repositories ni stores internos.

### Resultado Esperado

- Pantallas de detalle mas declarativas.
- Menos imports cruzados.
- Mejor locality para cambios en pagos, perfiles o WhatsApp.

## Orden Recomendado

1. Adelgazar stores legacy.
2. Profundizar acciones operativas de Notificacion.
3. Centralizar reacciones de cache/eventos restantes.
4. Reducir casts en Supabase con adapters de read model.
5. Crear Table Adapters por dominio.
6. Ordenar `src/lib/services`.
7. Profundizar PWA/Offline.
8. Separar Push ejecutiva.
9. Normalizar Activity Log.
10. Consolidar detalles de Venta y Servicio.

## Criterios De Finalizacion

- Los stores no importan otros stores salvo casos estrictamente UI.
- Los controllers UI no registran multiples eventos manualmente.
- Los flujos de Notificacion llaman use-cases de alto nivel.
- Los casts `Record<string, unknown>` y `as never` quedan confinados a adapters internos.
- Los nombres de modulos reflejan terminos de `CONTEXT.md`.
- No se agregan mutaciones cliente para metricas derivadas.
- Los RPCs criticos siguen pasando por adapters tipados con idempotency key.
