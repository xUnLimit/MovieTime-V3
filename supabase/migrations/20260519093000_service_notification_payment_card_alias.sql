-- ============================================================================
-- Service notifications: payment method alias and card termination snapshots.
-- ============================================================================

ALTER TABLE public.notificaciones_servicio
  ADD COLUMN IF NOT EXISTS metodo_pago_alias_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS metodo_pago_tarjeta_terminacion_snapshot TEXT;

UPDATE public.notificaciones_servicio ns
SET
  metodo_pago_alias_snapshot = mp.alias,
  metodo_pago_tarjeta_terminacion_snapshot = NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(mp.numero_tarjeta, ''), '\D', '', 'g'), 4), '')
FROM public.servicios s
LEFT JOIN public.v_servicios_full sf ON sf.id = s.id
LEFT JOIN public.metodos_pago mp ON mp.id = sf.ultimo_metodo_pago_id
WHERE ns.servicio_id = s.id
  AND (
    ns.metodo_pago_alias_snapshot IS DISTINCT FROM mp.alias
    OR ns.metodo_pago_tarjeta_terminacion_snapshot IS DISTINCT FROM NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(mp.numero_tarjeta, ''), '\D', '', 'g'), 4), '')
  );

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
  COALESCE(s.nombre, ns.servicio_nombre_snapshot) AS servicio_nombre_snapshot,
  COALESCE(s.correo, ns.servicio_correo_snapshot) AS servicio_correo_snapshot,
  s.contrasena AS servicio_contrasena_snapshot,
  COALESCE(c.nombre, ns.categoria_nombre_snapshot) AS categoria_nombre_snapshot,
  COALESCE(sp.fecha_inicio, ns.fecha_inicio_snapshot) AS fecha_inicio_snapshot,
  COALESCE(sp.fecha_vencimiento, ns.fecha_vencimiento_snapshot) AS fecha_vencimiento_snapshot,
  ns.ciclo_pago_snapshot,
  ns.costo_servicio_snapshot,
  ns.moneda_snapshot,
  ns.metodo_pago_nombre_snapshot,
  COALESCE(mp.alias, ns.metodo_pago_alias_snapshot) AS metodo_pago_alias_snapshot,
  COALESCE(
    NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(mp.numero_tarjeta, ''), '\D', '', 'g'), 4), ''),
    ns.metodo_pago_tarjeta_terminacion_snapshot
  ) AS metodo_pago_tarjeta_terminacion_snapshot,
  ns.renovacion_automatica_snapshot
FROM public.notificaciones n
JOIN public.notificaciones_servicio ns ON ns.notificacion_id = n.id
LEFT JOIN public.servicios s            ON s.id = ns.servicio_id
LEFT JOIN public.v_servicios_full sf    ON sf.id = ns.servicio_id
LEFT JOIN public.servicio_periodos sp   ON sp.id = ns.servicio_periodo_id
LEFT JOIN public.categorias c           ON c.id = ns.categoria_id
LEFT JOIN public.metodos_pago mp        ON mp.id = sf.ultimo_metodo_pago_id
WHERE n.entidad = 'servicio';

GRANT SELECT ON public.v_notificaciones_servicio TO anon, authenticated, service_role;
