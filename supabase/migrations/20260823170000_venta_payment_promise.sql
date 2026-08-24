-- Payment promises are user-managed notification state for sale follow-up.
-- Keeping the date on the base row lets the existing authorized partial-update
-- path persist it atomically with the read flag while aggregate sync leaves it intact.

ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS fecha_prometida_pago DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notificaciones_fecha_prometida_pago_venta_check'
      AND conrelid = 'public.notificaciones'::regclass
  ) THEN
    ALTER TABLE public.notificaciones
      ADD CONSTRAINT notificaciones_fecha_prometida_pago_venta_check
      CHECK (fecha_prometida_pago IS NULL OR entidad = 'venta');
  END IF;
END
$$;

CREATE OR REPLACE VIEW public.v_notificaciones_venta
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
  nv.metodo_pago_nombre_snapshot,
  n.fecha_prometida_pago
FROM public.notificaciones AS n
JOIN public.notificaciones_venta AS nv ON nv.notificacion_id::text = n.id::text
LEFT JOIN public.ventas AS v          ON v.id::text = nv.venta_id::text
LEFT JOIN public.venta_periodos AS vp ON vp.id::text = nv.venta_periodo_id::text
LEFT JOIN public.terceros AS t        ON t.id::text = nv.cliente_id::text
LEFT JOIN public.servicios AS s       ON s.id::text = nv.servicio_id::text
LEFT JOIN public.categorias AS c      ON c.id::text = nv.categoria_id::text
WHERE n.entidad = 'venta';

GRANT SELECT ON public.v_notificaciones_venta TO authenticated, service_role;

REVOKE UPDATE ON TABLE public.notificaciones FROM authenticated;
GRANT UPDATE (leida, resaltada, read_at, dismissed_at, fecha_prometida_pago, updated_at)
  ON TABLE public.notificaciones TO authenticated;
