-- ============================================================================
-- Expose live venta notes in sale notifications.
--
-- /notificaciones renewals use v_notificaciones_venta as their read model.
-- The sale detail page already reads ventas.notas from v_ventas_full, so expose
-- the same live field here to keep renewal defaults consistent without adding
-- per-click lookups or duplicating a stale snapshot in notificaciones_venta.
-- ============================================================================

DROP VIEW IF EXISTS public.v_notificaciones_venta;
CREATE VIEW public.v_notificaciones_venta
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.dedupe_key,
  n.entidad,
  n.tipo,
  n.prioridad,
  n.titulo,
  n.mensaje,
  n.dias_restantes,
  n.scheduled_for,
  n.leida,
  n.resaltada,
  n.created_at,
  n.updated_at,
  n.read_at,
  n.dismissed_at,
  nv.venta_id,
  nv.venta_periodo_id,
  nv.cliente_id,
  nv.servicio_id,
  nv.categoria_id,

  COALESCE(
    NULLIF(TRIM(BOTH ' ' FROM (COALESCE(t.nombre, '') || ' ' || COALESCE(t.apellido, ''))), ''),
    nv.cliente_nombre_snapshot
  ) AS cliente_nombre_snapshot,
  COALESCE(t.telefono, nv.cliente_telefono_snapshot) AS cliente_telefono_snapshot,
  COALESCE(s.nombre, nv.servicio_nombre_snapshot) AS servicio_nombre_snapshot,
  COALESCE(s.correo, nv.servicio_correo_snapshot) AS servicio_correo_snapshot,
  s.contrasena AS servicio_contrasena_snapshot,
  COALESCE(c.nombre, nv.categoria_nombre_snapshot) AS categoria_nombre_snapshot,
  COALESCE(v.perfil_nombre, nv.perfil_nombre_snapshot) AS perfil_nombre_snapshot,
  v.notas,

  COALESCE(vp.fecha_inicio, nv.fecha_inicio_snapshot) AS fecha_inicio_snapshot,
  COALESCE(vp.fecha_fin, nv.fecha_fin_snapshot) AS fecha_fin_snapshot,

  nv.codigo_snapshot,
  nv.ciclo_pago_snapshot,
  nv.precio_final_snapshot,
  nv.moneda_snapshot,
  nv.metodo_pago_nombre_snapshot
FROM notificaciones n
JOIN notificaciones_venta nv ON nv.notificacion_id::text = n.id::text
LEFT JOIN ventas v          ON v.id::text = nv.venta_id::text
LEFT JOIN venta_periodos vp ON vp.id::text = nv.venta_periodo_id::text
LEFT JOIN terceros t        ON t.id::text = nv.cliente_id::text
LEFT JOIN servicios s       ON s.id::text = nv.servicio_id::text
LEFT JOIN categorias c      ON c.id::text = nv.categoria_id::text
WHERE n.entidad = 'venta';

GRANT SELECT ON public.v_notificaciones_venta TO anon, authenticated, service_role;
