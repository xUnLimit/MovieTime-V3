# Diagnóstico de restauración a d76a0ab

Referencia: `d76a0ab806c68e4c15f5ab74d75aacd29bca8a8d`.
Revisión realizada el 2 de octubre de 2026, hora de Panamá, sobre HEAD `e2746e4`.

## Resultado y alcance

Antes de estas correcciones, `src/` era idéntico al commit de referencia. Se
revisaron las diferencias de Git, la restauración SQL, las rutas de pagos y
borrado, los logs de Supabase y el catálogo real de producción. Producción se
consultó exclusivamente en lectura. No se hicieron commits, push ni despliegues.

Se prepararon dos migraciones nuevas. **Todavía no están aplicadas en producción**;
los fallos productivos requieren su aplicación mediante el proceso de release.

## Renovaciones: causa confirmada

Los logs de las últimas 24 horas muestran nueve respuestas HTTP 400 de
`create_venta_payment`. Los nueve errores de Postgres son `42P10` y señalan la
línea 109 de su implementación con idempotencia: no existe una restricción única
compatible con `ON CONFLICT (created_by, rpc_name, idempotency_key)`.

En producción, `rpc_idempotency_keys` tiene PK `(idempotency_key, rpc_name)`.
En un esquema reconstruido con las migraciones del repositorio tiene PK
`(created_by, rpc_name, idempotency_key)`. Por eso las pruebas locales originales
no reproducían el fallo. La migración original usaba `CREATE TABLE IF NOT EXISTS`:
no corrige la clave primaria de una tabla que ya existía. No se ha determinado
cuándo ni por qué se originó esa diferencia histórica.

La restauración de funciones dejó expuesta esta incompatibilidad. La misma
cláusula aparece en cinco RPC: creación de venta y servicio con pago inicial,
renovaciones de venta y servicio, y reembolsos de venta.

`20261006030000_repair_restored_rpc_idempotency_index.sql` agrega un índice único
con las tres columnas. Conserva la PK existente y su compatibilidad, los datos,
los permisos y las funciones restauradas. La prueba pgTAP reproduce la PK real
de producción en una transacción reversible: falla con `42P10` antes del índice
y pasa después, comprobando que el reintento no duplica pago ni periodo.

## Eliminación de terceros: causa confirmada

Los logs muestran tres borrados rechazados con `23503` por
`whatsapp_notices_tercero_id_fkey`. La FK no tenía acción de borrado y los avisos
seguían referenciando al cliente. Esa restricción ya estaba en las migraciones
anteriores al commit de referencia; no se atribuye su creación al bot v2.

`20261006020000_whatsapp_notices_tercero_delete_cascade.sql` cambia únicamente
esa FK a `ON DELETE CASCADE`, dentro de una transacción y con validación de la
restricción. Las ventas conservan `ON DELETE SET NULL`; pedidos y otras
dependencias no se modifican. El índice existente de avisos por tercero permite
resolver el borrado sin agregar otro índice.

El repositorio de terceros valida el UUID y convierte un bloqueo por dependencias
en `ConflictError` con un mensaje público en español. No expone detalles SQL.
La prueba pgTAP verifica el borrado por un administrador autenticado y la
eliminación del aviso, manteniendo RLS y sin otorgar DELETE directo sobre avisos.

## Diagnósticos de errores

El logger ahora registra tipo y constructor del valor rechazado, campos
diagnósticos conocidos y causas, incluyendo un marcador para `undefined`.
Tolera causas cíclicas y getters que fallan; mantiene la redacción de datos
sensibles y no registra el objeto completo. Los adaptadores de RPC y borrado
conservan la respuesta estructurada de Supabase como `cause` del error.

## Revisión adicional de producción

- Se compararon 1.939 objetos de catálogo productivos con el esquema local:
  funciones, columnas, restricciones, índices, triggers, políticas y vistas.
- Las definiciones de funciones, vistas, triggers y políticas coinciden. Fuera
  de las correcciones preparadas, la diferencia adicional es la ausencia de
  `whatsapp_message_deliveries`, tabla antigua que ningún archivo de `src/` usa.
  No se recrea una tabla que la aplicación actual no necesita.
- Se compararon 167 objetos de permisos/configuración de seguridad. Coinciden
  para los objetos presentes en ambos entornos. Todas las tablas de `public`
  tienen RLS activa. Los triggers y cron del bot v2 están retirados; `pedidos`
  y `domain_events` tienen cero filas.
- `run_all_validations()` no encontró pagos huérfanos, diferencias de saldo,
  perfiles duplicados/inconsistentes, ventas sin servicio ni categorías
  inconsistentes. Reporta 17 ventas archivadas con estado `activo`. Se dejan
  documentadas para revisión de datos; no se modifican registros históricos.
- Supabase está conectado y accesible. Vercel está instalado, pero devuelve
  `403 Forbidden` para el equipo `xunlimits-projects`: la conexión necesita
  autenticarse con acceso a ese equipo. No se verificó el despliegue por Vercel.

## Validación

| Comprobación | Resultado |
| --- | --- |
| `npm run quality:full` | Aprobado, código de salida 0 |
| Unitarias y cobertura | 360 archivos, 2.553 pruebas aprobadas |
| Cobertura del cambio | 97,50% líneas; 100% funciones; 97,92% ramas |
| Auditorías de dependencias | Producción y árbol completo aprobados con la política existente |
| Arquitectura, Knip, tamaño, diseño, ESLint y tipos | Aprobados |
| Seguridad de migraciones | Dos migraciones nuevas aprobadas |
| Build, smoke, accesibilidad, rendimiento y Lighthouse | Aprobados |
| pgTAP en PostgreSQL local | 160 comprobaciones aprobadas, incluidas ambas regresiones |
| E2E autenticado contra Supabase local | 40 pruebas aprobadas |
| `npm run test:integration` con credenciales locales | 22 aprobadas; 1 fallo de Realtime (`CHANNEL_ERROR`) |

El contenedor Realtime no existe en este entorno local. La CLI considera el
proyecto ya iniciado y no lo levanta al repetir `supabase start`. Ese fallo no
se oculta ni se omite. Los E2E también mostraron advertencias de limpieza de
fixtures por FK de ventas/servicios; las 40 comprobaciones funcionales pasaron.

La revisión automática rechazó el reset local hasta el commit antiguo por
riesgo de borrar datos. Se continuó con pruebas transaccionales reversibles;
no se hizo reset. Falta comprobar reconstrucción desde cero y los jobs de CI
de release. No se afirma que esos jobs se hayan ejecutado.

Logs locales de esta sesión: `reports/restoration-quality-full.log`,
`reports/restoration-integration.log`, `reports/restoration-auth-build.log` y
`reports/restoration-auth.log` (artefactos ignorados por Git).

## Archivos del cambio

- `supabase/migrations/20261006020000_whatsapp_notices_tercero_delete_cascade.sql`
- `supabase/migrations/20261006030000_repair_restored_rpc_idempotency_index.sql`
- `supabase/tests/database/tercero_notice_delete.sql`
- `supabase/tests/database/restored_rpc_idempotency.sql`
- `src/platform/observability/logger.ts` y `logger-thrown.test.ts`
- `src/platform/supabase/idempotent-rpc.ts` y su prueba
- `src/platform/supabase/record-core.ts` y su prueba
- `src/platform/supabase/terceros-repository.ts` y su prueba
- `src/platform/supabase/tercero-notice-delete-migration.test.ts`
- `src/platform/supabase/restored-rpc-idempotency-migration.test.ts`
- Este informe.
