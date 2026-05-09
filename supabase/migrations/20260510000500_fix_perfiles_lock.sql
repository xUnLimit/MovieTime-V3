-- ============================================================================
-- 20260510000500_fix_perfiles_lock.sql
--
-- Corrige race condition en recalc_perfiles_ocupados: dos transacciones
-- concurrentes que crean ventas para el mismo servicio podian leer el mismo
-- conteo base y sobreescribirse mutuamente, dejando perfiles_ocupados erroneo.
--
-- Fix: SELECT FOR UPDATE bloquea la fila del servicio antes de recalcular,
-- serializando las actualizaciones del contador.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalc_perfiles_ocupados()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_servicio_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_servicio_ids := ARRAY[NEW.servicio_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_servicio_ids := ARRAY[OLD.servicio_id];
  ELSE
    IF NEW.servicio_id <> OLD.servicio_id THEN
      v_servicio_ids := ARRAY[NEW.servicio_id, OLD.servicio_id];
    ELSE
      v_servicio_ids := ARRAY[NEW.servicio_id];
    END IF;
  END IF;

  -- Bloquear las filas de servicio antes de recalcular para serializar
  -- actualizaciones concurrentes del contador perfiles_ocupados.
  PERFORM id
  FROM public.servicios
  WHERE id = ANY(v_servicio_ids)
  FOR UPDATE;

  UPDATE servicios s
  SET perfiles_ocupados = sub.real_count
  FROM (
    SELECT
      s2.id,
      COALESCE(COUNT(v.id), 0)::INTEGER AS real_count
    FROM servicios s2
    LEFT JOIN ventas v
      ON v.servicio_id = s2.id
      AND v.estado = 'activo'
      AND v.archivado_at IS NULL
      AND v.perfil_numero IS NOT NULL
    WHERE s2.id = ANY(v_servicio_ids)
    GROUP BY s2.id
  ) sub
  WHERE s.id = sub.id
    AND s.perfiles_ocupados IS DISTINCT FROM sub.real_count;

  RETURN NULL;
END;
$$;
