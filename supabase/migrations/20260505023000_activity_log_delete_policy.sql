-- ============================================================================
-- activity_log delete policy
--
-- La UI de /log-actividad permite limpiar registros seleccionados o antiguos.
-- La policy inicial solo permitia SELECT/INSERT, por lo que el borrado fallaba
-- desde el cliente autenticado.
-- ============================================================================

CREATE POLICY activity_log_delete ON activity_log
  FOR DELETE
  USING (public.is_authenticated());
