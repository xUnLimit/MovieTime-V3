# Cierre total backlog fase 3/4

Fecha: 2026-05-25

## Objetivo

Cerrar los pendientes del backlog activo que no requieren ADR nueva: pagos, adapters, detalles de Venta/Servicio, PWA/offline, push ejecutiva, DataTable, `src/lib/services`, naming y documentacion.

## Enfoque aprobado

Se cerrara por modulos, manteniendo cambios compatibles con el runtime actual:

1. Profundizar `payments` como interfaz financiera de dominio.
2. Confinar payloads fisicos y casts en adapters/repositorios de Supabase.
3. Exponer fachadas de workflow para detalle de Venta y Servicio.
4. Exponer fachadas para Copia offline y push ejecutiva.
5. Reducir casts de DataTable con adapters tipados.
6. Clasificar `src/lib/services` como IO operacional.
7. Normalizar naming nuevo hacia `Tercero`.
8. Actualizar el backlog con evidencia de cierre.

## Limites

No se cambian decisiones que el backlog marca como "No tocar sin ADR": modelo RLS multiusuario, `force-dynamic`, offline mutations y metricas derivadas fuera de Postgres.

## Validacion

El cierre debe terminar con:

- `npm test -- --run`
- `npm run lint`
- `npm run build`

