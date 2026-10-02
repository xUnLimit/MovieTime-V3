-- Expand only: legacy Netflix claims and RPCs remain untouched.
ALTER TABLE public.categorias ADD COLUMN code_provider text;
ALTER TABLE public.servicios ADD COLUMN acceso_por_codigo boolean NOT NULL DEFAULT false;
UPDATE public.categorias SET code_provider = 'netflix' WHERE nombre ILIKE '%netflix%';

-- Both directions serialize on the category row, including concurrent flag/provider changes.
CREATE FUNCTION public.validate_service_code_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_provider text;
BEGIN
  SELECT c.code_provider INTO v_provider FROM public.categorias c
  WHERE c.id = NEW.categoria_id FOR SHARE;
  IF NEW.acceso_por_codigo AND v_provider IS NULL THEN
    RAISE EXCEPTION 'La categoria no tiene proveedor de codigos' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_service_code_access() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER servicios_validate_code_access BEFORE INSERT OR UPDATE OF categoria_id, acceso_por_codigo
ON public.servicios FOR EACH ROW EXECUTE FUNCTION public.validate_service_code_access();

CREATE FUNCTION public.validate_category_code_provider() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.code_provider IS NULL AND EXISTS (
    SELECT 1 FROM public.servicios s WHERE s.categoria_id = NEW.id AND s.acceso_por_codigo
  ) THEN
    RAISE EXCEPTION 'Desactive el acceso por codigo antes de quitar el proveedor' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_category_code_provider() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER categorias_validate_code_provider BEFORE UPDATE OF code_provider
ON public.categorias FOR EACH ROW EXECUTE FUNCTION public.validate_category_code_provider();

CREATE TABLE public.code_claims (
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 64),
  mail_key text NOT NULL,
  wa_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, mail_key)
);
CREATE INDEX code_claims_created_at_idx ON public.code_claims(created_at);
ALTER TABLE public.code_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.code_claims FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.code_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.code_claims TO service_role;
CREATE POLICY code_claims_admin_read ON public.code_claims FOR SELECT TO authenticated
USING ((SELECT private.auth_role()) = 'admin');
INSERT INTO public.code_claims(provider, mail_key, wa_id, created_at)
SELECT 'netflix', mail_key, wa_id, created_at FROM public.netflix_code_claims
ON CONFLICT (provider, mail_key) DO NOTHING;

-- Same view projection; explicit original columns preserve positional compatibility.
CREATE OR REPLACE VIEW public.v_ventas_full
WITH (security_invoker = true)
AS
SELECT
  v.id,
  v.cliente_id,
  v.servicio_id,
  v.categoria_id,
  v.estado,
  v.perfil_numero,
  v.perfil_nombre,
  v.codigo,
  v.cortada_at,
  v.cortada_by,
  v.motivo_corte,
  v.archivado_at,
  v.archivado_by,
  v.motivo_archivado,
  v.notas,
  v.created_at,
  v.updated_at,
  v.created_by,
  u.nombre || ' ' || u.apellido AS cliente_nombre,
  u.telefono AS cliente_telefono,
  s.nombre AS servicio_nombre,
  s.correo AS servicio_correo,
  c.nombre AS categoria_nombre,
  vp_last.id AS ultimo_periodo_id,
  vp_last.numero_periodo AS ultimo_numero_periodo,
  vp_last.fecha_inicio AS ultima_fecha_inicio,
  vp_last.fecha_fin AS ultima_fecha_fin,
  vp_last.ciclo_pago AS ultimo_ciclo_pago,
  vp_last.total_original AS ultimo_total_original,
  vp_last.moneda_original AS ultima_moneda,
  vp_last.total_usd AS ultimo_total_usd,
  vp_last.plan_nombre_snapshot AS ultimo_plan_nombre,
  vp_last.plan_tipo_nombre_snapshot AS ultimo_plan_tipo_nombre,
  s.contrasena AS servicio_contrasena,
  pv_last.metodo_pago_id AS ultimo_metodo_pago_id,
  pv_last.metodo_pago_nombre_snapshot AS ultimo_metodo_pago_nombre,
  vp_last.precio_original AS ultimo_precio_original,
  vp_last.descuento AS ultimo_descuento,
  GREATEST(COALESCE(vp_last.numero_periodo, 1) - 1, 0) AS renovaciones,
  vp_last.plan_id AS ultimo_plan_id,
  s.acceso_por_codigo
FROM public.ventas v
LEFT JOIN public.terceros u ON u.id = v.cliente_id
LEFT JOIN public.servicios s ON s.id = v.servicio_id
LEFT JOIN public.categorias c ON c.id = v.categoria_id
LEFT JOIN LATERAL (
  SELECT vp.*
  FROM public.venta_periodos vp
  WHERE vp.venta_id = v.id
  ORDER BY vp.numero_periodo DESC
  LIMIT 1
) vp_last ON true
LEFT JOIN LATERAL (
  SELECT pv.*
  FROM public.pagos_venta pv
  WHERE pv.venta_id = v.id
    AND pv.estado = 'registrado'
  ORDER BY pv.fecha_pago DESC, pv.created_at DESC
  LIMIT 1
) pv_last ON true
WHERE v.archivado_at IS NULL;

-- Same view projection; explicit original columns preserve positional compatibility.
CREATE OR REPLACE VIEW public.v_servicios_full
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.categoria_id,
  s.plan_tipo_id,
  s.nombre,
  s.correo,
  s.contrasena,
  s.perfiles_disponibles,
  s.perfiles_ocupados,
  s.activo,
  s.en_reposo,
  s.dias_reposo,
  s.fecha_inicio_reposo,
  s.fecha_fin_reposo,
  s.cortado_at,
  s.cortado_by,
  s.motivo_corte,
  s.archivado_at,
  s.archivado_by,
  s.motivo_archivado,
  s.notas,
  s.created_at,
  s.updated_at,
  s.created_by,
  c.nombre AS categoria_nombre,
  pt.nombre AS plan_tipo_nombre,
  sp_last.id AS ultimo_periodo_id,
  sp_last.numero_periodo AS ultimo_numero_periodo,
  sp_last.fecha_inicio AS ultima_fecha_inicio,
  sp_last.fecha_vencimiento AS ultima_fecha_vencimiento,
  sp_last.ciclo_pago AS ultimo_ciclo_pago,
  sp_last.costo_original AS ultimo_costo_original,
  sp_last.moneda_original AS ultima_moneda,
  sp_last.costo_usd AS ultimo_costo_usd,
  sp_last.renovacion_automatica AS ultima_renovacion_automatica,
  ps_last.metodo_pago_id AS ultimo_metodo_pago_id,
  ps_last.metodo_pago_nombre_snapshot AS ultimo_metodo_pago_nombre,
  GREATEST(COALESCE(sp_last.numero_periodo, 1) - 1, 0) AS renovaciones,
  GREATEST(COALESCE(s.perfiles_disponibles, 0) - COALESCE(s.perfiles_ocupados, 0), 0) AS perfiles_libres,
  s.acceso_por_codigo
FROM servicios s
LEFT JOIN categorias c ON c.id = s.categoria_id
LEFT JOIN planes_tipos pt ON pt.id = s.plan_tipo_id
LEFT JOIN LATERAL (
  SELECT sp.*
  FROM servicio_periodos sp
  WHERE sp.servicio_id = s.id
  ORDER BY sp.numero_periodo DESC
  LIMIT 1
) sp_last ON true
LEFT JOIN LATERAL (
  SELECT ps.*
  FROM pagos_servicio ps
  WHERE ps.servicio_id = s.id
    AND ps.estado = 'registrado'
  ORDER BY ps.fecha_pago DESC, ps.created_at DESC
  LIMIT 1
) ps_last ON true
WHERE s.archivado_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_categorias_full()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH tipos AS (
    SELECT
      pt.categoria_id,
      jsonb_agg(
        jsonb_build_object('id', pt.id, 'nombre', pt.nombre)
        ORDER BY pt.orden, pt.nombre
      ) AS tipos_planes
    FROM planes_tipos pt
    WHERE pt.activo = true
    GROUP BY pt.categoria_id
  ),
  planes_agg AS (
    SELECT
      p.categoria_id,
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'nombre', p.nombre,
          'precio', p.precio,
          'cicloPago', p.ciclo_pago,
          'tipoPlan', p.plan_tipo_id
        )
        ORDER BY p.orden, p.nombre
      ) AS planes
    FROM planes p
    WHERE p.activo = true
    GROUP BY p.categoria_id
  ),
  ventas_activas AS (
    SELECT
      v.categoria_id,
      COUNT(*) AS ventas_totales
    FROM ventas v
    WHERE v.archivado_at IS NULL
      AND v.estado <> 'inactivo'
      AND v.categoria_id IS NOT NULL
    GROUP BY v.categoria_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'codeProvider', c.code_provider,
        'tipo', c.tipo,
        'tipoCategoria', c.tipo_categoria,
        'tiposPlanes', COALESCE(t.tipos_planes, '[]'::jsonb),
        'planes', COALESCE(pa.planes, '[]'::jsonb),
        'notas', c.notas,
        'activo', c.activo,
        'totalServicios', COALESCE(cc.total_servicios, 0),
        'serviciosActivos', COALESCE(cc.servicios_activos, 0),
        'perfilesDisponiblesTotal', COALESCE(cc.perfiles_disponibles_total, 0),
        'ventasTotales', COALESCE(va.ventas_totales, 0),
        'ingresosTotales', COALESCE(cfm.ingresos_usd, 0),
        'gastosTotal', COALESCE(cfm.gastos_usd, 0),
        'createdAt', c.created_at,
        'updatedAt', c.updated_at,
        'createdBy', c.created_by
      )
      ORDER BY c.nombre
    ),
    '[]'::jsonb
  )
  FROM categorias c
  LEFT JOIN tipos t ON t.categoria_id = c.id
  LEFT JOIN planes_agg pa ON pa.categoria_id = c.id
  LEFT JOIN v_categoria_counters cc ON cc.categoria_id = c.id
  LEFT JOIN ventas_activas va ON va.categoria_id = c.id
  LEFT JOIN v_categoria_financial_metrics cfm ON cfm.categoria_id = c.id;
$$;

CREATE FUNCTION public.create_servicio_with_code_access(
  p_acceso_por_codigo BOOLEAN,
  p_categoria_id TEXT,
  p_plan_tipo_id TEXT,
  p_nombre TEXT,
  p_correo TEXT,
  p_contrasena TEXT,
  p_perfiles_disponibles INTEGER,
  p_perfiles_ocupados INTEGER,
  p_activo BOOLEAN,
  p_en_reposo BOOLEAN,
  p_dias_reposo INTEGER,
  p_fecha_inicio_reposo DATE,
  p_fecha_fin_reposo DATE,
  p_notas TEXT,
  p_fecha_inicio DATE,
  p_fecha_vencimiento DATE,
  p_ciclo_pago ciclo_pago_enum,
  p_costo_original NUMERIC,
  p_moneda_original TEXT,
  p_costo_usd NUMERIC,
  p_exchange_rate NUMERIC,
  p_renovacion_automatica BOOLEAN,
  p_metodo_pago_id TEXT,
  p_metodo_pago_nombre_snapshot TEXT,
  p_fecha_pago TIMESTAMPTZ DEFAULT now(),
  p_pago_notas TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid(),
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog
AS $$
DECLARE v_id text;
BEGIN
  IF auth.uid() IS NULL OR (p_created_by IS NOT NULL AND p_created_by <> auth.uid()) THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
    SELECT result_id INTO v_id FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_servicio_with_initial_payment' AND created_by = auth.uid();
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  v_id := public.create_servicio_with_initial_payment(
    p_categoria_id => p_categoria_id,
    p_plan_tipo_id => p_plan_tipo_id,
    p_nombre => p_nombre,
    p_correo => p_correo,
    p_contrasena => p_contrasena,
    p_perfiles_disponibles => p_perfiles_disponibles,
    p_perfiles_ocupados => p_perfiles_ocupados,
    p_activo => p_activo,
    p_en_reposo => p_en_reposo,
    p_dias_reposo => p_dias_reposo,
    p_fecha_inicio_reposo => p_fecha_inicio_reposo,
    p_fecha_fin_reposo => p_fecha_fin_reposo,
    p_notas => p_notas,
    p_fecha_inicio => p_fecha_inicio,
    p_fecha_vencimiento => p_fecha_vencimiento,
    p_ciclo_pago => p_ciclo_pago,
    p_costo_original => p_costo_original,
    p_moneda_original => p_moneda_original,
    p_costo_usd => p_costo_usd,
    p_exchange_rate => p_exchange_rate,
    p_renovacion_automatica => p_renovacion_automatica,
    p_metodo_pago_id => p_metodo_pago_id,
    p_metodo_pago_nombre_snapshot => p_metodo_pago_nombre_snapshot,
    p_fecha_pago => p_fecha_pago,
    p_pago_notas => p_pago_notas,
    p_created_by => p_created_by,
    p_idempotency_key => p_idempotency_key
  );
  UPDATE public.servicios SET acceso_por_codigo = COALESCE(p_acceso_por_codigo, false) WHERE id = v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_servicio_with_code_access(BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER, DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_servicio_with_code_access(BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN, INTEGER, DATE, DATE, TEXT, DATE, DATE, ciclo_pago_enum, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID) TO authenticated;

-- Live policy for existing manual notification messages and previews.
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
  n.fecha_prometida_pago,
  s.acceso_por_codigo
FROM public.notificaciones AS n
JOIN public.notificaciones_venta AS nv ON nv.notificacion_id::text = n.id::text
LEFT JOIN public.ventas AS v          ON v.id::text = nv.venta_id::text
LEFT JOIN public.venta_periodos AS vp ON vp.id::text = nv.venta_periodo_id::text
LEFT JOIN public.terceros AS t        ON t.id::text = nv.cliente_id::text
LEFT JOIN public.servicios AS s       ON s.id::text = nv.servicio_id::text
LEFT JOIN public.categorias AS c      ON c.id::text = nv.categoria_id::text
WHERE n.entidad = 'venta';

NOTIFY pgrst, 'reload schema';
