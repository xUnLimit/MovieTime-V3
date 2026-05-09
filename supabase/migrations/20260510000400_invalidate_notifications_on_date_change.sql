-- ============================================================================
-- 20260510000400_invalidate_notifications_on_date_change.sql
--
-- Triggers que invalidan (borran) notificaciones obsoletas cuando se modifican
-- las fechas que las generaron. La proxima ejecucion del sync de notificaciones
-- regenerara la notificacion con la fecha nueva via el dedupe_key.
--
-- Casos cubiertos:
--   * UPDATE venta_periodos.fecha_fin / fecha_inicio
--       -> borra notificaciones_venta asociadas a ese venta_periodo_id
--   * UPDATE servicio_periodos.fecha_vencimiento / fecha_inicio
--       -> borra notificaciones_servicio asociadas a ese servicio_periodo_id
--   * UPDATE servicios.fecha_inicio_reposo / fecha_fin_reposo / en_reposo
--       -> borra notificaciones_reposo asociadas a ese servicio_id
--
-- ON DELETE CASCADE en notificaciones_venta/servicio/reposo limpia los detalles
-- automaticamente cuando se borra de notificaciones.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- venta_periodos: invalidar notificaciones de venta cuando cambian fechas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invalidate_notificaciones_venta_on_periodo_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
     OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin
  THEN
    DELETE FROM public.notificaciones n
    USING public.notificaciones_venta nv
    WHERE nv.notificacion_id = n.id
      AND nv.venta_periodo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_noti_venta_on_periodo_change ON public.venta_periodos;
CREATE TRIGGER trg_invalidate_noti_venta_on_periodo_change
  AFTER UPDATE OF fecha_inicio, fecha_fin ON public.venta_periodos
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_notificaciones_venta_on_periodo_change();

-- ----------------------------------------------------------------------------
-- servicio_periodos: invalidar notificaciones de servicio cuando cambian fechas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invalidate_notificaciones_servicio_on_periodo_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
     OR NEW.fecha_vencimiento IS DISTINCT FROM OLD.fecha_vencimiento
  THEN
    DELETE FROM public.notificaciones n
    USING public.notificaciones_servicio ns
    WHERE ns.notificacion_id = n.id
      AND ns.servicio_periodo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_noti_servicio_on_periodo_change ON public.servicio_periodos;
CREATE TRIGGER trg_invalidate_noti_servicio_on_periodo_change
  AFTER UPDATE OF fecha_inicio, fecha_vencimiento ON public.servicio_periodos
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_notificaciones_servicio_on_periodo_change();

-- ----------------------------------------------------------------------------
-- servicios: invalidar notificaciones de reposo cuando cambian fechas de
-- reposo o el flag en_reposo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invalidate_notificaciones_reposo_on_servicio_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.en_reposo IS DISTINCT FROM OLD.en_reposo
     OR NEW.fecha_inicio_reposo IS DISTINCT FROM OLD.fecha_inicio_reposo
     OR NEW.fecha_fin_reposo IS DISTINCT FROM OLD.fecha_fin_reposo
  THEN
    DELETE FROM public.notificaciones n
    USING public.notificaciones_reposo nr
    WHERE nr.notificacion_id = n.id
      AND nr.servicio_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_noti_reposo_on_servicio_change ON public.servicios;
CREATE TRIGGER trg_invalidate_noti_reposo_on_servicio_change
  AFTER UPDATE OF en_reposo, fecha_inicio_reposo, fecha_fin_reposo ON public.servicios
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_notificaciones_reposo_on_servicio_change();
