# ADR-0002: Dashboard Snapshot Server-Side

**Status:** Accepted  
**Date:** 2026-05-31

## Context

`get_dashboard_stats_live()` centraliza el calculo financiero del dashboard en
Postgres. Esa funcion es correcta como fuente canonica, pero recalcula el
historico completo cada vez que el cliente abre el dashboard.

El cache del cliente (`staleTime`, invalidaciones de React Query o el event bus
in-process) reduce lecturas repetidas en una sesion, pero no cambia el costo de
cada calculo y no es durable. Un navegador cerrado, otra pestana, otro
dispositivo, una RPC directa o un job server-side no pueden depender de ese bus
para mantener consistente un read-model.

El proyecto ya retiro `dashboard_stats` y `rebuild_dashboard_financial_stats()`.
Por eso no se debe reintroducir un agregador mutable desde cliente ni un segundo
calculo financiero paralelo.

## Decision

El dashboard usara un snapshot materializado mantenido por Postgres:

- `get_dashboard_stats_live()` sigue siendo la fuente canonica del calculo.
- `private.dashboard_stats_snapshot` guarda el ultimo resultado calculado.
- `private.dashboard_read_model_state` guarda si el snapshot esta `dirty`.
- triggers statement-level en tablas fuente solo marcan `dirty`; no calculan
  metricas ni contienen reglas de negocio.
- `public.refresh_dashboard_stats_snapshot()` toma un advisory lock, revisa
  `dirty`, ejecuta el calculo canonico y actualiza el snapshot.
- `pg_cron` ejecuta el refresh periodicamente; si no hay cambios, retorna sin
  recalcular.
- `public.get_dashboard_stats_snapshot()` es la RPC de lectura para el cliente.

## Consequences

- Leer el dashboard se vuelve una lectura O(1) del snapshot.
- El costo pesado se paga solo despues de cambios reales en datos fuente.
- La invalidacion es durable y server-side; no depende del navegador.
- El refresh queda coalesced por `dirty` + advisory lock, asi que un lote de
  cambios no dispara recalculos repetidos.
- Durante la ventana entre una escritura y el siguiente refresh, el cliente puede
  leer el snapshot anterior. `updated_at`/`refreshed_at` indica la frescura del
  dato.
- Si el snapshot no existe, la RPC de lectura fuerza un primer refresh y, si aun
  no hay snapshot, cae al calculo live como fallback.

## Alternatives Considered

- **Subir `staleTime` del cliente:** rechazado porque solo reduce frecuencia,
  no costo ni durabilidad.
- **Store-reactions/client event bus refrescando el snapshot:** rechazado porque
  el bus es in-memory y no cubre escrituras fuera de esa sesion.
- **Vista materializada con cron fijo:** mejor que live, pero recalcula por
  horario aunque no haya cambios y mantiene una ventana fija de datos viejos.
- **Triggers recalculando agregados:** rechazado porque mete calculo pesado y
  reglas de negocio en triggers. Los triggers aceptados solo marcan dirty.
- **Tabla incremental por delta:** posible a futuro, pero hoy duplicaria reglas
  financieras que ya viven correctamente en `get_dashboard_stats_live()`.
