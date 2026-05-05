-- ============================================================================
-- 008_rls.sql
-- Row-Level Security minima segura para MVP.
-- Reglas:
--   * profiles: usuarios leen su profile; admin lee todos.
--   * No permitir update libre de profiles.role.
--   * Tablas operativas: operadores y admin leen/insertan/actualizan; solo
--     admin elimina.
--   * gastos: admin-only (lectura y escritura) por ahora.
--   * activity_log: insert + select; sin update/delete.
--   * Vistas usan security_invoker = true (definidas en 007).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper de rol
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- ----------------------------------------------------------------------------
-- Habilitar RLS
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicio_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_reposo ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_placeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_orphan_records ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
CREATE POLICY profiles_select_self_or_admin ON profiles
  FOR SELECT
  USING (id = auth.uid() OR public.auth_role() = 'admin');

CREATE POLICY profiles_update_self_no_role ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY profiles_admin_all ON profiles
  FOR ALL
  USING (public.auth_role() = 'admin')
  WITH CHECK (public.auth_role() = 'admin');

-- ----------------------------------------------------------------------------
-- currencies / exchange_rates: lectura libre autenticada,
-- escritura solo admin (las edge functions usan service_role que ignora RLS).
-- ----------------------------------------------------------------------------
CREATE POLICY currencies_select_authenticated ON currencies
  FOR SELECT USING (public.is_authenticated());

CREATE POLICY currencies_admin_write ON currencies
  FOR ALL
  USING (public.auth_role() = 'admin')
  WITH CHECK (public.auth_role() = 'admin');

CREATE POLICY exchange_rates_select_authenticated ON exchange_rates
  FOR SELECT USING (public.is_authenticated());

CREATE POLICY exchange_rates_admin_write ON exchange_rates
  FOR ALL
  USING (public.auth_role() = 'admin')
  WITH CHECK (public.auth_role() = 'admin');

-- ----------------------------------------------------------------------------
-- Helper macro: tabla operativa (read+insert+update operadores; delete admin).
-- Lo expandimos a mano por tabla.
-- ----------------------------------------------------------------------------

-- metodos_pago
CREATE POLICY metodos_pago_select ON metodos_pago FOR SELECT USING (public.is_authenticated());
CREATE POLICY metodos_pago_insert ON metodos_pago FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY metodos_pago_update ON metodos_pago FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY metodos_pago_delete_admin ON metodos_pago FOR DELETE USING (public.auth_role() = 'admin');

-- categorias
CREATE POLICY categorias_select ON categorias FOR SELECT USING (public.is_authenticated());
CREATE POLICY categorias_insert ON categorias FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY categorias_update ON categorias FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY categorias_delete_admin ON categorias FOR DELETE USING (public.auth_role() = 'admin');

-- planes_tipos
CREATE POLICY planes_tipos_select ON planes_tipos FOR SELECT USING (public.is_authenticated());
CREATE POLICY planes_tipos_insert ON planes_tipos FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY planes_tipos_update ON planes_tipos FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY planes_tipos_delete_admin ON planes_tipos FOR DELETE USING (public.auth_role() = 'admin');

-- planes
CREATE POLICY planes_select ON planes FOR SELECT USING (public.is_authenticated());
CREATE POLICY planes_insert ON planes FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY planes_update ON planes FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY planes_delete_admin ON planes FOR DELETE USING (public.auth_role() = 'admin');

-- usuarios
CREATE POLICY usuarios_select ON usuarios FOR SELECT USING (public.is_authenticated());
CREATE POLICY usuarios_insert ON usuarios FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY usuarios_update ON usuarios FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY usuarios_delete_admin ON usuarios FOR DELETE USING (public.auth_role() = 'admin');

-- servicios
CREATE POLICY servicios_select ON servicios FOR SELECT USING (public.is_authenticated());
CREATE POLICY servicios_insert ON servicios FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY servicios_update ON servicios FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY servicios_delete_admin ON servicios FOR DELETE USING (public.auth_role() = 'admin');

-- servicio_periodos
CREATE POLICY servicio_periodos_select ON servicio_periodos FOR SELECT USING (public.is_authenticated());
CREATE POLICY servicio_periodos_insert ON servicio_periodos FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY servicio_periodos_update ON servicio_periodos FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY servicio_periodos_delete_admin ON servicio_periodos FOR DELETE USING (public.auth_role() = 'admin');

-- pagos_servicio
CREATE POLICY pagos_servicio_select ON pagos_servicio FOR SELECT USING (public.is_authenticated());
CREATE POLICY pagos_servicio_insert ON pagos_servicio FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY pagos_servicio_update ON pagos_servicio FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY pagos_servicio_delete_admin ON pagos_servicio FOR DELETE USING (public.auth_role() = 'admin');

-- ventas
CREATE POLICY ventas_select ON ventas FOR SELECT USING (public.is_authenticated());
CREATE POLICY ventas_insert ON ventas FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY ventas_update ON ventas FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY ventas_delete_admin ON ventas FOR DELETE USING (public.auth_role() = 'admin');

-- venta_periodos
CREATE POLICY venta_periodos_select ON venta_periodos FOR SELECT USING (public.is_authenticated());
CREATE POLICY venta_periodos_insert ON venta_periodos FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY venta_periodos_update ON venta_periodos FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY venta_periodos_delete_admin ON venta_periodos FOR DELETE USING (public.auth_role() = 'admin');

-- pagos_venta
CREATE POLICY pagos_venta_select ON pagos_venta FOR SELECT USING (public.is_authenticated());
CREATE POLICY pagos_venta_insert ON pagos_venta FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY pagos_venta_update ON pagos_venta FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY pagos_venta_delete_admin ON pagos_venta FOR DELETE USING (public.auth_role() = 'admin');

-- tipos_gasto: lectura general; escritura admin
CREATE POLICY tipos_gasto_select ON tipos_gasto FOR SELECT USING (public.is_authenticated());
CREATE POLICY tipos_gasto_admin_write ON tipos_gasto FOR ALL USING (public.auth_role() = 'admin') WITH CHECK (public.auth_role() = 'admin');

-- gastos: admin-only (MVP). Cambiar en V2 si se decide exponer a operadores.
CREATE POLICY gastos_admin_all ON gastos FOR ALL USING (public.auth_role() = 'admin') WITH CHECK (public.auth_role() = 'admin');

-- notificaciones: lectura/escritura operativa, delete admin
CREATE POLICY notificaciones_select ON notificaciones FOR SELECT USING (public.is_authenticated());
CREATE POLICY notificaciones_insert ON notificaciones FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_update ON notificaciones FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_delete_admin ON notificaciones FOR DELETE USING (public.auth_role() = 'admin');

CREATE POLICY notificaciones_venta_all ON notificaciones_venta FOR ALL USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_servicio_all ON notificaciones_servicio FOR ALL USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_reposo_all ON notificaciones_reposo FOR ALL USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());

-- activity_log: insert + select; sin update/delete (la auditoria es inmutable)
CREATE POLICY activity_log_select ON activity_log FOR SELECT USING (public.is_authenticated());
CREATE POLICY activity_log_insert ON activity_log FOR INSERT WITH CHECK (public.is_authenticated());

-- templates / template_placeholders
CREATE POLICY templates_select ON templates FOR SELECT USING (public.is_authenticated());
CREATE POLICY templates_insert ON templates FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY templates_update ON templates FOR UPDATE USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());
CREATE POLICY templates_delete_admin ON templates FOR DELETE USING (public.auth_role() = 'admin');

CREATE POLICY template_placeholders_all ON template_placeholders FOR ALL USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());

-- config: lectura general; escritura admin
CREATE POLICY config_select ON config FOR SELECT USING (public.is_authenticated());
CREATE POLICY config_admin_write ON config FOR ALL USING (public.auth_role() = 'admin') WITH CHECK (public.auth_role() = 'admin');

-- dashboard_stats: lectura general; escritura via edge function (service_role bypassa RLS)
CREATE POLICY dashboard_stats_select ON dashboard_stats FOR SELECT USING (public.is_authenticated());
CREATE POLICY dashboard_stats_admin_write ON dashboard_stats FOR ALL USING (public.auth_role() = 'admin') WITH CHECK (public.auth_role() = 'admin');

-- legacy_orphan_records: solo admin
CREATE POLICY legacy_orphan_admin_all ON legacy_orphan_records FOR ALL USING (public.auth_role() = 'admin') WITH CHECK (public.auth_role() = 'admin');
