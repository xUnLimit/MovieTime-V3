# Supabase V2 Hardening

Fecha: 2026-05-05

## Objetivo

Endurecer la migracion normalizada despues de alcanzar paridad visual con el
sistema anterior.
V2 reduce deuda de compatibilidad, evita dobles fuentes de verdad y deja reglas RLS
mas explicitas antes del cutover.

## Decisiones aplicadas

### Dashboard

`dashboard_stats` sigue existiendo como cache regenerable, pero la fuente de verdad
para metricas financieras, rentabilidad, graficas, pronostico y crecimiento de
usuarios pasa a ser `public.rebuild_dashboard_financial_stats()`.

La capa TypeScript ya no recalcula ingresos/gastos ni escribe arrays financieros.
`dashboardStatsService` lee el cache y solicita el rebuild por
`POST /api/dashboard/rebuild`, para que el RPC `SECURITY DEFINER` se ejecute solo
desde servidor con `SUPABASE_SERVICE_ROLE_KEY`.

La funcion SQL usa:

- `America/Panama` para fechas locales del negocio.
- `pg_advisory_xact_lock(hashtext('dashboard_stats_rebuild'))` para serializar
  rebuilds concurrentes.
- montos historicos `*_usd` guardados en pagos, no tasas actuales.

### RLS

Se reemplazaron policies amplias por policies explicitas:

- `notificaciones_*`: `SELECT`, `INSERT`, `UPDATE`, `DELETE` separados.
- `notificaciones`: delete operativo para usuarios autenticados porque son
  regenerables y la app las limpia al renovar/cortar.
- `activity_log`: delete solo admin. La auditoria vuelve a ser protegida; la UI
  deshabilita la limpieza para operadores.
- `profiles_update_self_no_role`: evita subquery directa sobre `profiles` bajo
  la misma policy y usa `auth_role()`.

### Supabase linter

Se aplico `20260505025000_linter_security_rls_hardening.sql` para cerrar los
warnings del linter de base de datos:

- `private.auth_role()` reemplaza al helper publico dentro de RLS.
- `public.auth_role()` y `public.rebuild_dashboard_financial_stats()` ya no son
  ejecutables por `anon` ni `authenticated`.
- `profiles_*` usa `(SELECT auth.uid())` y `(SELECT private.auth_role())` para
  evitar re-evaluacion por fila.
- Policies `FOR ALL` de escritura admin fueron separadas por accion para evitar
  policies permisivas multiples sobre `SELECT`.
- Se agregaron indices para las foreign keys reportadas por el linter.

Resultado remoto despues del push:

```text
npx supabase db lint --linked
No schema errors found
```

El warning `auth_leaked_password_protection` no se corrige por SQL/migration; debe
activarse en Supabase Dashboard, en Auth password security.

### Fechas

`src/lib/supabase/pagination.ts` ahora trata columnas `DATE` como fecha local,
igual que `src/lib/supabase/dates.ts`. Esto evita desplazamientos de un dia por
`new Date('YYYY-MM-DD')` en America/Panama/America/Bogota.

### Notificaciones

Las notificaciones mantienen el modelo normalizado:

- `notificaciones` base.
- `notificaciones_venta`.
- `notificaciones_servicio`.
- `notificaciones_reposo`.

Los snapshots siguen siendo foto del evento, no fuente viva. Se corrigieron
snapshots faltantes para nuevas notificaciones:

- ventas: `metodo_pago_nombre_snapshot`.
- reposo: `servicio_contrasena_snapshot`.

Tambien se agrego backfill para `notificaciones_venta.metodo_pago_nombre_snapshot`
desde el ultimo pago registrado.

### Runtime legado

Se elimino el runtime legacy y la aplicacion queda operando solo con Supabase.
Los scripts de migracion/auditoria legacy tambien fueron retirados despues del
cutover.

### Sync services

`servicioSyncService` y `metodoPagoSyncService` dejaron de propagar campos
denormalizados a ventas/pagos. En V2:

- ventas leen datos actuales de servicio mediante vistas.
- pagos conservan snapshots historicos.
- los cambios relevantes regeneran notificaciones y dashboard.

### Compat runtime

`src/lib/supabase/compat.ts`, `src/lib/supabase/repository.ts` y el facade
publico `records.ts` fueron eliminados del runtime. Los consumidores apuntan a
repositorios por dominio y la infraestructura compartida quedo dividida en
modulos explicitos: `entities.ts`, `record-core.ts`, `read-models.ts`,
`notifications-repository.ts`, `payments-repository.ts`, `write-utils.ts`,
`filters.ts` y `dates.ts`.

## Data fixes legacy

Existen migrations con reparaciones por IDs concretos porque fueron necesarias para
igualar datos historicos del sistema anterior:

- `20260505020000_pagos_servicio_categoria_snapshot.sql`
- `20260505022000_fix_discounted_forecast_price_snapshot.sql`

No son schema generico. Antes de merge final deben quedar documentadas como data
repair migrations del dataset MovieTime.

## Validacion de cutover

`scripts/validate-supabase-migration.ts` ahora separa validaciones bloqueantes de
reportes aceptables. El script falla con exit code `1` si cualquier check no
aceptable retorna filas.

Checks aceptables por decision de modelo:

- `ventas_archivadas_activas`: permitido porque archivar oculta la venta sin
  cambiar necesariamente `estado`.
- `servicios_archivados_activos`: permitido porque archivar oculta el servicio
  sin reescribir historial operativo.
- `periodos_venta_saldo_distinto`: reporte financiero para pagos parciales,
  pendientes o sobrepagos reales.
- `periodos_servicio_saldo_distinto`: reporte financiero para pagos parciales,
  pendientes o sobrepagos reales.

Ultima validacion ejecutada en Supabase `amvougsdkpyptzahtram`:

```json
{
  "status": "passed",
  "blockingFailures": {},
  "acceptableReports": {
    "ventas_archivadas_activas": 1,
    "servicios_archivados_activos": 1,
    "periodos_venta_saldo_distinto": 3,
    "periodos_servicio_saldo_distinto": 4
  }
}
```

Los conteos entre sistemas ya no son criterio de igualdad estricta despues de
abrir escritura en Supabase. La validacion actual queda centrada en tablas
Supabase y `run_all_validations()`.

## Deuda post-cutover no bloqueante

- Reducir gradualmente el uso generico de `record-core.ts` dentro de repositorios
  de dominio cuando convenga exponer metodos mas especificos por modulo.
- Mover la separacion de validaciones bloqueantes/reportes aceptables desde
  `scripts/validate-supabase-migration.ts` a SQL si se quiere enforce remoto.
- Evaluar mover regeneracion de notificaciones a RPC/Edge Function programada.
