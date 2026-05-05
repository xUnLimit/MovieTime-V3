-- ============================================================================
-- Linter security/RLS hardening
--
-- Addresses Supabase database linter findings:
-- - SECURITY DEFINER functions callable through exposed public RPC.
-- - auth.uid()/role helper init-plan warnings on profiles policies.
-- - Multiple permissive policies caused by FOR ALL admin policies.
-- - Missing indexes for foreign-key columns reported by the linter.
-- ============================================================================

-- Keep role helper out of exposed API schemas.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())
$$;

REVOKE ALL ON FUNCTION private.auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.auth_role() TO anon, authenticated, service_role, postgres;

-- profiles: one permissive policy per action, with init-plan friendly auth calls.
DROP POLICY IF EXISTS profiles_select_self_or_admin ON profiles;
DROP POLICY IF EXISTS profiles_update_self_no_role ON profiles;
DROP POLICY IF EXISTS profiles_admin_all ON profiles;
DROP POLICY IF EXISTS profiles_insert_admin ON profiles;
DROP POLICY IF EXISTS profiles_delete_admin ON profiles;

CREATE POLICY profiles_select_self_or_admin ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT private.auth_role()) = 'admin'
  );

CREATE POLICY profiles_update_self_or_admin_no_role ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT private.auth_role()) = 'admin'
  )
  WITH CHECK (
    (SELECT private.auth_role()) = 'admin'
    OR (
      id = (SELECT auth.uid())
      AND role = (SELECT private.auth_role())
    )
  );

CREATE POLICY profiles_insert_admin ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.auth_role()) = 'admin');

CREATE POLICY profiles_delete_admin ON profiles
  FOR DELETE
  TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

-- Replace public auth_role() usage in admin policies.
DROP POLICY IF EXISTS metodos_pago_delete_admin ON metodos_pago;
CREATE POLICY metodos_pago_delete_admin ON metodos_pago
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS categorias_delete_admin ON categorias;
CREATE POLICY categorias_delete_admin ON categorias
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS planes_tipos_delete_admin ON planes_tipos;
CREATE POLICY planes_tipos_delete_admin ON planes_tipos
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS planes_delete_admin ON planes;
CREATE POLICY planes_delete_admin ON planes
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS usuarios_delete_admin ON usuarios;
CREATE POLICY usuarios_delete_admin ON usuarios
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS servicios_delete_admin ON servicios;
CREATE POLICY servicios_delete_admin ON servicios
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS servicio_periodos_delete_admin ON servicio_periodos;
CREATE POLICY servicio_periodos_delete_admin ON servicio_periodos
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS pagos_servicio_delete_admin ON pagos_servicio;
CREATE POLICY pagos_servicio_delete_admin ON pagos_servicio
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS ventas_delete_admin ON ventas;
CREATE POLICY ventas_delete_admin ON ventas
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS venta_periodos_delete_admin ON venta_periodos;
CREATE POLICY venta_periodos_delete_admin ON venta_periodos
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS pagos_venta_delete_admin ON pagos_venta;
CREATE POLICY pagos_venta_delete_admin ON pagos_venta
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS templates_delete_admin ON templates;
CREATE POLICY templates_delete_admin ON templates
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS activity_log_delete_admin ON activity_log;
CREATE POLICY activity_log_delete_admin ON activity_log
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS legacy_orphan_admin_all ON legacy_orphan_records;
CREATE POLICY legacy_orphan_select_admin ON legacy_orphan_records
  FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY legacy_orphan_insert_admin ON legacy_orphan_records
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY legacy_orphan_update_admin ON legacy_orphan_records
  FOR UPDATE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY legacy_orphan_delete_admin ON legacy_orphan_records
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

-- Split FOR ALL admin write policies so they do not overlap SELECT policies.
DROP POLICY IF EXISTS currencies_admin_write ON currencies;
CREATE POLICY currencies_insert_admin ON currencies
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY currencies_update_admin ON currencies
  FOR UPDATE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY currencies_delete_admin ON currencies
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS exchange_rates_admin_write ON exchange_rates;
CREATE POLICY exchange_rates_insert_admin ON exchange_rates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY exchange_rates_update_admin ON exchange_rates
  FOR UPDATE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY exchange_rates_delete_admin ON exchange_rates
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS tipos_gasto_admin_write ON tipos_gasto;
CREATE POLICY tipos_gasto_insert_admin ON tipos_gasto
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY tipos_gasto_update_admin ON tipos_gasto
  FOR UPDATE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY tipos_gasto_delete_admin ON tipos_gasto
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS config_admin_write ON config;
CREATE POLICY config_insert_admin ON config
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY config_update_admin ON config
  FOR UPDATE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY config_delete_admin ON config
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS dashboard_stats_admin_write ON dashboard_stats;
CREATE POLICY dashboard_stats_insert_admin ON dashboard_stats
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY dashboard_stats_update_admin ON dashboard_stats
  FOR UPDATE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY dashboard_stats_delete_admin ON dashboard_stats
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

DROP POLICY IF EXISTS gastos_admin_all ON gastos;
CREATE POLICY gastos_select_admin ON gastos
  FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY gastos_insert_admin ON gastos
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY gastos_update_admin ON gastos
  FOR UPDATE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin')
  WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY gastos_delete_admin ON gastos
  FOR DELETE TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');

-- Remove public/exposed execution paths for SECURITY DEFINER functions.
REVOKE ALL ON FUNCTION public.auth_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role() TO service_role, postgres;

REVOKE ALL ON FUNCTION public.rebuild_dashboard_financial_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_dashboard_financial_stats() TO service_role, postgres;

-- Cover foreign keys reported by Supabase linter.
CREATE INDEX IF NOT EXISTS idx_activity_log_usuario_id ON activity_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_categorias_created_by ON categorias(created_by);
CREATE INDEX IF NOT EXISTS idx_gastos_created_by ON gastos(created_by);
CREATE INDEX IF NOT EXISTS idx_gastos_moneda_original ON gastos(moneda_original);
CREATE INDEX IF NOT EXISTS idx_metodos_pago_created_by ON metodos_pago(created_by);
CREATE INDEX IF NOT EXISTS idx_metodos_pago_moneda ON metodos_pago(moneda);
CREATE INDEX IF NOT EXISTS idx_notificaciones_reposo_categoria_id ON notificaciones_reposo(categoria_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_servicio_categoria_id ON notificaciones_servicio(categoria_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_servicio_periodo_id ON notificaciones_servicio(servicio_periodo_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_venta_categoria_id ON notificaciones_venta(categoria_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_venta_cliente_id ON notificaciones_venta(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_venta_servicio_id ON notificaciones_venta(servicio_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_venta_periodo_id ON notificaciones_venta(venta_periodo_id);
CREATE INDEX IF NOT EXISTS idx_pagos_servicio_anulada_by ON pagos_servicio(anulada_by);
CREATE INDEX IF NOT EXISTS idx_pagos_servicio_created_by ON pagos_servicio(created_by);
CREATE INDEX IF NOT EXISTS idx_pagos_servicio_metodo_pago_id ON pagos_servicio(metodo_pago_id);
CREATE INDEX IF NOT EXISTS idx_pagos_servicio_moneda_original ON pagos_servicio(moneda_original);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_anulada_by ON pagos_venta(anulada_by);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_created_by ON pagos_venta(created_by);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_metodo_pago_id ON pagos_venta(metodo_pago_id);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_moneda_original ON pagos_venta(moneda_original);
CREATE INDEX IF NOT EXISTS idx_planes_plan_tipo_categoria_fk ON planes(plan_tipo_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_servicio_periodos_created_by ON servicio_periodos(created_by);
CREATE INDEX IF NOT EXISTS idx_servicio_periodos_moneda_original ON servicio_periodos(moneda_original);
CREATE INDEX IF NOT EXISTS idx_servicios_archivado_by ON servicios(archivado_by);
CREATE INDEX IF NOT EXISTS idx_servicios_cortado_by ON servicios(cortado_by);
CREATE INDEX IF NOT EXISTS idx_servicios_created_by ON servicios(created_by);
CREATE INDEX IF NOT EXISTS idx_servicios_plan_tipo_categoria_fk ON servicios(plan_tipo_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_created_by ON usuarios(created_by);
CREATE INDEX IF NOT EXISTS idx_venta_periodos_created_by ON venta_periodos(created_by);
CREATE INDEX IF NOT EXISTS idx_venta_periodos_moneda_original ON venta_periodos(moneda_original);
CREATE INDEX IF NOT EXISTS idx_venta_periodos_plan_id ON venta_periodos(plan_id);
CREATE INDEX IF NOT EXISTS idx_ventas_archivado_by ON ventas(archivado_by);
CREATE INDEX IF NOT EXISTS idx_ventas_categoria_id ON ventas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cortada_by ON ventas(cortada_by);
CREATE INDEX IF NOT EXISTS idx_ventas_created_by ON ventas(created_by);
