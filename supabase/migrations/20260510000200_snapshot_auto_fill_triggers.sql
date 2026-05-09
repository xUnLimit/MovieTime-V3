-- ============================================================================
-- 20260510000200_snapshot_auto_fill_triggers.sql
--
-- Triggers BEFORE INSERT que pueblan automaticamente los snapshots financieros
-- desde la FK viva cuando la aplicacion no los pasa. Aseguran integridad sin
-- depender de que el codigo cliente recuerde poblarlos.
--
-- Snapshots cubiertos:
--   * pagos_venta.metodo_pago_nombre_snapshot         <- metodos_pago.nombre
--   * pagos_servicio.metodo_pago_nombre_snapshot      <- metodos_pago.nombre
--   * venta_periodos.plan_nombre_snapshot             <- planes.nombre
--   * venta_periodos.plan_tipo_nombre_snapshot        <- planes_tipos.nombre
-- ============================================================================

-- ----------------------------------------------------------------------------
-- fill_metodo_pago_nombre_snapshot: comun a pagos_venta y pagos_servicio.
--
-- Comportamiento:
--   * INSERT: si la app no paso el snapshot, se llena desde metodos_pago.
--   * UPDATE de metodo_pago_id (correccion del metodo): se reescribe el
--     snapshot con el nombre del nuevo metodo, salvo que la app explicitamente
--     este pasando un valor distinto en NEW.metodo_pago_nombre_snapshot.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fill_metodo_pago_nombre_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT;
BEGIN
  IF NEW.metodo_pago_id IS NULL THEN
    -- Sin metodo_pago_id no podemos derivar nombre; respetamos lo que venga
    -- (puede ser '' tras la migracion de NOT NULL DEFAULT '').
    RETURN NEW;
  END IF;

  -- Caso 1: INSERT y la app no paso el snapshot -> derivarlo.
  IF TG_OP = 'INSERT'
     AND (NEW.metodo_pago_nombre_snapshot IS NULL OR NEW.metodo_pago_nombre_snapshot = '')
  THEN
    SELECT mp.nombre INTO v_nombre
    FROM public.metodos_pago mp
    WHERE mp.id = NEW.metodo_pago_id;
    NEW.metodo_pago_nombre_snapshot := COALESCE(v_nombre, '');
    RETURN NEW;
  END IF;

  -- Caso 2: UPDATE que cambia metodo_pago_id y la app no esta forzando un
  -- snapshot distinto -> sincronizar snapshot con el nuevo metodo.
  IF TG_OP = 'UPDATE'
     AND NEW.metodo_pago_id IS DISTINCT FROM OLD.metodo_pago_id
     AND NEW.metodo_pago_nombre_snapshot IS NOT DISTINCT FROM OLD.metodo_pago_nombre_snapshot
  THEN
    SELECT mp.nombre INTO v_nombre
    FROM public.metodos_pago mp
    WHERE mp.id = NEW.metodo_pago_id;
    NEW.metodo_pago_nombre_snapshot := COALESCE(v_nombre, '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_metodo_pago_nombre_pagos_venta ON public.pagos_venta;
CREATE TRIGGER trg_fill_metodo_pago_nombre_pagos_venta
  BEFORE INSERT OR UPDATE OF metodo_pago_id ON public.pagos_venta
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_metodo_pago_nombre_snapshot();

DROP TRIGGER IF EXISTS trg_fill_metodo_pago_nombre_pagos_servicio ON public.pagos_servicio;
CREATE TRIGGER trg_fill_metodo_pago_nombre_pagos_servicio
  BEFORE INSERT OR UPDATE OF metodo_pago_id ON public.pagos_servicio
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_metodo_pago_nombre_snapshot();

-- ----------------------------------------------------------------------------
-- fill_venta_periodo_plan_snapshots: para venta_periodos.
--
-- Comportamiento:
--   * INSERT: si la app no paso los snapshots, se derivan desde planes /
--     planes_tipos.
--   * UPDATE de plan_id (correccion del plan): se reescriben los snapshots
--     con los nombres del plan nuevo, salvo que la app este forzando valores
--     explicitos.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fill_venta_periodo_plan_snapshots()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_plan_nombre      TEXT;
  v_plan_tipo_nombre TEXT;
BEGIN
  IF NEW.plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Caso 1: INSERT con snapshots vacios -> derivar.
  IF TG_OP = 'INSERT'
     AND (
       NEW.plan_nombre_snapshot IS NULL OR NEW.plan_nombre_snapshot = ''
       OR NEW.plan_tipo_nombre_snapshot IS NULL OR NEW.plan_tipo_nombre_snapshot = ''
     )
  THEN
    SELECT p.nombre, pt.nombre
      INTO v_plan_nombre, v_plan_tipo_nombre
    FROM public.planes p
    JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id
    WHERE p.id = NEW.plan_id;

    IF NEW.plan_nombre_snapshot IS NULL OR NEW.plan_nombre_snapshot = '' THEN
      NEW.plan_nombre_snapshot := COALESCE(v_plan_nombre, '');
    END IF;
    IF NEW.plan_tipo_nombre_snapshot IS NULL OR NEW.plan_tipo_nombre_snapshot = '' THEN
      NEW.plan_tipo_nombre_snapshot := COALESCE(v_plan_tipo_nombre, '');
    END IF;
    RETURN NEW;
  END IF;

  -- Caso 2: UPDATE que cambia plan_id sin snapshot forzado -> sincronizar.
  IF TG_OP = 'UPDATE'
     AND NEW.plan_id IS DISTINCT FROM OLD.plan_id
     AND NEW.plan_nombre_snapshot IS NOT DISTINCT FROM OLD.plan_nombre_snapshot
     AND NEW.plan_tipo_nombre_snapshot IS NOT DISTINCT FROM OLD.plan_tipo_nombre_snapshot
  THEN
    SELECT p.nombre, pt.nombre
      INTO v_plan_nombre, v_plan_tipo_nombre
    FROM public.planes p
    JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id
    WHERE p.id = NEW.plan_id;
    NEW.plan_nombre_snapshot      := COALESCE(v_plan_nombre, '');
    NEW.plan_tipo_nombre_snapshot := COALESCE(v_plan_tipo_nombre, '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_venta_periodo_plan_snapshots ON public.venta_periodos;
CREATE TRIGGER trg_fill_venta_periodo_plan_snapshots
  BEFORE INSERT OR UPDATE OF plan_id ON public.venta_periodos
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_venta_periodo_plan_snapshots();
