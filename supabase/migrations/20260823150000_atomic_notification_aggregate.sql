-- Keep the polymorphic notification aggregate complete under failures and concurrency.

BEGIN;

-- This column exists in the linked schema and is used by the client, but was
-- missing from the generated contract. Make the migration safe for clean schemas.
ALTER TABLE public.notificaciones_venta
  ADD COLUMN IF NOT EXISTS metodo_pago_id TEXT
  REFERENCES public.metodos_pago(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notificaciones_venta_metodo_pago_id
  ON public.notificaciones_venta (metodo_pago_id);

-- Repair base rows whose second, non-transactional write failed. Preserve the
-- base ID and user state while rebuilding current snapshots from live sources.
INSERT INTO public.notificaciones_venta (
  notificacion_id,
  venta_id,
  venta_periodo_id,
  cliente_id,
  servicio_id,
  categoria_id,
  cliente_nombre_snapshot,
  cliente_telefono_snapshot,
  servicio_nombre_snapshot,
  servicio_correo_snapshot,
  servicio_contrasena_snapshot,
  categoria_nombre_snapshot,
  perfil_nombre_snapshot,
  codigo_snapshot,
  fecha_inicio_snapshot,
  fecha_fin_snapshot,
  ciclo_pago_snapshot,
  precio_final_snapshot,
  moneda_snapshot,
  metodo_pago_nombre_snapshot,
  metodo_pago_id
)
SELECT
  n.id,
  v.id,
  v.ultimo_periodo_id,
  v.cliente_id,
  v.servicio_id,
  v.categoria_id,
  COALESCE(v.cliente_nombre, ''),
  v.cliente_telefono,
  COALESCE(v.servicio_nombre, ''),
  v.servicio_correo,
  s.contrasena,
  v.categoria_nombre,
  v.perfil_nombre,
  v.codigo,
  v.ultima_fecha_inicio,
  v.ultima_fecha_fin,
  v.ultimo_ciclo_pago,
  v.ultimo_total_original,
  v.ultima_moneda,
  v.ultimo_metodo_pago_nombre,
  v.ultimo_metodo_pago_id
FROM public.notificaciones AS n
JOIN public.v_ventas_full AS v
  ON n.dedupe_key = 'venta:' || v.id
LEFT JOIN public.servicios AS s ON s.id = v.servicio_id
WHERE n.entidad = 'venta'
  AND NOT EXISTS (
    SELECT 1
    FROM public.notificaciones_venta AS nv
    WHERE nv.notificacion_id = n.id
  )
ON CONFLICT (notificacion_id) DO NOTHING;

INSERT INTO public.notificaciones_servicio (
  notificacion_id,
  servicio_id,
  servicio_periodo_id,
  categoria_id,
  servicio_nombre_snapshot,
  servicio_correo_snapshot,
  servicio_contrasena_snapshot,
  categoria_nombre_snapshot,
  fecha_inicio_snapshot,
  fecha_vencimiento_snapshot,
  ciclo_pago_snapshot,
  costo_servicio_snapshot,
  moneda_snapshot,
  metodo_pago_nombre_snapshot,
  metodo_pago_alias_snapshot,
  metodo_pago_tarjeta_terminacion_snapshot,
  renovacion_automatica_snapshot
)
SELECT
  n.id,
  s.id,
  s.ultimo_periodo_id,
  s.categoria_id,
  COALESCE(s.nombre, ''),
  s.correo,
  s.contrasena,
  s.categoria_nombre,
  s.ultima_fecha_inicio,
  s.ultima_fecha_vencimiento,
  s.ultimo_ciclo_pago,
  s.ultimo_costo_original,
  s.ultima_moneda,
  s.ultimo_metodo_pago_nombre,
  mp.alias,
  NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(mp.numero_tarjeta, ''), '\D', '', 'g'), 4), ''),
  s.ultima_renovacion_automatica
FROM public.notificaciones AS n
JOIN public.v_servicios_full AS s
  ON n.dedupe_key = 'servicio:' || s.id
LEFT JOIN public.metodos_pago AS mp ON mp.id = s.ultimo_metodo_pago_id
WHERE n.entidad = 'servicio'
  AND NOT EXISTS (
    SELECT 1
    FROM public.notificaciones_servicio AS ns
    WHERE ns.notificacion_id = n.id
  )
ON CONFLICT (notificacion_id) DO NOTHING;

INSERT INTO public.notificaciones_reposo (
  notificacion_id,
  servicio_id,
  categoria_id,
  servicio_nombre_snapshot,
  servicio_correo_snapshot,
  servicio_contrasena_snapshot,
  categoria_nombre_snapshot,
  dias_reposo_snapshot,
  fecha_inicio_reposo_snapshot,
  fecha_fin_reposo_snapshot
)
SELECT
  n.id,
  s.id,
  s.categoria_id,
  COALESCE(s.nombre, ''),
  s.correo,
  s.contrasena,
  c.nombre,
  s.dias_reposo,
  s.fecha_inicio_reposo,
  s.fecha_fin_reposo
FROM public.notificaciones AS n
JOIN public.servicios AS s
  ON n.dedupe_key = 'reposo:' || s.id
LEFT JOIN public.categorias AS c ON c.id = s.categoria_id
WHERE n.entidad = 'reposo'
  AND NOT EXISTS (
    SELECT 1
    FROM public.notificaciones_reposo AS nr
    WHERE nr.notificacion_id = n.id
  )
ON CONFLICT (notificacion_id) DO NOTHING;

-- A base without a surviving source cannot produce a valid notification.
DELETE FROM public.notificaciones AS n
WHERE (n.entidad = 'venta' AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones_venta AS nv WHERE nv.notificacion_id = n.id
  ))
   OR (n.entidad = 'servicio' AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones_servicio AS ns WHERE ns.notificacion_id = n.id
  ))
   OR (n.entidad = 'reposo' AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones_reposo AS nr WHERE nr.notificacion_id = n.id
  ));

DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_invalid_count
  FROM public.notificaciones AS n
  WHERE (n.entidad = 'venta' AND (
      (SELECT COUNT(*) FROM public.notificaciones_venta AS nv WHERE nv.notificacion_id = n.id) <> 1
      OR NOT EXISTS (
        SELECT 1 FROM public.notificaciones_venta AS nv
        WHERE nv.notificacion_id = n.id AND n.dedupe_key = 'venta:' || nv.venta_id
      )
      OR EXISTS (SELECT 1 FROM public.notificaciones_servicio AS ns WHERE ns.notificacion_id = n.id)
      OR EXISTS (SELECT 1 FROM public.notificaciones_reposo AS nr WHERE nr.notificacion_id = n.id)
    ))
    OR (n.entidad = 'servicio' AND (
      EXISTS (SELECT 1 FROM public.notificaciones_venta AS nv WHERE nv.notificacion_id = n.id)
      OR (SELECT COUNT(*) FROM public.notificaciones_servicio AS ns WHERE ns.notificacion_id = n.id) <> 1
      OR NOT EXISTS (
        SELECT 1 FROM public.notificaciones_servicio AS ns
        WHERE ns.notificacion_id = n.id AND n.dedupe_key = 'servicio:' || ns.servicio_id
      )
      OR EXISTS (SELECT 1 FROM public.notificaciones_reposo AS nr WHERE nr.notificacion_id = n.id)
    ))
    OR (n.entidad = 'reposo' AND (
      EXISTS (SELECT 1 FROM public.notificaciones_venta AS nv WHERE nv.notificacion_id = n.id)
      OR EXISTS (SELECT 1 FROM public.notificaciones_servicio AS ns WHERE ns.notificacion_id = n.id)
      OR (SELECT COUNT(*) FROM public.notificaciones_reposo AS nr WHERE nr.notificacion_id = n.id) <> 1
      OR NOT EXISTS (
        SELECT 1 FROM public.notificaciones_reposo AS nr
        WHERE nr.notificacion_id = n.id AND n.dedupe_key = 'reposo:' || nr.servicio_id
      )
    ));

  IF v_invalid_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Notification integrity repair failed',
      DETAIL = format('%s invalid notification aggregates remain', v_invalid_count);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_notification_integrity(p_notification_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_entidad public.notificacion_entidad_enum;
  v_dedupe_key TEXT;
  v_venta_count INTEGER;
  v_servicio_count INTEGER;
  v_reposo_count INTEGER;
  v_venta_id TEXT;
  v_servicio_id TEXT;
  v_reposo_servicio_id TEXT;
BEGIN
  SELECT n.entidad, n.dedupe_key
  INTO v_entidad, v_dedupe_key
  FROM public.notificaciones AS n
  WHERE n.id = p_notification_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*), MAX(nv.venta_id)
  INTO v_venta_count, v_venta_id
  FROM public.notificaciones_venta AS nv
  WHERE nv.notificacion_id = p_notification_id;

  SELECT COUNT(*), MAX(ns.servicio_id)
  INTO v_servicio_count, v_servicio_id
  FROM public.notificaciones_servicio AS ns
  WHERE ns.notificacion_id = p_notification_id;

  SELECT COUNT(*), MAX(nr.servicio_id)
  INTO v_reposo_count, v_reposo_servicio_id
  FROM public.notificaciones_reposo AS nr
  WHERE nr.notificacion_id = p_notification_id;

  IF (v_entidad = 'venta' AND (
        v_venta_count <> 1 OR v_servicio_count <> 0 OR v_reposo_count <> 0
        OR v_dedupe_key IS DISTINCT FROM 'venta:' || v_venta_id
      ))
     OR (v_entidad = 'servicio' AND (
        v_venta_count <> 0 OR v_servicio_count <> 1 OR v_reposo_count <> 0
        OR v_dedupe_key IS DISTINCT FROM 'servicio:' || v_servicio_id
      ))
     OR (v_entidad = 'reposo' AND (
        v_venta_count <> 0 OR v_servicio_count <> 0 OR v_reposo_count <> 1
        OR v_dedupe_key IS DISTINCT FROM 'reposo:' || v_reposo_servicio_id
      ))
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('Notification %s has an incomplete or mismatched detail', p_notification_id),
      DETAIL = format(
        'entidad=%s venta=%s servicio=%s reposo=%s',
        v_entidad, v_venta_count, v_servicio_count, v_reposo_count
      ),
      HINT = 'Use public.upsert_notification_aggregate for aggregate writes';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_notification_integrity(TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_notification_integrity_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_notification_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'notificaciones' THEN
    v_notification_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    IF TG_OP = 'UPDATE'
       AND OLD.notificacion_id IS DISTINCT FROM NEW.notificacion_id THEN
      PERFORM public.assert_notification_integrity(OLD.notificacion_id);
    END IF;
    v_notification_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.notificacion_id
      ELSE NEW.notificacion_id
    END;
  END IF;

  PERFORM public.assert_notification_integrity(v_notification_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_notification_integrity_trigger()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notification_base_integrity ON public.notificaciones;
CREATE CONSTRAINT TRIGGER trg_notification_base_integrity
AFTER INSERT OR UPDATE ON public.notificaciones
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notification_integrity_trigger();

DROP TRIGGER IF EXISTS trg_notification_venta_integrity ON public.notificaciones_venta;
CREATE CONSTRAINT TRIGGER trg_notification_venta_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.notificaciones_venta
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notification_integrity_trigger();

DROP TRIGGER IF EXISTS trg_notification_servicio_integrity ON public.notificaciones_servicio;
CREATE CONSTRAINT TRIGGER trg_notification_servicio_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.notificaciones_servicio
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notification_integrity_trigger();

DROP TRIGGER IF EXISTS trg_notification_reposo_integrity ON public.notificaciones_reposo;
CREATE CONSTRAINT TRIGGER trg_notification_reposo_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.notificaciones_reposo
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notification_integrity_trigger();

CREATE OR REPLACE FUNCTION public.upsert_notification_aggregate(
  p_base JSONB,
  p_detail JSONB,
  p_preserve_existing_state BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_entidad public.notificacion_entidad_enum;
  v_dedupe_key TEXT;
  v_entity_id TEXT;
  v_requested_id TEXT;
  v_notification_id TEXT;
  v_role TEXT;
BEGIN
  v_role := auth.role();
  IF COALESCE(v_role, '') NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  IF jsonb_typeof(p_base) <> 'object' OR jsonb_typeof(p_detail) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Notification base and detail must be JSON objects';
  END IF;

  BEGIN
    v_entidad := (p_base ->> 'entidad')::public.notificacion_entidad_enum;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unsupported notification entity';
  END;

  v_dedupe_key := NULLIF(p_base ->> 'dedupe_key', '');
  v_requested_id := COALESCE(NULLIF(p_base ->> 'id', ''), gen_random_uuid()::TEXT);
  v_entity_id := CASE v_entidad
    WHEN 'venta' THEN NULLIF(p_detail ->> 'venta_id', '')
    WHEN 'servicio' THEN NULLIF(p_detail ->> 'servicio_id', '')
    WHEN 'reposo' THEN NULLIF(p_detail ->> 'servicio_id', '')
  END;

  IF v_entity_id IS NULL OR v_dedupe_key IS DISTINCT FROM v_entidad::TEXT || ':' || v_entity_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Notification dedupe key does not match its detail entity';
  END IF;

  INSERT INTO public.notificaciones AS current_n (
    id,
    dedupe_key,
    entidad,
    tipo,
    prioridad,
    titulo,
    mensaje,
    dias_restantes,
    scheduled_for,
    leida,
    resaltada,
    updated_at
  ) VALUES (
    v_requested_id,
    v_dedupe_key,
    v_entidad,
    COALESCE(NULLIF(p_base ->> 'tipo', ''), 'sistema'),
    COALESCE(NULLIF(p_base ->> 'prioridad', ''), 'media')::public.notificacion_prioridad_enum,
    COALESCE(p_base ->> 'titulo', ''),
    p_base ->> 'mensaje',
    NULLIF(p_base ->> 'dias_restantes', '')::INTEGER,
    NULLIF(p_base ->> 'scheduled_for', '')::DATE,
    COALESCE((p_base ->> 'leida')::BOOLEAN, false),
    COALESCE((p_base ->> 'resaltada')::BOOLEAN, false),
    now()
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    entidad = EXCLUDED.entidad,
    tipo = EXCLUDED.tipo,
    prioridad = EXCLUDED.prioridad,
    titulo = EXCLUDED.titulo,
    mensaje = EXCLUDED.mensaje,
    dias_restantes = EXCLUDED.dias_restantes,
    scheduled_for = EXCLUDED.scheduled_for,
    leida = CASE
      WHEN p_preserve_existing_state THEN current_n.leida
      ELSE EXCLUDED.leida
    END,
    resaltada = CASE
      WHEN p_preserve_existing_state THEN current_n.resaltada
      ELSE EXCLUDED.resaltada
    END,
    updated_at = now()
  RETURNING id INTO v_notification_id;

  DELETE FROM public.notificaciones_venta
  WHERE notificacion_id = v_notification_id AND v_entidad <> 'venta';
  DELETE FROM public.notificaciones_servicio
  WHERE notificacion_id = v_notification_id AND v_entidad <> 'servicio';
  DELETE FROM public.notificaciones_reposo
  WHERE notificacion_id = v_notification_id AND v_entidad <> 'reposo';

  IF v_entidad = 'venta' THEN
    INSERT INTO public.notificaciones_venta (
      notificacion_id, venta_id, venta_periodo_id, cliente_id, servicio_id,
      categoria_id, cliente_nombre_snapshot, cliente_telefono_snapshot,
      servicio_nombre_snapshot, servicio_correo_snapshot,
      servicio_contrasena_snapshot, categoria_nombre_snapshot,
      perfil_nombre_snapshot, codigo_snapshot, fecha_inicio_snapshot,
      fecha_fin_snapshot, ciclo_pago_snapshot, precio_final_snapshot,
      moneda_snapshot, metodo_pago_nombre_snapshot, metodo_pago_id
    ) VALUES (
      v_notification_id,
      v_entity_id,
      NULLIF(p_detail ->> 'venta_periodo_id', ''),
      NULLIF(p_detail ->> 'cliente_id', ''),
      NULLIF(p_detail ->> 'servicio_id', ''),
      NULLIF(p_detail ->> 'categoria_id', ''),
      COALESCE(p_detail ->> 'cliente_nombre_snapshot', ''),
      p_detail ->> 'cliente_telefono_snapshot',
      COALESCE(p_detail ->> 'servicio_nombre_snapshot', ''),
      p_detail ->> 'servicio_correo_snapshot',
      p_detail ->> 'servicio_contrasena_snapshot',
      p_detail ->> 'categoria_nombre_snapshot',
      p_detail ->> 'perfil_nombre_snapshot',
      p_detail ->> 'codigo_snapshot',
      NULLIF(p_detail ->> 'fecha_inicio_snapshot', '')::DATE,
      NULLIF(p_detail ->> 'fecha_fin_snapshot', '')::DATE,
      NULLIF(p_detail ->> 'ciclo_pago_snapshot', '')::public.ciclo_pago_enum,
      NULLIF(p_detail ->> 'precio_final_snapshot', '')::NUMERIC,
      p_detail ->> 'moneda_snapshot',
      p_detail ->> 'metodo_pago_nombre_snapshot',
      NULLIF(p_detail ->> 'metodo_pago_id', '')
    )
    ON CONFLICT (notificacion_id) DO UPDATE SET
      venta_id = EXCLUDED.venta_id,
      venta_periodo_id = EXCLUDED.venta_periodo_id,
      cliente_id = EXCLUDED.cliente_id,
      servicio_id = EXCLUDED.servicio_id,
      categoria_id = EXCLUDED.categoria_id,
      cliente_nombre_snapshot = EXCLUDED.cliente_nombre_snapshot,
      cliente_telefono_snapshot = EXCLUDED.cliente_telefono_snapshot,
      servicio_nombre_snapshot = EXCLUDED.servicio_nombre_snapshot,
      servicio_correo_snapshot = EXCLUDED.servicio_correo_snapshot,
      servicio_contrasena_snapshot = EXCLUDED.servicio_contrasena_snapshot,
      categoria_nombre_snapshot = EXCLUDED.categoria_nombre_snapshot,
      perfil_nombre_snapshot = EXCLUDED.perfil_nombre_snapshot,
      codigo_snapshot = EXCLUDED.codigo_snapshot,
      fecha_inicio_snapshot = EXCLUDED.fecha_inicio_snapshot,
      fecha_fin_snapshot = EXCLUDED.fecha_fin_snapshot,
      ciclo_pago_snapshot = EXCLUDED.ciclo_pago_snapshot,
      precio_final_snapshot = EXCLUDED.precio_final_snapshot,
      moneda_snapshot = EXCLUDED.moneda_snapshot,
      metodo_pago_nombre_snapshot = EXCLUDED.metodo_pago_nombre_snapshot,
      metodo_pago_id = EXCLUDED.metodo_pago_id;
  ELSIF v_entidad = 'servicio' THEN
    INSERT INTO public.notificaciones_servicio (
      notificacion_id, servicio_id, servicio_periodo_id, categoria_id,
      servicio_nombre_snapshot, servicio_correo_snapshot,
      servicio_contrasena_snapshot, categoria_nombre_snapshot,
      fecha_inicio_snapshot, fecha_vencimiento_snapshot, ciclo_pago_snapshot,
      costo_servicio_snapshot, moneda_snapshot, metodo_pago_nombre_snapshot,
      metodo_pago_alias_snapshot, metodo_pago_tarjeta_terminacion_snapshot,
      renovacion_automatica_snapshot
    ) VALUES (
      v_notification_id,
      v_entity_id,
      NULLIF(p_detail ->> 'servicio_periodo_id', ''),
      NULLIF(p_detail ->> 'categoria_id', ''),
      COALESCE(p_detail ->> 'servicio_nombre_snapshot', ''),
      p_detail ->> 'servicio_correo_snapshot',
      p_detail ->> 'servicio_contrasena_snapshot',
      p_detail ->> 'categoria_nombre_snapshot',
      NULLIF(p_detail ->> 'fecha_inicio_snapshot', '')::DATE,
      NULLIF(p_detail ->> 'fecha_vencimiento_snapshot', '')::DATE,
      NULLIF(p_detail ->> 'ciclo_pago_snapshot', '')::public.ciclo_pago_enum,
      NULLIF(p_detail ->> 'costo_servicio_snapshot', '')::NUMERIC,
      p_detail ->> 'moneda_snapshot',
      p_detail ->> 'metodo_pago_nombre_snapshot',
      p_detail ->> 'metodo_pago_alias_snapshot',
      p_detail ->> 'metodo_pago_tarjeta_terminacion_snapshot',
      NULLIF(p_detail ->> 'renovacion_automatica_snapshot', '')::BOOLEAN
    )
    ON CONFLICT (notificacion_id) DO UPDATE SET
      servicio_id = EXCLUDED.servicio_id,
      servicio_periodo_id = EXCLUDED.servicio_periodo_id,
      categoria_id = EXCLUDED.categoria_id,
      servicio_nombre_snapshot = EXCLUDED.servicio_nombre_snapshot,
      servicio_correo_snapshot = EXCLUDED.servicio_correo_snapshot,
      servicio_contrasena_snapshot = EXCLUDED.servicio_contrasena_snapshot,
      categoria_nombre_snapshot = EXCLUDED.categoria_nombre_snapshot,
      fecha_inicio_snapshot = EXCLUDED.fecha_inicio_snapshot,
      fecha_vencimiento_snapshot = EXCLUDED.fecha_vencimiento_snapshot,
      ciclo_pago_snapshot = EXCLUDED.ciclo_pago_snapshot,
      costo_servicio_snapshot = EXCLUDED.costo_servicio_snapshot,
      moneda_snapshot = EXCLUDED.moneda_snapshot,
      metodo_pago_nombre_snapshot = EXCLUDED.metodo_pago_nombre_snapshot,
      metodo_pago_alias_snapshot = EXCLUDED.metodo_pago_alias_snapshot,
      metodo_pago_tarjeta_terminacion_snapshot = EXCLUDED.metodo_pago_tarjeta_terminacion_snapshot,
      renovacion_automatica_snapshot = EXCLUDED.renovacion_automatica_snapshot;
  ELSE
    INSERT INTO public.notificaciones_reposo (
      notificacion_id, servicio_id, categoria_id, servicio_nombre_snapshot,
      servicio_correo_snapshot, servicio_contrasena_snapshot,
      categoria_nombre_snapshot, dias_reposo_snapshot,
      fecha_inicio_reposo_snapshot, fecha_fin_reposo_snapshot
    ) VALUES (
      v_notification_id,
      v_entity_id,
      NULLIF(p_detail ->> 'categoria_id', ''),
      COALESCE(p_detail ->> 'servicio_nombre_snapshot', ''),
      p_detail ->> 'servicio_correo_snapshot',
      p_detail ->> 'servicio_contrasena_snapshot',
      p_detail ->> 'categoria_nombre_snapshot',
      NULLIF(p_detail ->> 'dias_reposo_snapshot', '')::INTEGER,
      NULLIF(p_detail ->> 'fecha_inicio_reposo_snapshot', '')::DATE,
      NULLIF(p_detail ->> 'fecha_fin_reposo_snapshot', '')::DATE
    )
    ON CONFLICT (notificacion_id) DO UPDATE SET
      servicio_id = EXCLUDED.servicio_id,
      categoria_id = EXCLUDED.categoria_id,
      servicio_nombre_snapshot = EXCLUDED.servicio_nombre_snapshot,
      servicio_correo_snapshot = EXCLUDED.servicio_correo_snapshot,
      servicio_contrasena_snapshot = EXCLUDED.servicio_contrasena_snapshot,
      categoria_nombre_snapshot = EXCLUDED.categoria_nombre_snapshot,
      dias_reposo_snapshot = EXCLUDED.dias_reposo_snapshot,
      fecha_inicio_reposo_snapshot = EXCLUDED.fecha_inicio_reposo_snapshot,
      fecha_fin_reposo_snapshot = EXCLUDED.fecha_fin_reposo_snapshot;
  END IF;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_notification_aggregate(JSONB, JSONB, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_notification_aggregate(jsonb, jsonb, boolean) TO authenticated, service_role;

REVOKE INSERT ON TABLE public.notificaciones FROM authenticated;
REVOKE UPDATE ON TABLE public.notificaciones FROM authenticated;
GRANT UPDATE (leida, resaltada, read_at, dismissed_at, updated_at) ON TABLE public.notificaciones TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notificaciones_venta FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notificaciones_servicio FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notificaciones_reposo FROM authenticated;

-- Keep the existing security audit aware of this deliberately exposed definer RPC.
CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo')
  ),
  allowed_authenticated_security_definer(function_name) AS (
    VALUES
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('get_dashboard_stats_snapshot'),
      ('get_dashboard_churn_stats'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments'),
      ('create_venta_refund'),
      ('upsert_notification_aggregate')
  ),
  required_authenticated_rpcs(function_name) AS (
    VALUES
      ('create_venta_with_initial_payment'),
      ('create_servicio_with_initial_payment'),
      ('create_venta_payment'),
      ('create_servicio_payment'),
      ('update_venta_payment_and_period'),
      ('update_servicio_payment_and_period'),
      ('delete_venta_payment_and_empty_period'),
      ('delete_servicio_payment_and_empty_period'),
      ('get_dashboard_stats_live'),
      ('get_dashboard_stats_snapshot'),
      ('get_dashboard_churn_stats'),
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments'),
      ('create_venta_refund'),
      ('upsert_notification_aggregate')
  ),
  public_functions AS (
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  )
  SELECT jsonb_build_object(
    'rls_disabled_app_tables', (
      SELECT count(*) FROM app_tables AS t
      JOIN pg_class AS c ON c.relname = t.table_name
      JOIN pg_namespace AS n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r' AND c.relrowsecurity = false
    ),
    'security_definer_missing_search_path', (
      SELECT count(*) FROM public_functions
      WHERE prosecdef = true
        AND NOT EXISTS (
          SELECT 1 FROM unnest(COALESCE(proconfig, ARRAY[]::TEXT[])) AS cfg
          WHERE cfg LIKE 'search_path=%'
        )
    ),
    'security_definer_executable_by_anon', (
      SELECT count(*) FROM public_functions
      WHERE prosecdef = true AND has_function_privilege('anon', oid, 'EXECUTE')
    ),
    'unapproved_security_definer_executable_by_authenticated', (
      SELECT count(*) FROM public_functions AS pf
      WHERE prosecdef = true
        AND has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1 FROM allowed_authenticated_security_definer AS allowed
          WHERE allowed.function_name = pf.proname
        )
    ),
    'required_rpc_missing_authenticated_execute', (
      SELECT count(*) FROM required_authenticated_rpcs AS required
      WHERE NOT EXISTS (
        SELECT 1 FROM public_functions AS pf
        WHERE pf.proname = required.function_name
          AND has_function_privilege('authenticated', pf.oid, 'EXECUTE')
      )
    ),
    'required_rpc_executable_by_anon', (
      SELECT count(*) FROM required_authenticated_rpcs AS required
      JOIN public_functions AS pf ON pf.proname = required.function_name
      WHERE has_function_privilege('anon', pf.oid, 'EXECUTE')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.run_security_audit_validations()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_audit_validations()
  TO service_role, postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;
