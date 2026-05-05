-- ============================================================================
-- V2 RLS cleanup
--
-- Split broad notification policies into explicit actions, remove recursive
-- profile self-checks, and make activity-log deletion admin-only.
-- ============================================================================

DROP POLICY IF EXISTS profiles_update_self_no_role ON profiles;
CREATE POLICY profiles_update_self_no_role ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.auth_role()
  );

DROP POLICY IF EXISTS activity_log_delete ON activity_log;
CREATE POLICY activity_log_delete_admin ON activity_log
  FOR DELETE
  USING (public.auth_role() = 'admin');

DROP POLICY IF EXISTS notificaciones_delete_admin ON notificaciones;
CREATE POLICY notificaciones_delete ON notificaciones
  FOR DELETE
  USING (public.is_authenticated());

DROP POLICY IF EXISTS notificaciones_venta_all ON notificaciones_venta;
CREATE POLICY notificaciones_venta_select ON notificaciones_venta
  FOR SELECT
  USING (public.is_authenticated());
CREATE POLICY notificaciones_venta_insert ON notificaciones_venta
  FOR INSERT
  WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_venta_update ON notificaciones_venta
  FOR UPDATE
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_venta_delete ON notificaciones_venta
  FOR DELETE
  USING (public.is_authenticated());

DROP POLICY IF EXISTS notificaciones_servicio_all ON notificaciones_servicio;
CREATE POLICY notificaciones_servicio_select ON notificaciones_servicio
  FOR SELECT
  USING (public.is_authenticated());
CREATE POLICY notificaciones_servicio_insert ON notificaciones_servicio
  FOR INSERT
  WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_servicio_update ON notificaciones_servicio
  FOR UPDATE
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_servicio_delete ON notificaciones_servicio
  FOR DELETE
  USING (public.is_authenticated());

DROP POLICY IF EXISTS notificaciones_reposo_all ON notificaciones_reposo;
CREATE POLICY notificaciones_reposo_select ON notificaciones_reposo
  FOR SELECT
  USING (public.is_authenticated());
CREATE POLICY notificaciones_reposo_insert ON notificaciones_reposo
  FOR INSERT
  WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_reposo_update ON notificaciones_reposo
  FOR UPDATE
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());
CREATE POLICY notificaciones_reposo_delete ON notificaciones_reposo
  FOR DELETE
  USING (public.is_authenticated());
