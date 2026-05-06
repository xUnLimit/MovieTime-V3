-- ============================================================================
-- Remaining performance read/write models
-- ============================================================================

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
        ORDER BY pt.nombre
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
        ORDER BY p.nombre
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

CREATE OR REPLACE FUNCTION public.get_categorias_counts()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'totalCategorias', COUNT(*),
    'categoriasClientes', COUNT(*) FILTER (WHERE tipo = 'cliente'),
    'categoriasRevendedores', COUNT(*) FILTER (WHERE tipo = 'revendedor')
  )
  FROM categorias;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_home()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_stats RECORD;
  v_activity jsonb;
BEGIN
  SELECT * INTO v_stats FROM public.get_dashboard_stats_live() LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'usuarioId', al.usuario_id,
        'usuarioEmail', al.usuario_email,
        'accion', al.accion,
        'entidad', al.entidad,
        'entidadId', al.entidad_id,
        'entidadNombre', al.entidad_nombre,
        'detalles', al.detalles,
        'cambios', al.cambios,
        'metadata', al.metadata,
        'timestamp', al.timestamp
      )
      ORDER BY al.timestamp DESC
    ),
    '[]'::jsonb
  )
  INTO v_activity
  FROM (
    SELECT *
    FROM activity_log
    ORDER BY timestamp DESC
    LIMIT 6
  ) al;

  RETURN jsonb_build_object(
    'stats', jsonb_build_object(
      'id', v_stats.id,
      'ingresos_total', v_stats.ingresos_total,
      'gastos_total', v_stats.gastos_total,
      'usuarios_por_mes', v_stats.usuarios_por_mes,
      'usuarios_por_dia', v_stats.usuarios_por_dia,
      'ingresos_por_mes', v_stats.ingresos_por_mes,
      'ingresos_por_dia', v_stats.ingresos_por_dia,
      'ingresos_por_categoria', v_stats.ingresos_por_categoria,
      'ingresos_categorias_por_mes', v_stats.ingresos_categorias_por_mes,
      'ventas_pronostico', v_stats.ventas_pronostico,
      'servicios_pronostico', v_stats.servicios_pronostico,
      'updated_at', v_stats.updated_at
    ),
    'counts', jsonb_build_object(
      'ventasActivas', (
        SELECT COUNT(*)
        FROM ventas
        WHERE archivado_at IS NULL
          AND estado = 'activo'
      ),
      'totalClientes', (
        SELECT COUNT(*)
        FROM usuarios
        WHERE tipo = 'cliente'
      ),
      'totalRevendedores', (
        SELECT COUNT(*)
        FROM usuarios
        WHERE tipo = 'revendedor'
      )
    ),
    'recentActivity', v_activity
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_venta_with_payments(
  p_venta_id text,
  p_delete_payments boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_delete_payments THEN
    DELETE FROM pagos_venta
    WHERE venta_id = p_venta_id;

    DELETE FROM venta_periodos
    WHERE venta_id = p_venta_id
      AND NOT EXISTS (
        SELECT 1
        FROM pagos_venta pv
        WHERE pv.venta_periodo_id = venta_periodos.id
      );
  END IF;

  UPDATE ventas
  SET
    archivado_at = now(),
    motivo_archivado = COALESCE(motivo_archivado, 'Eliminado desde la app'),
    updated_at = now()
  WHERE id = p_venta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_servicio_with_payments(
  p_servicio_id text,
  p_delete_payments boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_delete_payments THEN
    DELETE FROM pagos_servicio
    WHERE servicio_id = p_servicio_id;

    DELETE FROM servicio_periodos
    WHERE servicio_id = p_servicio_id
      AND NOT EXISTS (
        SELECT 1
        FROM pagos_servicio ps
        WHERE ps.servicio_periodo_id = servicio_periodos.id
      );
  END IF;

  UPDATE servicios
  SET
    archivado_at = now(),
    motivo_archivado = COALESCE(motivo_archivado, 'Eliminado desde la app'),
    updated_at = now()
  WHERE id = p_servicio_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_categorias_full() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_categorias_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_home() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_venta_with_payments(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_servicio_with_payments(text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_categorias_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_categorias_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_home() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_venta_with_payments(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_servicio_with_payments(text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.get_dashboard_stats_live() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats_live() TO authenticated;

CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('dashboard_stats'), ('notificaciones'), ('notificaciones_venta'),
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
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments')
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
      ('delete_venta_with_payments'),
      ('delete_servicio_with_payments')
  ),
  public_functions AS (
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  )
  SELECT jsonb_build_object(
    'rls_disabled_app_tables',
      (
        SELECT count(*)
        FROM app_tables t
        JOIN pg_class c ON c.relname = t.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE c.relkind = 'r'
          AND c.relrowsecurity = false
      ),
    'security_definer_missing_search_path',
      (
        SELECT count(*)
        FROM public_functions
        WHERE prosecdef = true
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(COALESCE(proconfig, ARRAY[]::text[])) cfg
            WHERE cfg LIKE 'search_path=%'
          )
      ),
    'security_definer_executable_by_anon',
      (
        SELECT count(*)
        FROM public_functions
        WHERE prosecdef = true
          AND has_function_privilege('anon', oid, 'EXECUTE')
      ),
    'unapproved_security_definer_executable_by_authenticated',
      (
        SELECT count(*)
        FROM public_functions pf
        WHERE prosecdef = true
          AND has_function_privilege('authenticated', oid, 'EXECUTE')
          AND NOT EXISTS (
            SELECT 1
            FROM allowed_authenticated_security_definer allowed
            WHERE allowed.function_name = pf.proname
          )
      ),
    'required_rpc_missing_authenticated_execute',
      (
        SELECT count(*)
        FROM required_authenticated_rpcs required
        WHERE NOT EXISTS (
          SELECT 1
          FROM public_functions pf
          WHERE pf.proname = required.function_name
            AND has_function_privilege('authenticated', pf.oid, 'EXECUTE')
        )
      ),
    'required_rpc_executable_by_anon',
      (
        SELECT count(*)
        FROM required_authenticated_rpcs required
        JOIN public_functions pf ON pf.proname = required.function_name
        WHERE has_function_privilege('anon', pf.oid, 'EXECUTE')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.run_security_audit_validations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_audit_validations() TO service_role, postgres;
