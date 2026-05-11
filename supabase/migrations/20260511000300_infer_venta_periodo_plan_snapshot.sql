-- ============================================================================
-- 20260511000300_infer_venta_periodo_plan_snapshot.sql
--
-- Database-side safety net for old clients or missed frontend fields:
-- when venta_periodos arrives without plan_id, infer it only if there is a
-- single exact plan match by venta categoria, servicio plan_tipo, ciclo and
-- precio_original. If there is no unique exact match, keep plan_id null and
-- preserve non-null snapshots as empty strings.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fill_venta_periodo_plan_snapshots()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_plan_id          TEXT;
  v_plan_nombre      TEXT;
  v_plan_tipo_nombre TEXT;
  v_match_count      INTEGER;
BEGIN
  IF NEW.plan_id IS NULL THEN
    SELECT COUNT(*)::INTEGER, MAX(p.id), MAX(p.nombre), MAX(pt.nombre)
      INTO v_match_count, v_plan_id, v_plan_nombre, v_plan_tipo_nombre
    FROM public.ventas v
    JOIN public.servicios s ON s.id = v.servicio_id
    JOIN public.planes p
      ON p.categoria_id = v.categoria_id
     AND p.plan_tipo_id = s.plan_tipo_id
     AND p.ciclo_pago = NEW.ciclo_pago
     AND ABS(p.precio - NEW.precio_original) < 0.01
    JOIN public.planes_tipos pt
      ON pt.id = p.plan_tipo_id
     AND pt.categoria_id = p.categoria_id
    WHERE v.id = NEW.venta_id
      AND s.plan_tipo_id IS NOT NULL;

    IF v_match_count = 1 THEN
      NEW.plan_id := v_plan_id;
      IF NEW.plan_nombre_snapshot IS NULL OR NEW.plan_nombre_snapshot = '' THEN
        NEW.plan_nombre_snapshot := COALESCE(v_plan_nombre, '');
      END IF;
      IF NEW.plan_tipo_nombre_snapshot IS NULL OR NEW.plan_tipo_nombre_snapshot = '' THEN
        NEW.plan_tipo_nombre_snapshot := COALESCE(v_plan_tipo_nombre, '');
      END IF;
      RETURN NEW;
    END IF;

    NEW.plan_nombre_snapshot := COALESCE(NEW.plan_nombre_snapshot, '');
    NEW.plan_tipo_nombre_snapshot := COALESCE(NEW.plan_tipo_nombre_snapshot, '');
    RETURN NEW;
  END IF;

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
  BEFORE INSERT OR UPDATE OF plan_id, ciclo_pago, precio_original, venta_id ON public.venta_periodos
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_venta_periodo_plan_snapshots();

WITH exact_matches AS (
  SELECT
    vp.id AS periodo_id,
    p.id AS plan_id,
    p.nombre AS plan_nombre,
    pt.nombre AS plan_tipo_nombre,
    COUNT(*) OVER (PARTITION BY vp.id) AS match_count
  FROM public.venta_periodos vp
  JOIN public.ventas v ON v.id = vp.venta_id
  JOIN public.servicios s ON s.id = v.servicio_id
  JOIN public.planes p
    ON p.categoria_id = v.categoria_id
   AND p.plan_tipo_id = s.plan_tipo_id
   AND p.ciclo_pago = vp.ciclo_pago
   AND ABS(p.precio - vp.precio_original) < 0.01
  JOIN public.planes_tipos pt
    ON pt.id = p.plan_tipo_id
   AND pt.categoria_id = p.categoria_id
  WHERE (vp.plan_id IS NULL
     OR NULLIF(vp.plan_nombre_snapshot, '') IS NULL
     OR NULLIF(vp.plan_tipo_nombre_snapshot, '') IS NULL)
    AND s.plan_tipo_id IS NOT NULL
)
UPDATE public.venta_periodos vp
   SET plan_id = exact.plan_id,
       plan_nombre_snapshot = exact.plan_nombre,
       plan_tipo_nombre_snapshot = exact.plan_tipo_nombre
FROM exact_matches exact
WHERE exact.periodo_id = vp.id
  AND exact.match_count = 1;
