# Analisis del schema Supabase - 2026-05-15

## Resumen ejecutivo

El modelo remoto de `movietime-pty` esta operativo y las validaciones propias pasan. `npm run migrate:validate` reporto `status: passed`, sin fallas bloqueantes de integridad ni seguridad. El unico reporte aceptado sigue siendo `ventas_archivadas_activas = 5`.

Los riesgos principales no son de datos rotos en el flujo normal, sino de gobierno del schema:

- Hay drift de historial entre migraciones locales y remotas.
- Supabase Advisors reporta warnings de seguridad/performance que la validacion propia no cubre por completo.
- Existen tablas transitorias o derivadas que ya deberian tener decision explicita de retencion: `legacy_orphan_records`, `uuid_id_map`, `dashboard_stats` y `template_placeholders`.
- `ventas` conserva 5 registros archivados con `estado = 'activo'`; hoy esta permitido por el script de validacion, pero debe cerrarse como decision de negocio o correccion de datos.

No se aplicaron cambios de schema, datos, migraciones, policies ni funciones.

Actualizacion repo-first: se preparo la migracion
`supabase/migrations/20260515120000_schema_cleanup_and_hardening.sql` para
aplicar limpieza y hardening sin empujar todavia al remoto. La decision tomada
fue mantener `legacy_orphan_records`, pero moverla fuera de `public` hacia
`migration_audit` para que no aparezca como tabla operativa del API.

## Inventario y estado

Tablas de aplicacion detectadas por migraciones y tipos generados:

| Dominio | Tablas | Estado |
| --- | --- | --- |
| Auth y configuracion | `profiles`, `config`, `push_subscriptions` | Necesarias. `push_subscriptions` tiene warning RLS de performance. |
| Catalogos | `currencies`, `exchange_rates`, `metodos_pago`, `categorias`, `planes_tipos`, `planes`, `tipos_gasto`, `templates`, `template_placeholders` | Necesarias, excepto `template_placeholders` requiere decision porque el repositorio ignora `placeholders` al escribir templates. |
| Operacion principal | `terceros`, `servicios`, `ventas` | Nucleo activo. Buen uso de soft archive y snapshots. |
| Finanzas | `servicio_periodos`, `pagos_servicio`, `venta_periodos`, `pagos_venta`, `gastos` | Nucleo activo. Periodos y pagos estan normalizados y validados. |
| Notificaciones | `notificaciones`, `notificaciones_venta`, `notificaciones_servicio`, `notificaciones_reposo` | Necesarias por el modelo actual de detalles por entidad. `notificaciones_reposo` esta vacia, pero el codigo la usa. |
| Auditoria y migracion | `activity_log`, `legacy_orphan_records`, `uuid_id_map` | `activity_log` es operativo. `legacy_orphan_records` y `uuid_id_map` son de migracion/transicion y necesitan politica de cierre. |
| Cache/lectura | `dashboard_stats` | Cache regenerable. La app ya usa RPCs live, asi que conviene decidir si se mantiene como cache o se reduce. |

Conteos remotos relevantes:

| Tabla | Filas |
| --- | ---: |
| `terceros` | 476 |
| `ventas` | 459 |
| `venta_periodos` | 681 |
| `pagos_venta` | 681 |
| `servicios` | 165 |
| `servicio_periodos` | 268 |
| `pagos_servicio` | 268 |
| `activity_log` | 408 |
| `notificaciones` | 95 |
| `legacy_orphan_records` | 40 |
| `uuid_id_map` | 3467 |
| `dashboard_stats` | 1 |
| `push_subscriptions` | 1 |

Estado funcional observado:

- `ventas`: 346 activas, 113 inactivas, 5 archivadas, 5 activas archivadas, 91 cortadas.
- `servicios`: 142 activos, 23 inactivos, 5 archivados, 0 activos archivados, 0 en reposo.
- `notificaciones`: 95 total, 77 pendientes, 18 leidas, 0 dismissed.
- `legacy_orphan_records`: 40 pendientes, 0 resueltos; fuentes: 32 `pagosServicio`, 7 `ventas`, 1 `pagosVenta`.
- `uuid_id_map`: 3467 filas, principalmente `activity_log`, pagos y registros de migracion.

Vistas/RPCs principales usadas por la app:

- Lecturas denormalizadas: `v_ventas_full`, `v_servicios_full`, `v_pagos_venta_full`, `v_pagos_servicio_full`, `v_gastos_full`.
- Notificaciones: `v_notificaciones_venta`, `v_notificaciones_servicio`, `v_notificaciones_reposo`.
- RPCs operativas: `create_venta_with_initial_payment`, `create_servicio_with_initial_payment`, `create_venta_payment`, `create_servicio_payment`, updates/deletes atomicos de pagos, deletes con archive.
- RPCs de lectura: `get_dashboard_stats_live`, `get_dashboard_home`, `get_categorias_full`, `get_categorias_counts`.

## Hallazgos priorizados

### Alto - Drift de migraciones

`npx supabase migration list --linked` mostro historial divergente:

- Solo local: `20260510000700`, `20260511000100`, `20260511000200`, `20260511000300`.
- Solo remoto: `20260510060554`, `20260511181457`.

Esto no prueba que falte funcionalidad en remoto, porque las migraciones remotas con otros timestamps podrian contener cambios equivalentes. Pero si rompe trazabilidad: no se puede razonar con confianza sobre "local == remoto".

Recomendacion: reconciliar historial antes de seguir agregando migraciones. Comparar SQL efectivo de remoto contra local y crear una migracion/placeholder documentada que cierre la divergencia.

### Alto - Warnings de Supabase Advisors

`npx supabase db advisors --linked --output json` reporto:

- `function_search_path_mutable` en `public.create_venta_with_initial_payment` y `public.create_servicio_with_initial_payment`.
- `extension_in_public` para `pg_net`.
- `authenticated_security_definer_function_executable` en RPCs de pagos, deletes y `get_dashboard_stats_live`.
- `auth_leaked_password_protection` deshabilitado.
- `auth_rls_initplan` en las 4 policies de `push_subscriptions`.

La validacion propia reporta `security_definer_missing_search_path = 0` porque solo revisa `SECURITY DEFINER`; el advisor tambien marca funciones invoker sin `SET search_path`. Hay que ampliar el audit propio o aceptar explicitamente esa diferencia.

Recomendacion: agregar `SET search_path = public, pg_catalog` a las dos funciones iniciales, revisar si `pg_net` puede moverse fuera de `public`, y documentar la lista de RPCs `SECURITY DEFINER` como allowlist de API intencional.

### Medio - `push_subscriptions` tiene policies con initplan mejorable

Las policies usan `auth.uid()` directamente:

- `push_subscriptions_select_self_or_admin`
- `push_subscriptions_insert_self_or_admin`
- `push_subscriptions_update_self_or_admin`
- `push_subscriptions_delete_self_or_admin`

Supabase recomienda envolver funciones auth como `(select auth.uid())` para evitar reevaluacion por fila. Con 1 fila no impacta hoy, pero es barato corregirlo.

Recomendacion: migracion menor que cambie `user_id = auth.uid()` por `user_id = (select auth.uid())`.

### Medio - `legacy_orphan_records` sigue abierto

Hay 40 registros, todos sin `resolved_at`. La tabla fue creada para preservar huerfanos de la migracion Firestore, no para operacion diaria.

Recomendacion: revisar cada fuente, documentar resolucion y marcar `resolved_at`/`resolution`. Despues de cerrar, mantener la tabla solo como auditoria historica o exportarla a archivo y retirarla del modelo operativo.

### Medio - `uuid_id_map` parece transitoria y grande

Tiene 3467 filas y existe para normalizar ids legacy a strings UUID. No aparece como dependencia de runtime en `src/`, solo en migraciones/auditoria.

Recomendacion: no eliminar inmediatamente. Primero confirmar que no hay imports operativos ni jobs pendientes que necesiten remapeo. Si ya termino la migracion, moverla a schema privado o convertirla en artefacto historico/export.

### Medio - `dashboard_stats` duplicado con RPCs live

`dashboard_stats` se define como cache regenerable, pero la app lee `get_dashboard_stats_live()` y `get_dashboard_home()`. El servicio `dashboardStatsService` ya dejo mutaciones incrementales como no-op y usa rebuild por API.

Recomendacion: decidir una sola estrategia:

- Mantener cache si el dashboard necesita latencia constante y rebuild controlado.
- Reducir dependencia de `dashboard_stats` si `get_dashboard_stats_live()` ya calcula desde fuentes con performance aceptable.

No eliminar aun: hay seed, rebuild RPC, docs y ruta `/api/dashboard/rebuild` alrededor de esta tabla.

### Medio - `ventas_archivadas_activas = 5`

El script lo marca como aceptable, pero semanticamente "archivada y activa" mezcla estado operacional con visibilidad. Las queries principales filtran `archivado_at IS NULL`, por eso no parece romper listados.

Recomendacion: normalizar esos 5 registros a `estado = 'inactivo'` si negocio lo permite, o documentar formalmente que `archivado_at` domina a `estado` y ajustar validaciones/nombres para que no parezca inconsistencia.

### Bajo - `template_placeholders` no esta integrado al repositorio

La tabla tiene 24 filas y FK correcta a `templates`, pero `templates-repository.ts` descarta `placeholders` en escrituras. Esto sugiere que los placeholders son seed/metadata, no parte activa del editor.

Recomendacion: decidir si se recalculan desde `templates.contenido` al leer/escribir, o si se elimina la tabla y se derivan en codigo. No es prioridad alta.

### Bajo - `notificaciones_reposo` esta vacia, pero no es basura

Tiene 0 filas, pero `notifications-repository.ts` escribe detalles de reposo, las vistas la exponen y `executivePushService` la lee.

Recomendacion: mantenerla mientras exista el feature de reposo/push. Si reposo queda deshabilitado permanentemente, revisar tabla, vista e indice juntos.

## Modelo de datos

El modelo esta bien orientado para el dominio:

- Separar `ventas` de `venta_periodos` y `pagos_venta` evita perder historial comercial.
- Separar `servicios` de `servicio_periodos` y `pagos_servicio` preserva costos historicos y pagos reales.
- Los snapshots de plan, metodo de pago, categoria y notificacion son correctos para historicos y UI estable.
- Las vistas `*_full` reducen joins repetidos en frontend y encajan con la paginacion actual.
- Los deletes operativos son soft archive en `ventas`/`servicios`, preservando pagos y activity log.

Riesgos de largo plazo:

- Hay mucha logica de negocio en RPCs `SECURITY DEFINER`; esto es razonable para atomicidad, pero exige allowlist, tests y grants muy controlados.
- Varias tablas de migracion/cache conviven con el modelo operativo. Sin politica de cierre, el schema se vuelve mas dificil de mantener.
- El historial de migraciones divergente hace mas riesgoso diagnosticar bugs de produccion.

## Performance e indices

La base ya tiene indices para FKs y rutas de lectura principales: ventas por cliente/servicio/categoria, periodos por entidad, pagos por periodo/fecha, notificaciones por entidad y push por usuario/enabled.

No recomiendo agregar indices nuevos solo por heuristica. La mejor siguiente senal debe venir de:

- `pg_stat_statements` o Query Performance en Supabase para queries lentas reales.
- Uso de `EXPLAIN` sobre `v_ventas_full`, `v_servicios_full`, `get_dashboard_home()` y notificaciones si crecen.
- Revision de indices sin uso cuando exista acceso estable a `pg_stat_user_indexes`.

El intento de `npx supabase db lint --linked` devolvio un problema interno de `extensions.index_advisor` por `hypopg_reset()` faltante. Eso impide usar el index advisor como fuente confiable hasta corregir/extender HypoPG.

## Plan recomendado de remediacion

1. Reconciliar drift de migraciones y dejar historial local/remoto explicable.
2. Crear migracion de hardening para search_path de funciones iniciales y RLS initplan de `push_subscriptions`.
3. Revisar allowlist de RPCs `SECURITY DEFINER` y alinear `run_security_audit_validations()` con Supabase Advisors.
4. Cerrar decision de `legacy_orphan_records`: resolver, archivar o mover fuera del flujo operativo.
5. Decidir retencion de `uuid_id_map` como artefacto de migracion.
6. Definir estrategia de dashboard: cache `dashboard_stats` vs calculo live.
7. Normalizar o documentar las 5 `ventas` archivadas activas.
8. Revisar `template_placeholders` para derivarlo desde contenido o integrarlo realmente al editor.

## Validacion ejecutada

- `npm run migrate:validate`: paso.
- `npx supabase db advisors --linked --output json`: devolvio warnings listados arriba.
- `npx supabase db lint --linked`: ejecuto, pero el advisor de indices fallo por `hypopg_reset()` faltante.
- Conteos remotos por Supabase service role, sin imprimir secretos.
- Busquedas locales con `rg` sobre `src`, `scripts`, `tests`, `docs` y `supabase/migrations`.

Limitacion: las consultas directas de catalogo via `npx supabase db query --linked` quedaron bloqueadas temporalmente por autenticacion del rol CLI y pidieron `SUPABASE_DB_PASSWORD`. Por eso el inventario estructural se obtuvo desde migraciones/tipos locales y los conteos/estado desde la API Supabase con service role.
