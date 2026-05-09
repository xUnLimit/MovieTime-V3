-- ============================================================================
-- 20260510000300_backfill_and_enforce_snapshot_not_null.sql
--
-- 1) Backfill de snapshots financieros que pudieron quedar nulos en el pasado.
-- 2) NOT NULL en los snapshots financieros que se conservan.
--
-- Solo aplica a snapshots financieros / inmutables. Los demas snapshots
-- redundantes (cliente_nombre_snapshot, servicio_nombre_snapshot, etc.) se
-- mantienen como estan; las vistas ya leen de FK viva (migracion 100), por lo
-- que la UI no depende de ellos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Backfill: pagos_venta.metodo_pago_nombre_snapshot
-- ----------------------------------------------------------------------------
UPDATE public.pagos_venta pv
SET metodo_pago_nombre_snapshot = mp.nombre
FROM public.metodos_pago mp
WHERE mp.id = pv.metodo_pago_id
  AND (pv.metodo_pago_nombre_snapshot IS NULL OR pv.metodo_pago_nombre_snapshot = '');

-- Para filas donde metodo_pago_id es NULL y el snapshot tambien -> string vacio
-- (no podemos derivar un nombre, pero NOT NULL exige un valor).
UPDATE public.pagos_venta
SET metodo_pago_nombre_snapshot = ''
WHERE metodo_pago_nombre_snapshot IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Backfill: pagos_servicio.metodo_pago_nombre_snapshot
-- ----------------------------------------------------------------------------
UPDATE public.pagos_servicio ps
SET metodo_pago_nombre_snapshot = mp.nombre
FROM public.metodos_pago mp
WHERE mp.id = ps.metodo_pago_id
  AND (ps.metodo_pago_nombre_snapshot IS NULL OR ps.metodo_pago_nombre_snapshot = '');

UPDATE public.pagos_servicio
SET metodo_pago_nombre_snapshot = ''
WHERE metodo_pago_nombre_snapshot IS NULL;

-- ----------------------------------------------------------------------------
-- 3) Backfill: venta_periodos.plan_nombre_snapshot / plan_tipo_nombre_snapshot
-- ----------------------------------------------------------------------------
UPDATE public.venta_periodos vp
SET
  plan_nombre_snapshot      = COALESCE(NULLIF(vp.plan_nombre_snapshot, ''), p.nombre),
  plan_tipo_nombre_snapshot = COALESCE(NULLIF(vp.plan_tipo_nombre_snapshot, ''), pt.nombre)
FROM public.planes p
JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id
WHERE p.id = vp.plan_id
  AND (
    vp.plan_nombre_snapshot IS NULL OR vp.plan_nombre_snapshot = ''
    OR vp.plan_tipo_nombre_snapshot IS NULL OR vp.plan_tipo_nombre_snapshot = ''
  );

UPDATE public.venta_periodos
SET plan_nombre_snapshot = ''
WHERE plan_nombre_snapshot IS NULL;

UPDATE public.venta_periodos
SET plan_tipo_nombre_snapshot = ''
WHERE plan_tipo_nombre_snapshot IS NULL;

-- ----------------------------------------------------------------------------
-- 4) NOT NULL en snapshots financieros (despues del backfill).
-- ----------------------------------------------------------------------------
ALTER TABLE public.pagos_venta
  ALTER COLUMN metodo_pago_nombre_snapshot SET NOT NULL,
  ALTER COLUMN metodo_pago_nombre_snapshot SET DEFAULT '';

ALTER TABLE public.pagos_servicio
  ALTER COLUMN metodo_pago_nombre_snapshot SET NOT NULL,
  ALTER COLUMN metodo_pago_nombre_snapshot SET DEFAULT '';

ALTER TABLE public.venta_periodos
  ALTER COLUMN plan_nombre_snapshot SET NOT NULL,
  ALTER COLUMN plan_nombre_snapshot SET DEFAULT '';

ALTER TABLE public.venta_periodos
  ALTER COLUMN plan_tipo_nombre_snapshot SET NOT NULL,
  ALTER COLUMN plan_tipo_nombre_snapshot SET DEFAULT '';
