-- ============================================================================
-- Normalize operational TEXT ids to UUID-shaped values.
--
-- This is a safe phase-1 migration: columns remain TEXT to avoid breaking the
-- current views, RPCs and generated client code, but every operational primary
-- key is rewritten to a UUID string and all FK columns are updated from a
-- persistent old_id -> new_uuid map.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.uuid_id_map (
  entity_name TEXT NOT NULL,
  old_id TEXT NOT NULL,
  new_id UUID NOT NULL DEFAULT gen_random_uuid(),
  was_uuid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_name, old_id),
  UNIQUE (entity_name, new_id)
);

ALTER TABLE public.uuid_id_map ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.uuid_id_map TO authenticated;
GRANT SELECT ON public.uuid_id_map TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'uuid_id_map'
      AND policyname = 'uuid_id_map_select_authenticated'
  ) THEN
    CREATE POLICY uuid_id_map_select_authenticated
      ON public.uuid_id_map
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS entidad_legacy_id TEXT;

UPDATE public.activity_log
SET entidad_legacy_id = entidad_id
WHERE entidad_legacy_id IS NULL;

LOCK TABLE
  public.activity_log,
  public.categorias,
  public.gastos,
  public.legacy_orphan_records,
  public.metodos_pago,
  public.notificaciones,
  public.notificaciones_reposo,
  public.notificaciones_servicio,
  public.notificaciones_venta,
  public.pagos_servicio,
  public.pagos_venta,
  public.planes,
  public.planes_tipos,
  public.servicio_periodos,
  public.servicios,
  public.template_placeholders,
  public.templates,
  public.tipos_gasto,
  public.usuarios,
  public.venta_periodos,
  public.ventas
IN ACCESS EXCLUSIVE MODE;

-- Build or extend the persistent mapping. Existing UUID values keep their UUID.
DO $$
DECLARE
  r RECORD;
  uuid_pattern CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('activity_log'),
      ('categorias'),
      ('gastos'),
      ('legacy_orphan_records'),
      ('metodos_pago'),
      ('notificaciones'),
      ('pagos_servicio'),
      ('pagos_venta'),
      ('planes'),
      ('planes_tipos'),
      ('servicio_periodos'),
      ('servicios'),
      ('template_placeholders'),
      ('templates'),
      ('tipos_gasto'),
      ('usuarios'),
      ('venta_periodos'),
      ('ventas')
    ) AS tables(table_name)
  LOOP
    EXECUTE format(
      'INSERT INTO public.uuid_id_map (entity_name, old_id, new_id, was_uuid)
       SELECT %1$L, id, CASE WHEN id ~* %2$L THEN id::uuid ELSE gen_random_uuid() END, id ~* %2$L
       FROM public.%3$I
       WHERE id IS NOT NULL
       ON CONFLICT DO NOTHING',
      r.table_name,
      uuid_pattern,
      r.table_name
    );
  END LOOP;
END $$;

CREATE TEMP TABLE _uuid_migration_fk_constraints ON COMMIT DROP AS
SELECT
  con.conrelid::regclass::text AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_def
FROM pg_constraint con
WHERE con.contype = 'f'
  AND con.confrelid = ANY (ARRAY[
    'public.categorias'::regclass,
    'public.gastos'::regclass,
    'public.legacy_orphan_records'::regclass,
    'public.metodos_pago'::regclass,
    'public.notificaciones'::regclass,
    'public.pagos_servicio'::regclass,
    'public.pagos_venta'::regclass,
    'public.planes'::regclass,
    'public.planes_tipos'::regclass,
    'public.servicio_periodos'::regclass,
    'public.servicios'::regclass,
    'public.template_placeholders'::regclass,
    'public.templates'::regclass,
    'public.tipos_gasto'::regclass,
    'public.usuarios'::regclass,
    'public.venta_periodos'::regclass,
    'public.ventas'::regclass
  ])
ORDER BY con.conrelid::regclass::text, con.conname;

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN SELECT * FROM _uuid_migration_fk_constraints LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      fk.table_name,
      fk.constraint_name
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('activity_log'),
      ('categorias'),
      ('gastos'),
      ('metodos_pago'),
      ('notificaciones'),
      ('pagos_servicio'),
      ('pagos_venta'),
      ('planes'),
      ('planes_tipos'),
      ('servicio_periodos'),
      ('servicios'),
      ('template_placeholders'),
      ('templates'),
      ('tipos_gasto'),
      ('usuarios'),
      ('venta_periodos'),
      ('ventas')
    ) AS tables(table_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', r.table_name);
  END LOOP;
END $$;

-- Update FK columns first while FK constraints are temporarily absent.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('gastos', 'tipo_gasto_id', 'tipos_gasto'),
      ('notificaciones_reposo', 'categoria_id', 'categorias'),
      ('notificaciones_reposo', 'servicio_id', 'servicios'),
      ('notificaciones_servicio', 'categoria_id', 'categorias'),
      ('notificaciones_servicio', 'notificacion_id', 'notificaciones'),
      ('notificaciones_servicio', 'servicio_id', 'servicios'),
      ('notificaciones_servicio', 'servicio_periodo_id', 'servicio_periodos'),
      ('notificaciones_venta', 'categoria_id', 'categorias'),
      ('notificaciones_venta', 'cliente_id', 'usuarios'),
      ('notificaciones_venta', 'metodo_pago_id', 'metodos_pago'),
      ('notificaciones_venta', 'notificacion_id', 'notificaciones'),
      ('notificaciones_venta', 'servicio_id', 'servicios'),
      ('notificaciones_venta', 'venta_id', 'ventas'),
      ('notificaciones_venta', 'venta_periodo_id', 'venta_periodos'),
      ('pagos_servicio', 'categoria_id_snapshot', 'categorias'),
      ('pagos_servicio', 'metodo_pago_id', 'metodos_pago'),
      ('pagos_servicio', 'servicio_id', 'servicios'),
      ('pagos_servicio', 'servicio_periodo_id', 'servicio_periodos'),
      ('pagos_venta', 'metodo_pago_id', 'metodos_pago'),
      ('pagos_venta', 'venta_id', 'ventas'),
      ('pagos_venta', 'venta_periodo_id', 'venta_periodos'),
      ('planes', 'categoria_id', 'categorias'),
      ('planes', 'plan_tipo_id', 'planes_tipos'),
      ('planes_tipos', 'categoria_id', 'categorias'),
      ('servicio_periodos', 'servicio_id', 'servicios'),
      ('servicios', 'categoria_id', 'categorias'),
      ('servicios', 'plan_tipo_id', 'planes_tipos'),
      ('template_placeholders', 'template_id', 'templates'),
      ('usuarios', 'metodo_pago_id', 'metodos_pago'),
      ('venta_periodos', 'plan_id', 'planes'),
      ('venta_periodos', 'venta_id', 'ventas'),
      ('ventas', 'categoria_id', 'categorias'),
      ('ventas', 'cliente_id', 'usuarios'),
      ('ventas', 'servicio_id', 'servicios')
    ) AS updates(table_name, column_name, entity_name)
  LOOP
    -- Some snapshot columns were introduced by later migrations. Keeping the
    -- list complete is useful for upgraded databases, while this guard makes
    -- the historical chain reproducible from an empty database as well.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = r.table_name
        AND column_name = r.column_name
    ) THEN
      EXECUTE format(
        'UPDATE public.%1$I t
         SET %2$I = m.new_id::text
         FROM public.uuid_id_map m
         WHERE m.entity_name = %3$L
           AND t.%2$I IS NOT NULL
           AND t.%2$I = m.old_id
           AND t.%2$I <> m.new_id::text',
        r.table_name,
        r.column_name,
        r.entity_name
      );
    END IF;
  END LOOP;
END $$;

UPDATE public.activity_log al
SET entidad_id = m.new_id::text
FROM public.uuid_id_map m
WHERE m.entity_name = CASE al.entidad::text
    WHEN 'cliente' THEN 'usuarios'
    WHEN 'revendedor' THEN 'usuarios'
    WHEN 'usuario' THEN 'usuarios'
    WHEN 'servicio' THEN 'servicios'
    WHEN 'categoria' THEN 'categorias'
    WHEN 'metodo_pago' THEN 'metodos_pago'
    WHEN 'gasto' THEN 'gastos'
    WHEN 'venta' THEN 'ventas'
    WHEN 'template' THEN 'templates'
    ELSE NULL
  END
  AND al.entidad_id = m.old_id
  AND al.entidad_id <> m.new_id::text;

UPDATE public.notificaciones n
SET dedupe_key = n.entidad::text || ':' || m.new_id::text
FROM public.uuid_id_map m
WHERE n.entidad::text IN ('venta', 'servicio', 'reposo')
  AND m.entity_name = CASE
    WHEN n.entidad::text = 'venta' THEN 'ventas'
    ELSE 'servicios'
  END
  AND n.dedupe_key = n.entidad::text || ':' || m.old_id
  AND n.dedupe_key <> n.entidad::text || ':' || m.new_id::text;

-- Update primary keys after all dependent columns are already rewritten.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('activity_log'),
      ('categorias'),
      ('gastos'),
      ('legacy_orphan_records'),
      ('metodos_pago'),
      ('notificaciones'),
      ('pagos_servicio'),
      ('pagos_venta'),
      ('planes'),
      ('planes_tipos'),
      ('servicio_periodos'),
      ('servicios'),
      ('template_placeholders'),
      ('templates'),
      ('tipos_gasto'),
      ('usuarios'),
      ('venta_periodos'),
      ('ventas')
    ) AS tables(table_name)
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I t
       SET id = m.new_id::text
       FROM public.uuid_id_map m
       WHERE m.entity_name = %2$L
         AND t.id = m.old_id
         AND t.id <> m.new_id::text',
      r.table_name,
      r.table_name
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('activity_log'),
      ('categorias'),
      ('gastos'),
      ('metodos_pago'),
      ('notificaciones'),
      ('pagos_servicio'),
      ('pagos_venta'),
      ('planes'),
      ('planes_tipos'),
      ('servicio_periodos'),
      ('servicios'),
      ('template_placeholders'),
      ('templates'),
      ('tipos_gasto'),
      ('usuarios'),
      ('venta_periodos'),
      ('ventas')
    ) AS tables(table_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', r.table_name);
  END LOOP;
END $$;

-- Enforce UUID-shaped ids for operational primary keys going forward.
DO $$
DECLARE
  r RECORD;
  constraint_name TEXT;
  uuid_pattern CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('activity_log'),
      ('categorias'),
      ('gastos'),
      ('legacy_orphan_records'),
      ('metodos_pago'),
      ('notificaciones'),
      ('pagos_servicio'),
      ('pagos_venta'),
      ('planes'),
      ('planes_tipos'),
      ('servicio_periodos'),
      ('servicios'),
      ('template_placeholders'),
      ('templates'),
      ('tipos_gasto'),
      ('usuarios'),
      ('venta_periodos'),
      ('ventas')
    ) AS tables(table_name)
  LOOP
    constraint_name := r.table_name || '_id_uuid_format_chk';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = constraint_name
        AND conrelid = format('public.%I', r.table_name)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%1$I ADD CONSTRAINT %2$I CHECK (id ~* %3$L) NOT VALID',
        r.table_name,
        constraint_name,
        uuid_pattern
      );
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%1$I VALIDATE CONSTRAINT %2$I',
      r.table_name,
      constraint_name
    );
  END LOOP;
END $$;

-- Recreate dropped FK constraints and let PostgreSQL validate referential
-- integrity immediately.
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN SELECT * FROM _uuid_migration_fk_constraints LOOP
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I %s',
      fk.table_name,
      fk.constraint_name,
      fk.constraint_def
    );
  END LOOP;
END $$;

-- Fail the migration if any operational id stayed legacy.
DO $$
DECLARE
  invalid_count BIGINT;
  uuid_pattern CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT id FROM public.activity_log WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.categorias WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.gastos WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.legacy_orphan_records WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.metodos_pago WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.notificaciones WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.pagos_servicio WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.pagos_venta WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.planes WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.planes_tipos WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.servicio_periodos WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.servicios WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.template_placeholders WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.templates WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.tipos_gasto WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.usuarios WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.venta_periodos WHERE id !~* uuid_pattern
    UNION ALL SELECT id FROM public.ventas WHERE id !~* uuid_pattern
  ) invalid_ids;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'uuid id migration left % non-uuid operational ids', invalid_count;
  END IF;
END $$;

DO $$
DECLARE
  validations JSONB;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rebuild_dashboard_financial_stats'
  ) THEN
    PERFORM public.rebuild_dashboard_financial_stats();
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'run_all_validations'
  ) THEN
    SELECT public.run_all_validations() INTO validations;

    IF EXISTS (
      SELECT 1
      FROM jsonb_each_text(validations) AS item(key, value)
      WHERE item.value::int <> 0
    ) THEN
      RAISE EXCEPTION 'post uuid id migration validations failed: %', validations;
    END IF;
  END IF;
END $$;

COMMIT;
