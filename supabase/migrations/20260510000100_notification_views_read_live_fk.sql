-- ============================================================================
-- 20260510000100_notification_views_read_live_fk.sql
--
-- Aplicacion de Opcion 3 (snapshots solo para datos financieros inmutables):
-- las vistas de notificaciones leen los datos que pueden cambiar (nombres,
-- correo, contrasena, telefono, fechas de periodo y reposo) desde la FK viva
-- via JOIN, en vez de los campos *_snapshot. Asi cuando se corrige un dato
-- en el origen, la UI lo refleja inmediatamente.
--
-- Snapshots que se conservan:
--   - codigo_snapshot, ciclo_pago_snapshot, precio_final_snapshot,
--     moneda_snapshot, costo_servicio_snapshot, metodo_pago_nombre_snapshot,
--     renovacion_automatica_snapshot, dias_reposo_snapshot
-- (datos financieros / estructurales del momento, inmutables por diseno)
--
-- Las columnas snapshot redundantes permanecen en las tablas para compatibilidad
-- con el codigo de aplicacion existente; el sync de notificaciones puede
-- seguir poblandolas (no afectan a la UI porque la vista las ignora).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- v_notificaciones_venta: nombre de columnas se mantiene identico para no
-- romper el codigo cliente (notifications-repository.ts mapea *_snapshot a
-- los campos de la UI). Lo unico que cambia es la fuente de los datos.
--
-- DROP + CREATE en vez de CREATE OR REPLACE porque cambia la lista de columnas
-- (la version original usaba n.* y nv.*, ahora se enumeran explicitamente).
-- ----------------------------------------------------------------------------
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

  -- Datos que cambian -> FK viva, COALESCE como fallback al snapshot por si
  -- la entidad fue eliminada/desreferenciada (ON DELETE SET NULL).
  COALESCE(
    NULLIF(TRIM(BOTH ' ' FROM (COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, ''))), ''),
    nv.cliente_nombre_snapshot
  ) AS cliente_nombre_snapshot,
  COALESCE(u.telefono, nv.cliente_telefono_snapshot) AS cliente_telefono_snapshot,
  COALESCE(s.nombre, nv.servicio_nombre_snapshot) AS servicio_nombre_snapshot,
  COALESCE(s.correo, nv.servicio_correo_snapshot) AS servicio_correo_snapshot,
  -- Contrasena ahora se lee SIEMPRE de servicios.contrasena (FK viva); el
  -- campo *_snapshot deja de exponerse via la vista. Al estar tambien en la
  -- tabla, queda alli como respaldo historico hasta que se elimine fisicamente.
  s.contrasena AS servicio_contrasena_snapshot,
  COALESCE(c.nombre, nv.categoria_nombre_snapshot) AS categoria_nombre_snapshot,
  COALESCE(v.perfil_nombre, nv.perfil_nombre_snapshot) AS perfil_nombre_snapshot,

  -- Fechas del periodo: leidas en vivo de venta_periodos para que cambios en
  -- la fecha se reflejen en la notificacion sin tener que regenerarla.
  COALESCE(vp.fecha_inicio, nv.fecha_inicio_snapshot) AS fecha_inicio_snapshot,
  COALESCE(vp.fecha_fin, nv.fecha_fin_snapshot) AS fecha_fin_snapshot,

  -- Snapshots financieros (inmutables por diseno).
  nv.codigo_snapshot,
  nv.ciclo_pago_snapshot,
  nv.precio_final_snapshot,
  nv.moneda_snapshot,
  nv.metodo_pago_nombre_snapshot
FROM notificaciones n
JOIN notificaciones_venta nv ON nv.notificacion_id = n.id
LEFT JOIN ventas v          ON v.id = nv.venta_id
LEFT JOIN venta_periodos vp ON vp.id = nv.venta_periodo_id
LEFT JOIN usuarios u        ON u.id = nv.cliente_id
LEFT JOIN servicios s       ON s.id = nv.servicio_id
LEFT JOIN categorias c      ON c.id = nv.categoria_id
WHERE n.entidad = 'venta';

-- ----------------------------------------------------------------------------
-- v_notificaciones_servicio
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_notificaciones_servicio;
CREATE VIEW public.v_notificaciones_servicio
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
  ns.servicio_id,
  ns.servicio_periodo_id,
  ns.categoria_id,

  -- Datos que cambian -> FK viva con fallback al snapshot.
  COALESCE(s.nombre, ns.servicio_nombre_snapshot) AS servicio_nombre_snapshot,
  COALESCE(s.correo, ns.servicio_correo_snapshot) AS servicio_correo_snapshot,
  s.contrasena AS servicio_contrasena_snapshot,
  COALESCE(c.nombre, ns.categoria_nombre_snapshot) AS categoria_nombre_snapshot,

  -- Fechas del periodo: vivas.
  COALESCE(sp.fecha_inicio, ns.fecha_inicio_snapshot) AS fecha_inicio_snapshot,
  COALESCE(sp.fecha_vencimiento, ns.fecha_vencimiento_snapshot) AS fecha_vencimiento_snapshot,

  -- Snapshots financieros / estructurales (inmutables).
  ns.ciclo_pago_snapshot,
  ns.costo_servicio_snapshot,
  ns.moneda_snapshot,
  ns.metodo_pago_nombre_snapshot,
  ns.renovacion_automatica_snapshot
FROM notificaciones n
JOIN notificaciones_servicio ns ON ns.notificacion_id = n.id
LEFT JOIN servicios s            ON s.id = ns.servicio_id
LEFT JOIN servicio_periodos sp   ON sp.id = ns.servicio_periodo_id
LEFT JOIN categorias c           ON c.id = ns.categoria_id
WHERE n.entidad = 'servicio';

-- ----------------------------------------------------------------------------
-- v_notificaciones_reposo
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_notificaciones_reposo;
CREATE VIEW public.v_notificaciones_reposo
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
  nr.servicio_id,
  nr.categoria_id,

  -- Datos que cambian -> FK viva con fallback al snapshot.
  COALESCE(s.nombre, nr.servicio_nombre_snapshot) AS servicio_nombre_snapshot,
  COALESCE(s.correo, nr.servicio_correo_snapshot) AS servicio_correo_snapshot,
  s.contrasena AS servicio_contrasena_snapshot,
  COALESCE(c.nombre, nr.categoria_nombre_snapshot) AS categoria_nombre_snapshot,

  -- Fechas de reposo: vivas (servicios.fecha_inicio_reposo / fecha_fin_reposo).
  COALESCE(s.fecha_inicio_reposo, nr.fecha_inicio_reposo_snapshot) AS fecha_inicio_reposo_snapshot,
  COALESCE(s.fecha_fin_reposo, nr.fecha_fin_reposo_snapshot) AS fecha_fin_reposo_snapshot,

  -- Datos estructurales del momento (inmutable).
  nr.dias_reposo_snapshot
FROM notificaciones n
JOIN notificaciones_reposo nr ON nr.notificacion_id = n.id
LEFT JOIN servicios s          ON s.id = nr.servicio_id
LEFT JOIN categorias c         ON c.id = nr.categoria_id
WHERE n.entidad = 'reposo';

-- ----------------------------------------------------------------------------
-- GRANTs explicitos: replican los privilegios por defecto de public para que
-- las vistas recreadas sean accesibles desde la API de Supabase sin depender
-- de defaults que podrian no estar configurados.
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.v_notificaciones_venta    TO anon, authenticated, service_role;
GRANT SELECT ON public.v_notificaciones_servicio TO anon, authenticated, service_role;
GRANT SELECT ON public.v_notificaciones_reposo   TO anon, authenticated, service_role;
