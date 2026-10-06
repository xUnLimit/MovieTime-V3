-- Registra mt_delete_order, mt_register_order_payment y mt_mark_order_delivered (acciones manuales de pedidos) en la auditoria de seguridad: RPC administrativas SECURITY DEFINER con grants minimos.
BEGIN;
CREATE OR REPLACE FUNCTION public.run_security_audit_validations()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  WITH app_tables(table_name) AS (
    VALUES
      ('usuarios'), ('servicios'), ('servicio_periodos'), ('pagos_servicio'),
      ('categorias'), ('planes'), ('planes_tipos'), ('metodos_pago'),
      ('ventas'), ('venta_periodos'), ('pagos_venta'), ('gastos'),
      ('tipos_gasto'), ('templates'), ('activity_log'), ('config'),
      ('notificaciones'), ('notificaciones_venta'),
      ('notificaciones_servicio'), ('notificaciones_reposo'),
      ('yappy_mail_sync_state'), ('yappy_mail_messages'), ('yappy_payments'),
      ('netflix_code_claims'), ('whatsapp_bot_config'), ('whatsapp_bot_versions'), ('whatsapp_bot_events'),
      ('pedidos'), ('pedido_items'), ('pedido_pagos'), ('pedido_operaciones'), ('pedido_excedentes'), ('pedido_exceso_resoluciones'), ('pedido_resoluciones'), ('mt_order_deliveries'),
      ('reservas_perfil'), ('intereses'), ('domain_events'), ('whatsapp_conversation_state'), ('whatsapp_automation_inbox'),
      ('mt_service_access'), ('mt_automation_settings'), ('mt_ai_budget'), ('mt_integration_deliveries'), ('mt_integration_limits'), ('mt_interest_deliveries'),
      ('mt_commerce_copy')
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
      ('upsert_notification_aggregate'),
      ('resolve_yappy_payment'),
      ('dismiss_yappy_payment'),
      ('hide_whatsapp_message'),
      ('is_authenticated'),
      ('publish_whatsapp_bot_version'),
      ('set_whatsapp_bot_enabled'),
      ('mt_panel_checkout'), ('mt_list_orders'), ('mt_order_command'), ('mt_reconcile_order'), ('mt_resolve_excess'),
      ('set_whatsapp_conversation_mode'), ('resolve_whatsapp_automation_review'), ('mt_set_service_access'), ('mt_update_automation_settings'), ('mt_manage_interest'),
      ('mt_claim_order_delivery'), ('mt_order_delivery_access'), ('mt_finish_order_delivery'), ('mt_retry_order_delivery'),
      ('mt_order_resolution_quote'), ('mt_resolve_order'),
      ('mt_set_commerce_copy'),
      ('mt_delete_order'), ('mt_register_order_payment'), ('mt_mark_order_delivered')
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
      ('upsert_notification_aggregate'),
      ('hide_whatsapp_message'),
      ('mt_panel_checkout'), ('mt_list_orders'), ('mt_order_command'), ('mt_reconcile_order'), ('mt_resolve_excess'),
      ('set_whatsapp_conversation_mode'), ('resolve_whatsapp_automation_review'), ('mt_set_service_access'), ('mt_update_automation_settings'), ('mt_manage_interest'),
      ('mt_claim_order_delivery'), ('mt_order_delivery_access'), ('mt_finish_order_delivery'), ('mt_retry_order_delivery'),
      ('mt_order_resolution_quote'), ('mt_resolve_order'),
      ('mt_set_commerce_copy'),
      ('mt_delete_order'), ('mt_register_order_payment'), ('mt_mark_order_delivered')
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
$function$
;
REVOKE ALL ON FUNCTION public.run_security_audit_validations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_audit_validations() TO service_role, postgres;
COMMIT;
