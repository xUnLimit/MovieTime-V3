# Pendientes Post Arquitectura

**Fecha:** 2026-05-25  
**Estado:** Completado
**Scope:** Limpieza pendiente despues de implementar las prioridades arquitectonicas.  
**Excluded:** Testing, cobertura y metas de porcentaje de coverage.

## Resumen

Las prioridades arquitectonicas 1-10 ya quedaron implementadas y validadas. La limpieza de compatibilidad legacy se cerro removiendo los re-exports temporales, migrando callers/pruebas a los modulos nuevos y dejando la nueva arquitectura como interface visible.

## 1. Eliminar Compatibilidad Legacy

Estos archivos quedaron como re-export temporal para no romper imports antiguos. Deben eliminarse cuando todos los callers y pruebas hayan migrado al modulo nuevo:

- `src/lib/services/executivePushService.ts`
- `src/lib/services/ventaSyncService.ts`
- `src/lib/services/servicioSyncService.ts`
- `src/lib/services/terceroMetodoPagoSyncService.ts`
- `src/lib/services/metodoPagoSyncService.ts`
- `src/components/notificaciones/ventas-proximas/venta-renewal-actions.ts`
- `src/app/(dashboard)/ventas/[id]/components/venta-detalle-data.ts`

## 2. Actualizar Documentacion Y Comentarios Obsoletos

Buscar referencias a nombres legacy y reemplazarlas por los modulos nuevos. Caso conocido:

- `src/types/ventas.ts` menciona `ventaSyncService`.

Nombres nuevos esperados:

- `src/lib/use-cases/ventas/venta-current-payment-use-cases.ts`
- `src/lib/use-cases/ventas/venta-detail-use-cases.ts`
- `src/lib/use-cases/servicios/servicio-dependencies-use-cases.ts`
- `src/lib/use-cases/servicios/servicio-detail-use-cases.ts`
- `src/lib/use-cases/terceros/tercero-metodo-pago-use-cases.ts`
- `src/lib/use-cases/metodos-pago/metodo-pago-dependency-use-cases.ts`
- `src/lib/pwa/offline-copy.ts`
- `src/lib/executive-push/*`

## 3. Migrar Imports Antiguos Restantes

Ejecutar una busqueda final y eliminar cualquier dependencia directa hacia compatibilidad legacy:

```bash
rg "@/lib/services/(executivePushService|ventaSyncService|servicioSyncService|terceroMetodoPagoSyncService|metodoPagoSyncService)|venta-renewal-actions|venta-detalle-data" src
```

La meta es que los callers dependan de la nueva arquitectura, no de re-exports.

## 4. Revisar Archivos De Servicios Legacy

Una vez migrados los imports, borrar los archivos legacy re-export. `src/lib/services` deberia quedarse solo con modulos que realmente sean IO externo o integracion operacional vigente.

## 5. Segmentar Cambios En Commits

El working tree contiene varias fases arquitectonicas. Antes de mergear conviene separar commits por bloque:

- stores y reactions;
- notificaciones y detalle;
- read adapters y DataTable;
- PWA/offline;
- push ejecutiva;
- activity log;
- limpieza de legacy.

## Criterio De Cierre

- No quedan imports de produccion hacia archivos legacy.
- Los re-exports legacy fueron eliminados.
- Los comentarios/documentacion mencionan los modulos nuevos.
- `src/lib/services` ya no actua como cajon mixto.
- Validaciones finales pasan: lint, typecheck, tests, build, migracion y secrets scan.
