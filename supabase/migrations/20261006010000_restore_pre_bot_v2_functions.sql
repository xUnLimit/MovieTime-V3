-- Vuelve el comportamiento de la base de datos al del commit d76a0ab (antes del bot v2).
-- Forward-only y no destructiva: restaura las definiciones anteriores de funciones y quita
-- los triggers y tareas de cron del bot v2. NO elimina tablas, columnas ni datos; las tablas
-- nuevas quedan sin uso por la aplicacion. Las vistas nuevas solo agregan columnas, de modo
-- que el codigo anterior sigue funcionando. Generada comparando el esquema completo.
-- Se conservan tres funciones porque restricciones de tablas nuevas aun dependen de ellas:
-- private.valid_conversation_awaiting, private.valid_conversation_variables y
-- public.normalize_panama_wa_id.

DO $cron$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job
      WHERE jobname IN ('domain-events-dispatch-tick', 'whatsapp-inbound-retry-tick');
  END IF;
END
$cron$;

drop trigger if exists "catalogo_config_validar" on "public"."catalogo_config";

drop trigger if exists "categorias_validate_code_provider" on "public"."categorias";

drop trigger if exists "intereses_validar" on "public"."intereses";

drop trigger if exists "pedido_pago_ajustes_updated_at" on "public"."pedido_pago_ajustes";

drop trigger if exists "pedidos_updated_at" on "public"."pedidos";

drop trigger if exists "emit_servicio_credenciales_cambiadas" on "public"."servicios";

drop trigger if exists "servicios_validate_code_access" on "public"."servicios";

drop trigger if exists "catalogo_proteger_reserva" on "public"."ventas";

drop trigger if exists "emit_venta_creada" on "public"."ventas";

drop trigger if exists "emit_venta_transferida" on "public"."ventas";

drop function if exists "private"."catalogo_proteger_reserva"();

drop function if exists "private"."catalogo_validar_plan"();

drop function if exists "private"."cerrar_intento_comprobante"(p_key uuid, p_pedido uuid, p_wa text, p_code text, p_resultado text, p_pendiente boolean, p_reintento boolean, p_respuesta jsonb);

drop function if exists "private"."finalizar_pedido_pagado"(p_pedido uuid, p_paid numeric);

drop function if exists "private"."preparar_pedido_compra"(p_pedido uuid);

drop function if exists "public"."aplicar_pedido_item"(p_item uuid, p_pedido uuid);

drop function if exists "public"."cancelar_pedido"(p_pedido_id uuid, p_idempotency_key uuid);

drop function if exists "public"."catalogo_disponible"();

drop function if exists "public"."cerrar_recordatorio_pedido"(p_pedido_id uuid, p_estado text, p_motivo text);

drop function if exists "public"."claim_domain_events"(p_limit integer, p_lock_seconds integer);

drop function if exists "public"."claim_whatsapp_inbound_batch"(p_limit integer, p_lock_seconds integer);

drop function if exists "public"."confirmar_pedido"(p_panel_pedidos jsonb, p_idempotency_key uuid);

drop function if exists "public"."confirmar_pedido"(p_pedido_id uuid, p_idempotency_key uuid, p_source text, p_monto numeric, p_yappy_payment_id uuid);

drop function if exists "public"."crear_pedido"(p_tercero_id text, p_contact_id text, p_canal text, p_moneda text, p_items jsonb, p_expira_at timestamp with time zone, p_exchange_rate numeric, p_idempotency_key uuid);

drop function if exists "public"."crear_pedido_compra_bot"(p_wa_id text, p_plan_ids text[], p_idempotency_key uuid);

drop function if exists "public"."crear_pedido_renovacion"(p_tercero_id text, p_contact_id text, p_canal text, p_moneda text, p_items jsonb, p_expira_at timestamp with time zone, p_exchange_rate numeric, p_idempotency_key uuid, p_notice_id uuid, p_wa_id text, p_expected jsonb);

drop function if exists "public"."create_servicio_with_code_access"(p_acceso_por_codigo boolean, p_categoria_id text, p_plan_tipo_id text, p_nombre text, p_correo text, p_contrasena text, p_perfiles_disponibles integer, p_perfiles_ocupados integer, p_activo boolean, p_en_reposo boolean, p_dias_reposo integer, p_fecha_inicio_reposo date, p_fecha_fin_reposo date, p_notas text, p_fecha_inicio date, p_fecha_vencimiento date, p_ciclo_pago ciclo_pago_enum, p_costo_original numeric, p_moneda_original text, p_costo_usd numeric, p_exchange_rate numeric, p_renovacion_automatica boolean, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone, p_pago_notas text, p_created_by uuid, p_idempotency_key uuid);

drop function if exists "public"."credenciales_venta_bot"(p_wa_id text, p_venta_id text);

drop function if exists "public"."emit_domain_event"(p_type text, p_aggregate_type text, p_aggregate_id text, p_payload jsonb);

drop function if exists "public"."emit_servicio_credenciales_cambiadas"();

drop function if exists "public"."emit_venta_creada"();

drop function if exists "public"."emit_venta_transferida"();

drop function if exists "public"."expirar_pedidos"();

drop function if exists "public"."expirar_reservas"();

drop function if exists "public"."finish_domain_event"(p_id uuid, p_error text);

drop function if exists "public"."finish_whatsapp_inbound"(p_id uuid, p_error text);

drop function if exists "public"."hand_back_conversation"(p_wa_id text);

drop function if exists "public"."liberar_compra_bot"(p_wa_id text, p_pedido_id uuid);

drop function if exists "public"."liberar_reserva"(p_reserva_id uuid, p_owner_ref text);

drop function if exists "public"."listar_comprobantes_pendientes"(p_limit integer);

drop function if exists "public"."obtener_ajustes_compra_bot"();

drop function if exists "public"."obtener_ajustes_pago_bot"();

drop function if exists "public"."obtener_pedido_para_bot"(p_pedido_id uuid);

drop function if exists "public"."pedido_intent"(p_rpc text, p_key uuid);

drop function if exists "public"."reclamar_pago_yappy_para_pedido"(p_pedido_id uuid, p_confirmation_code text, p_idempotency_key uuid, p_wa_id text, p_reintento boolean);

drop function if exists "public"."reclamar_recordatorios_pedido"(p_limit integer);

drop function if exists "public"."registrar_interes"(p_contact_id text, p_categoria_id text, p_plan_id text, p_origen text);

drop function if exists "public"."reservar_perfil"(p_servicio_id text, p_owner_ref text, p_plan_id text);

drop function if exists "public"."reservar_perfil_para_plan"(p_wa_id text, p_plan_id text);

drop function if exists "public"."set_conversation_state"(p_wa_id text, p_expected_revision integer, p_state jsonb, p_expires_at timestamp with time zone);

drop function if exists "public"."siguiente_interesado"(p_categoria_id text, p_plan_id text);

drop function if exists "public"."take_over_conversation"(p_wa_id text);

drop function if exists "public"."trigger_domain_events_dispatch"();

drop function if exists "public"."trigger_whatsapp_inbound_retries"();

drop function if exists "public"."upsert_whatsapp_contact"(p_wa_id text, p_nombre_perfil text);

drop function if exists "public"."validate_category_code_provider"();

drop function if exists "public"."validate_service_code_access"();

drop function if exists "public"."ventas_pedido_bot"(p_wa_id text, p_pedido_id uuid);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.auth_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT u.role FROM public.usuarios AS u
  WHERE u.id = (SELECT auth.uid()) AND u.active
$function$
;

CREATE OR REPLACE FUNCTION private.mark_dashboard_read_model_dirty()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public', 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO private.dashboard_read_model_state (
    id,
    dirty,
    dirty_reason,
    dirty_since,
    updated_at
  )
  VALUES (
    'dashboard',
    true,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET dirty = true,
      dirty_reason = EXCLUDED.dirty_reason,
      dirty_since = COALESCE(private.dashboard_read_model_state.dirty_since, EXCLUDED.dirty_since),
      updated_at = now();

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assert_notification_integrity(p_notification_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.chat_saved_message_options_valid(payload jsonb, message_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE
  item JSONB;
  item_title TEXT;
  seen_titles TEXT[] := ARRAY[]::TEXT[];
  max_title_length INTEGER;
  max_description_length INTEGER;
BEGIN
  IF jsonb_typeof(payload) <> 'array' THEN RETURN FALSE; END IF;
  IF message_kind = 'text' THEN RETURN jsonb_array_length(payload) = 0; END IF;

  IF message_kind = 'buttons' THEN
    max_title_length := 20;
    max_description_length := 0;
  ELSE
    max_title_length := 24;
    max_description_length := 72;
  END IF;

  FOR item IN SELECT jsonb_array_elements(payload) LOOP
    IF jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item -> 'title') <> 'string'
      OR jsonb_typeof(item -> 'description') <> 'string' THEN
      RETURN FALSE;
    END IF;
    item_title := btrim(item ->> 'title');
    IF char_length(item_title) NOT BETWEEN 1 AND max_title_length
      OR lower(item_title) = ANY(seen_titles)
      OR char_length(item ->> 'description') > max_description_length THEN
      RETURN FALSE;
    END IF;
    seen_titles := array_append(seen_titles, lower(item_title));
  END LOOP;
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_doble_venta_perfil()
 RETURNS TABLE(servicio_id text, perfil_numero integer, conteo bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT v.servicio_id, v.perfil_numero, COUNT(*)
  FROM ventas v
  WHERE v.estado = 'activo'
    AND v.archivado_at IS NULL
    AND v.perfil_numero IS NOT NULL
  GROUP BY v.servicio_id, v.perfil_numero
  HAVING COUNT(*) > 1;
$function$
;

CREATE OR REPLACE FUNCTION public.check_pagos_servicio_sin_periodo()
 RETURNS TABLE(pago_id text, servicio_periodo_id text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT ps.id, ps.servicio_periodo_id
  FROM pagos_servicio ps
  LEFT JOIN servicio_periodos sp ON sp.id = ps.servicio_periodo_id
  WHERE sp.id IS NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.check_pagos_venta_sin_periodo()
 RETURNS TABLE(pago_id text, venta_periodo_id text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT pv.id, pv.venta_periodo_id
  FROM pagos_venta pv
  LEFT JOIN venta_periodos vp ON vp.id = pv.venta_periodo_id
  WHERE vp.id IS NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.check_perfiles_ocupados_inconsistentes()
 RETURNS TABLE(servicio_id text, perfiles_ocupados_actual integer, perfiles_ocupados_real bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    s.id,
    s.perfiles_ocupados,
    COUNT(v.id)
  FROM servicios s
  LEFT JOIN ventas v
    ON v.servicio_id = s.id
    AND v.estado = 'activo'
    AND v.archivado_at IS NULL
    AND v.perfil_numero IS NOT NULL
  GROUP BY s.id
  HAVING s.perfiles_ocupados <> COUNT(v.id);
$function$
;

CREATE OR REPLACE FUNCTION public.check_periodos_servicio_saldo_distinto()
 RETURNS TABLE(servicio_periodo_id text, servicio_id text, costo_usd numeric, pagado_usd numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    sp.id,
    sp.servicio_id,
    sp.costo_usd,
    COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0)
  FROM servicio_periodos sp
  LEFT JOIN pagos_servicio ps ON ps.servicio_periodo_id = sp.id
  GROUP BY sp.id
  HAVING COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) <> sp.costo_usd;
$function$
;

CREATE OR REPLACE FUNCTION public.check_periodos_venta_saldo_distinto()
 RETURNS TABLE(venta_periodo_id text, venta_id text, total_usd numeric, pagado_usd numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    vp.id,
    vp.venta_id,
    vp.total_usd,
    COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0)
  FROM venta_periodos vp
  LEFT JOIN pagos_venta pv ON pv.venta_periodo_id = vp.id
  GROUP BY vp.id
  HAVING COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) <> vp.total_usd;
$function$
;

CREATE OR REPLACE FUNCTION public.check_servicios_archivados_activos()
 RETURNS TABLE(servicio_id text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT id
  FROM servicios
  WHERE archivado_at IS NOT NULL
    AND activo = true;
$function$
;

CREATE OR REPLACE FUNCTION public.check_ventas_archivadas_activas()
 RETURNS TABLE(venta_id text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT id
  FROM ventas
  WHERE archivado_at IS NOT NULL
    AND estado = 'activo';
$function$
;

CREATE OR REPLACE FUNCTION public.check_ventas_categoria_inconsistente()
 RETURNS TABLE(venta_id text, venta_categoria_id text, servicio_categoria_id text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT v.id, v.categoria_id, s.categoria_id
  FROM ventas v
  JOIN servicios s ON s.id = v.servicio_id
  WHERE v.categoria_id <> s.categoria_id;
$function$
;

CREATE OR REPLACE FUNCTION public.check_ventas_sin_servicio()
 RETURNS TABLE(venta_id text, servicio_id text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT v.id, v.servicio_id
  FROM ventas v
  LEFT JOIN servicios s ON s.id = v.servicio_id
  WHERE s.id IS NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_executive_push_due()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_config public.config%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_local_now TIMESTAMP;
  v_today TEXT;
  v_current_minutes INTEGER;
  v_current_extended_minutes INTEGER;
  v_window_start_minutes INTEGER;
  v_window_end_minutes INTEGER;
  v_interval_hours INTEGER;
  v_step_minutes INTEGER;
  v_scheduled_minutes INTEGER;
  v_scheduled_extended_minutes INTEGER;
  v_slot_date TEXT;
  v_slot_key TEXT;
  v_last_sent_at TIMESTAMPTZ;
  v_run_id UUID;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('executive_push_due_claim')) THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_config
  FROM public.config
  WHERE id = 'global'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.executive_push_runs(status, reason, finished_at)
    VALUES ('skipped', 'missing_config', v_now)
    RETURNING id INTO v_run_id;
    RETURN NULL;
  END IF;

  IF NOT COALESCE(v_config.executive_push_enabled, false) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.executive_push_runs
    WHERE status IN ('claimed', 'running')
      AND claimed_at > v_now - INTERVAL '20 minutes'
  ) THEN
    RETURN NULL;
  END IF;

  v_local_now := v_now AT TIME ZONE COALESCE(NULLIF(v_config.executive_push_timezone, ''), 'America/Bogota');
  v_today := to_char(v_local_now::date, 'YYYY-MM-DD');
  v_current_minutes := EXTRACT(HOUR FROM v_local_now)::INTEGER * 60
    + EXTRACT(MINUTE FROM v_local_now)::INTEGER;

  IF COALESCE(v_config.executive_push_window_start, '') !~ '^\d{2}:\d{2}$'
    OR COALESCE(v_config.executive_push_window_end, '') !~ '^\d{2}:\d{2}$'
  THEN
    INSERT INTO public.executive_push_runs(status, reason, finished_at)
    VALUES ('skipped', 'invalid_time', v_now)
    RETURNING id INTO v_run_id;
    RETURN NULL;
  END IF;

  v_window_start_minutes := split_part(v_config.executive_push_window_start, ':', 1)::INTEGER * 60
    + split_part(v_config.executive_push_window_start, ':', 2)::INTEGER;
  v_window_end_minutes := split_part(v_config.executive_push_window_end, ':', 1)::INTEGER * 60
    + split_part(v_config.executive_push_window_end, ':', 2)::INTEGER;

  IF v_window_start_minutes < 0 OR v_window_start_minutes > 1439
    OR v_window_end_minutes < 0 OR v_window_end_minutes > 1439
    OR v_window_start_minutes = v_window_end_minutes
  THEN
    INSERT INTO public.executive_push_runs(status, reason, finished_at)
    VALUES ('skipped', 'invalid_time', v_now)
    RETURNING id INTO v_run_id;
    RETURN NULL;
  END IF;

  IF NOT (
    CASE
      WHEN v_window_start_minutes < v_window_end_minutes THEN
        v_current_minutes >= v_window_start_minutes AND v_current_minutes < v_window_end_minutes
      ELSE
        v_current_minutes >= v_window_start_minutes OR v_current_minutes < v_window_end_minutes
    END
  ) THEN
    RETURN NULL;
  END IF;

  v_interval_hours := COALESCE(v_config.executive_push_interval_hours, 24);
  IF v_interval_hours < 1 OR v_interval_hours > 24 THEN
    INSERT INTO public.executive_push_runs(status, reason, finished_at)
    VALUES ('skipped', 'invalid_interval', v_now)
    RETURNING id INTO v_run_id;
    RETURN NULL;
  END IF;

  v_step_minutes := v_interval_hours * 60;

  IF v_window_start_minutes < v_window_end_minutes THEN
    v_scheduled_minutes := v_window_start_minutes
      + floor((v_current_minutes - v_window_start_minutes)::numeric / v_step_minutes)::INTEGER * v_step_minutes;
    v_slot_date := v_today;
  ELSE
    v_current_extended_minutes := CASE
      WHEN v_current_minutes >= v_window_start_minutes THEN v_current_minutes
      ELSE v_current_minutes + 1440
    END;
    v_scheduled_extended_minutes := v_window_start_minutes
      + floor((v_current_extended_minutes - v_window_start_minutes)::numeric / v_step_minutes)::INTEGER * v_step_minutes;
    v_scheduled_minutes := v_scheduled_extended_minutes % 1440;
    v_slot_date := CASE
      WHEN v_scheduled_extended_minutes >= 1440 THEN v_today
      WHEN v_current_minutes < v_window_end_minutes THEN to_char((v_local_now::date - INTERVAL '1 day')::date, 'YYYY-MM-DD')
      ELSE v_today
    END;
  END IF;

  v_slot_key := v_slot_date || 'T' ||
    lpad((v_scheduled_minutes / 60)::TEXT, 2, '0') || ':' ||
    lpad((v_scheduled_minutes % 60)::TEXT, 2, '0');

  IF v_config.executive_push_last_sent_slot = v_slot_key THEN
    RETURN NULL;
  END IF;

  v_last_sent_at := v_config.executive_push_last_sent_at;
  IF v_config.executive_push_last_sent_slot IS NULL
    AND v_last_sent_at IS NOT NULL
    AND v_now < v_last_sent_at + make_interval(hours => v_interval_hours)
  THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.executive_push_runs(status, metadata)
  VALUES (
    'claimed',
    jsonb_build_object(
      'today', v_today,
      'timezone', COALESCE(NULLIF(v_config.executive_push_timezone, ''), 'America/Bogota'),
      'current_minutes', v_current_minutes,
      'window_start_minutes', v_window_start_minutes,
      'window_end_minutes', v_window_end_minutes,
      'interval_hours', v_interval_hours,
      'scheduled_minutes', v_scheduled_minutes,
      'slot_key', v_slot_key
    )
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_netflix_code(p_mail_key text, p_wa_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_owner text;
BEGIN
  IF p_mail_key IS NULL OR p_mail_key !~ '^[0-9a-f]{64}$'
    OR p_wa_id IS NULL OR length(p_wa_id) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'invalid netflix code claim';
  END IF;

  -- Los codigos vencen en minutos: limpiar lo antiguo mantiene la tabla pequena sin un cron.
  DELETE FROM public.netflix_code_claims WHERE created_at < now() - interval '2 days';

  INSERT INTO public.netflix_code_claims (mail_key, wa_id)
  VALUES (p_mail_key, p_wa_id)
  ON CONFLICT (mail_key) DO NOTHING;
  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT c.wa_id INTO v_owner FROM public.netflix_code_claims c WHERE c.mail_key = p_mail_key;
  IF v_owner = p_wa_id THEN
    RETURN 'mine';
  END IF;
  RETURN 'taken';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_notice_reply(p_notice_id uuid, p_action text, p_inbound_wa_message_id text)
 RETURNS TABLE(reply_id bigint, attempts integer, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_reply public.whatsapp_notice_replies%ROWTYPE;
BEGIN
  IF p_action NOT IN ('RENOVAR', 'NO_CONTINUAR', 'DATOS')
    OR p_inbound_wa_message_id IS NULL OR length(p_inbound_wa_message_id) > 256 THEN
    RAISE EXCEPTION 'invalid notice reply claim';
  END IF;

  INSERT INTO public.whatsapp_notice_replies
    (notice_id, action, inbound_wa_message_id, result, attempts, locked_until)
  VALUES (p_notice_id, p_action, p_inbound_wa_message_id,
    'processing', 1, now() + interval '5 minutes')
  ON CONFLICT (notice_id, action) DO NOTHING
  RETURNING * INTO v_reply;
  IF FOUND THEN
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'claimed'::text;
    RETURN;
  END IF;

  SELECT * INTO v_reply FROM public.whatsapp_notice_replies r
    WHERE r.notice_id = p_notice_id AND r.action = p_action FOR UPDATE;
  IF v_reply.inbound_wa_message_id <> p_inbound_wa_message_id OR v_reply.result = 'accepted' THEN
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'duplicate'::text;
  ELSIF v_reply.result IN ('uncertain', 'pending') THEN
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'uncertain'::text;
  ELSIF v_reply.attempts >= 5 THEN
    IF v_reply.result = 'processing' AND v_reply.locked_until <= now() THEN
      UPDATE public.whatsapp_notice_replies r SET result = 'failed',
        locked_until = NULL, next_attempt_at = NULL, last_error = 'ATTEMPTS_EXHAUSTED'
        WHERE r.id = v_reply.id;
    END IF;
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'exhausted'::text;
  ELSIF (v_reply.result = 'processing' AND v_reply.locked_until > now())
    OR (v_reply.result = 'failed' AND v_reply.next_attempt_at > now()) THEN
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'busy'::text;
  ELSE
    UPDATE public.whatsapp_notice_replies r SET result = 'processing',
      attempts = r.attempts + 1, locked_until = now() + interval '5 minutes',
      next_attempt_at = NULL, last_error = NULL
      WHERE r.id = v_reply.id RETURNING * INTO v_reply;
    RETURN QUERY SELECT v_reply.id, v_reply.attempts, 'claimed'::text;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_yappy_mail_sync()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_id boolean;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.yappy_mail_sync_state SET sync_locked_until = now() + interval '5 minutes'
  WHERE id AND (sync_locked_until IS NULL OR sync_locked_until < now())
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_servicio_payment(p_servicio_id text, p_categoria_id_snapshot text, p_fecha_inicio date, p_fecha_vencimiento date, p_ciclo_pago ciclo_pago_enum, p_costo_original numeric, p_moneda_original text, p_costo_usd numeric, p_exchange_rate numeric, p_renovacion_automatica boolean, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero_periodo INTEGER;
  v_periodo_id TEXT;
  v_pago_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_servicio_id, 0));

  SELECT COALESCE(MAX(numero_periodo), 0) + 1
    INTO v_numero_periodo
  FROM servicio_periodos
  WHERE servicio_id = p_servicio_id;

  INSERT INTO servicio_periodos (
    servicio_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_vencimiento,
    ciclo_pago,
    costo_original,
    moneda_original,
    costo_usd,
    exchange_rate,
    renovacion_automatica,
    created_by
  )
  VALUES (
    p_servicio_id,
    v_numero_periodo,
    CASE WHEN v_numero_periodo = 1 THEN 'inicial'::periodo_tipo_enum ELSE 'renovacion'::periodo_tipo_enum END,
    p_fecha_inicio,
    p_fecha_vencimiento,
    p_ciclo_pago,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    COALESCE(p_renovacion_automatica, false),
    p_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_servicio (
    servicio_periodo_id,
    servicio_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    categoria_id_snapshot,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    p_servicio_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    NULLIF(p_categoria_id_snapshot, ''),
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    p_created_by
  )
  RETURNING id INTO v_pago_id;

  RETURN v_pago_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_servicio_payment(p_servicio_id text, p_categoria_id_snapshot text, p_fecha_inicio date, p_fecha_vencimiento date, p_ciclo_pago ciclo_pago_enum, p_costo_original numeric, p_moneda_original text, p_costo_usd numeric, p_exchange_rate numeric, p_renovacion_automatica boolean, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid(), p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero_periodo INTEGER;
  v_periodo_id TEXT;
  v_pago_id TEXT;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_servicio_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_servicio_id, 0));

  SELECT COALESCE(MAX(numero_periodo), 0) + 1
    INTO v_numero_periodo
  FROM servicio_periodos
  WHERE servicio_id = p_servicio_id;

  INSERT INTO servicio_periodos (
    servicio_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_vencimiento,
    ciclo_pago,
    costo_original,
    moneda_original,
    costo_usd,
    exchange_rate,
    renovacion_automatica,
    created_by
  )
  VALUES (
    p_servicio_id,
    v_numero_periodo,
    CASE WHEN v_numero_periodo = 1 THEN 'inicial'::periodo_tipo_enum ELSE 'renovacion'::periodo_tipo_enum END,
    p_fecha_inicio,
    p_fecha_vencimiento,
    p_ciclo_pago,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    COALESCE(p_renovacion_automatica, false),
    v_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_servicio (
    servicio_periodo_id,
    servicio_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    categoria_id_snapshot,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    p_servicio_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    NULLIF(p_categoria_id_snapshot, ''),
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    v_created_by
  )
  RETURNING id INTO v_pago_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_servicio_payment', v_pago_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_pago_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_servicio_with_initial_payment(p_categoria_id text, p_plan_tipo_id text, p_nombre text, p_correo text, p_contrasena text, p_perfiles_disponibles integer, p_perfiles_ocupados integer, p_activo boolean, p_en_reposo boolean, p_dias_reposo integer, p_fecha_inicio_reposo date, p_fecha_fin_reposo date, p_notas text, p_fecha_inicio date, p_fecha_vencimiento date, p_ciclo_pago ciclo_pago_enum, p_costo_original numeric, p_moneda_original text, p_costo_usd numeric, p_exchange_rate numeric, p_renovacion_automatica boolean, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_servicio_id TEXT;
  v_periodo_id TEXT;
BEGIN
  INSERT INTO servicios (
    categoria_id,
    plan_tipo_id,
    nombre,
    correo,
    contrasena,
    perfiles_disponibles,
    perfiles_ocupados,
    activo,
    en_reposo,
    dias_reposo,
    fecha_inicio_reposo,
    fecha_fin_reposo,
    notas,
    created_by
  )
  VALUES (
    p_categoria_id,
    NULLIF(p_plan_tipo_id, ''),
    p_nombre,
    p_correo,
    p_contrasena,
    COALESCE(p_perfiles_disponibles, 0),
    COALESCE(p_perfiles_ocupados, 0),
    COALESCE(p_activo, true),
    COALESCE(p_en_reposo, false),
    p_dias_reposo,
    p_fecha_inicio_reposo,
    p_fecha_fin_reposo,
    NULLIF(p_notas, ''),
    p_created_by
  )
  RETURNING id INTO v_servicio_id;

  INSERT INTO servicio_periodos (
    servicio_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_vencimiento,
    ciclo_pago,
    costo_original,
    moneda_original,
    costo_usd,
    exchange_rate,
    renovacion_automatica,
    created_by
  )
  VALUES (
    v_servicio_id,
    1,
    'inicial'::periodo_tipo_enum,
    p_fecha_inicio,
    p_fecha_vencimiento,
    p_ciclo_pago,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    COALESCE(p_renovacion_automatica, false),
    p_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_servicio (
    servicio_periodo_id,
    servicio_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    categoria_id_snapshot,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    v_servicio_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    p_categoria_id,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    p_created_by
  );

  RETURN v_servicio_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_servicio_with_initial_payment(p_categoria_id text, p_plan_tipo_id text, p_nombre text, p_correo text, p_contrasena text, p_perfiles_disponibles integer, p_perfiles_ocupados integer, p_activo boolean, p_en_reposo boolean, p_dias_reposo integer, p_fecha_inicio_reposo date, p_fecha_fin_reposo date, p_notas text, p_fecha_inicio date, p_fecha_vencimiento date, p_ciclo_pago ciclo_pago_enum, p_costo_original numeric, p_moneda_original text, p_costo_usd numeric, p_exchange_rate numeric, p_renovacion_automatica boolean, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid(), p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_servicio_id TEXT;
  v_periodo_id TEXT;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_servicio_with_initial_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

  INSERT INTO servicios (
    categoria_id,
    plan_tipo_id,
    nombre,
    correo,
    contrasena,
    perfiles_disponibles,
    perfiles_ocupados,
    activo,
    en_reposo,
    dias_reposo,
    fecha_inicio_reposo,
    fecha_fin_reposo,
    notas,
    created_by
  )
  VALUES (
    p_categoria_id,
    NULLIF(p_plan_tipo_id, ''),
    p_nombre,
    p_correo,
    p_contrasena,
    COALESCE(p_perfiles_disponibles, 0),
    COALESCE(p_perfiles_ocupados, 0),
    COALESCE(p_activo, true),
    COALESCE(p_en_reposo, false),
    p_dias_reposo,
    p_fecha_inicio_reposo,
    p_fecha_fin_reposo,
    NULLIF(p_notas, ''),
    v_created_by
  )
  RETURNING id INTO v_servicio_id;

  INSERT INTO servicio_periodos (
    servicio_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_vencimiento,
    ciclo_pago,
    costo_original,
    moneda_original,
    costo_usd,
    exchange_rate,
    renovacion_automatica,
    created_by
  )
  VALUES (
    v_servicio_id,
    1,
    'inicial'::periodo_tipo_enum,
    p_fecha_inicio,
    p_fecha_vencimiento,
    p_ciclo_pago,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    COALESCE(p_renovacion_automatica, false),
    v_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_servicio (
    servicio_periodo_id,
    servicio_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    categoria_id_snapshot,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    v_servicio_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_costo_original,
    p_moneda_original,
    p_costo_usd,
    p_exchange_rate,
    p_categoria_id,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    v_created_by
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_servicio_with_initial_payment', v_servicio_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_servicio_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_venta_payment(p_venta_id text, p_fecha_inicio date, p_fecha_fin date, p_ciclo_pago ciclo_pago_enum, p_precio_original numeric, p_descuento numeric, p_total_original numeric, p_moneda_original text, p_total_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_plan_id text DEFAULT NULL::text, p_plan_nombre_snapshot text DEFAULT NULL::text, p_plan_tipo_nombre_snapshot text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero_periodo INTEGER;
  v_periodo_id TEXT;
  v_pago_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_venta_id, 0));

  SELECT COALESCE(MAX(numero_periodo), 0) + 1
    INTO v_numero_periodo
  FROM venta_periodos
  WHERE venta_id = p_venta_id;

  INSERT INTO venta_periodos (
    venta_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_fin,
    ciclo_pago,
    plan_id,
    plan_nombre_snapshot,
    plan_tipo_nombre_snapshot,
    precio_original,
    descuento,
    total_original,
    moneda_original,
    total_usd,
    exchange_rate,
    created_by
  )
  VALUES (
    p_venta_id,
    v_numero_periodo,
    CASE WHEN v_numero_periodo = 1 THEN 'inicial'::periodo_tipo_enum ELSE 'renovacion'::periodo_tipo_enum END,
    p_fecha_inicio,
    p_fecha_fin,
    p_ciclo_pago,
    NULLIF(p_plan_id, ''),
    COALESCE(NULLIF(p_plan_nombre_snapshot, ''), ''),
    COALESCE(NULLIF(p_plan_tipo_nombre_snapshot, ''), ''),
    p_precio_original,
    COALESCE(p_descuento, 0),
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    p_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    p_venta_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    p_created_by
  )
  RETURNING id INTO v_pago_id;

  RETURN v_pago_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_venta_payment(p_venta_id text, p_fecha_inicio date, p_fecha_fin date, p_ciclo_pago ciclo_pago_enum, p_precio_original numeric, p_descuento numeric, p_total_original numeric, p_moneda_original text, p_total_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_plan_id text DEFAULT NULL::text, p_plan_nombre_snapshot text DEFAULT NULL::text, p_plan_tipo_nombre_snapshot text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid(), p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero_periodo INTEGER;
  v_periodo_id TEXT;
  v_pago_id TEXT;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_venta_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_venta_id, 0));

  SELECT COALESCE(MAX(numero_periodo), 0) + 1
    INTO v_numero_periodo
  FROM venta_periodos
  WHERE venta_id = p_venta_id;

  INSERT INTO venta_periodos (
    venta_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_fin,
    ciclo_pago,
    plan_id,
    plan_nombre_snapshot,
    plan_tipo_nombre_snapshot,
    precio_original,
    descuento,
    total_original,
    moneda_original,
    total_usd,
    exchange_rate,
    created_by
  )
  VALUES (
    p_venta_id,
    v_numero_periodo,
    CASE WHEN v_numero_periodo = 1 THEN 'inicial'::periodo_tipo_enum ELSE 'renovacion'::periodo_tipo_enum END,
    p_fecha_inicio,
    p_fecha_fin,
    p_ciclo_pago,
    NULLIF(p_plan_id, ''),
    COALESCE(NULLIF(p_plan_nombre_snapshot, ''), ''),
    COALESCE(NULLIF(p_plan_tipo_nombre_snapshot, ''), ''),
    p_precio_original,
    COALESCE(p_descuento, 0),
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    v_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    p_venta_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    v_created_by
  )
  RETURNING id INTO v_pago_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_venta_payment', v_pago_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_pago_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_venta_refund(p_venta_id text, p_monto_original numeric, p_moneda_original text, p_monto_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_destino_reembolso text DEFAULT NULL::text, p_fecha_reembolso timestamp with time zone DEFAULT now(), p_nota text DEFAULT NULL::text, p_cortar boolean DEFAULT false, p_motivo_corte text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_periodo_id TEXT;
  v_pago_id TEXT;
  v_disponible_usd NUMERIC;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF COALESCE(p_monto_original, 0) <= 0 OR COALESCE(p_monto_usd, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto del reembolso debe ser mayor a 0.';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_destino_reembolso, '')), '') IS NULL THEN
    RAISE EXCEPTION 'La cuenta destino del cliente es obligatoria.';
  END IF;

  IF COALESCE(p_cortar, false) AND NULLIF(BTRIM(COALESCE(p_motivo_corte, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El motivo de corte es obligatorio.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_venta_id, 1));

  SELECT id
    INTO v_periodo_id
  FROM public.venta_periodos
  WHERE venta_id = p_venta_id
  ORDER BY numero_periodo DESC, fecha_fin DESC, created_at DESC
  LIMIT 1;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'La venta no tiene periodo asociado.';
  END IF;

  SELECT
    COALESCE(SUM(monto_usd) FILTER (WHERE estado = 'registrado'), 0)
      - COALESCE(SUM(monto_usd) FILTER (WHERE estado = 'reembolsado'), 0)
    INTO v_disponible_usd
  FROM public.pagos_venta
  WHERE venta_id = p_venta_id;

  IF p_monto_usd > COALESCE(v_disponible_usd, 0) + 0.0001 THEN
    RAISE EXCEPTION 'El reembolso supera el saldo disponible de la venta.';
  END IF;

  INSERT INTO public.pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    destino_reembolso,
    notas,
    created_by,
    anulada_at,
    anulada_by,
    motivo_anulacion
  )
  VALUES (
    v_periodo_id,
    p_venta_id,
    COALESCE(p_fecha_reembolso, now()),
    'reembolsado'::pago_estado_enum,
    p_monto_original,
    p_moneda_original,
    p_monto_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(BTRIM(p_destino_reembolso), ''),
    NULLIF(p_nota, ''),
    p_created_by,
    now(),
    p_created_by,
    COALESCE(NULLIF(p_motivo_corte, ''), NULLIF(p_nota, ''), 'Reembolso de venta')
  )
  RETURNING id INTO v_pago_id;

  IF COALESCE(p_cortar, false) THEN
    UPDATE public.ventas
    SET
      estado = 'inactivo'::venta_estado_enum,
      cortada_at = COALESCE(cortada_at, now()),
      cortada_by = COALESCE(cortada_by, p_created_by),
      motivo_corte = NULLIF(p_motivo_corte, ''),
      updated_at = now()
    WHERE id = p_venta_id;
  END IF;

  RETURN v_pago_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_venta_refund(p_venta_id text, p_monto_original numeric, p_moneda_original text, p_monto_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_destino_reembolso text DEFAULT NULL::text, p_fecha_reembolso timestamp with time zone DEFAULT now(), p_nota text DEFAULT NULL::text, p_cortar boolean DEFAULT false, p_motivo_corte text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid(), p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_periodo_id TEXT;
  v_pago_id TEXT;
  v_disponible_usd NUMERIC;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_venta_refund'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

  IF COALESCE(p_monto_original, 0) <= 0 OR COALESCE(p_monto_usd, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto del reembolso debe ser mayor a 0.';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_destino_reembolso, '')), '') IS NULL THEN
    RAISE EXCEPTION 'La cuenta destino del cliente es obligatoria.';
  END IF;

  IF COALESCE(p_cortar, false) AND NULLIF(BTRIM(COALESCE(p_motivo_corte, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El motivo de corte es obligatorio.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_venta_id, 1));

  SELECT id
    INTO v_periodo_id
  FROM public.venta_periodos
  WHERE venta_id = p_venta_id
  ORDER BY numero_periodo DESC, fecha_fin DESC, created_at DESC
  LIMIT 1;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'La venta no tiene periodo asociado.';
  END IF;

  SELECT
    COALESCE(SUM(monto_usd) FILTER (WHERE estado = 'registrado'), 0)
      - COALESCE(SUM(monto_usd) FILTER (WHERE estado = 'reembolsado'), 0)
    INTO v_disponible_usd
  FROM public.pagos_venta
  WHERE venta_id = p_venta_id;

  IF p_monto_usd > COALESCE(v_disponible_usd, 0) + 0.0001 THEN
    RAISE EXCEPTION 'El reembolso supera el saldo disponible de la venta.';
  END IF;

  INSERT INTO public.pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    destino_reembolso,
    notas,
    created_by,
    anulada_at,
    anulada_by,
    motivo_anulacion
  )
  VALUES (
    v_periodo_id,
    p_venta_id,
    COALESCE(p_fecha_reembolso, now()),
    'reembolsado'::pago_estado_enum,
    p_monto_original,
    p_moneda_original,
    p_monto_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(BTRIM(p_destino_reembolso), ''),
    NULLIF(p_nota, ''),
    v_created_by,
    now(),
    v_created_by,
    COALESCE(NULLIF(p_motivo_corte, ''), NULLIF(p_nota, ''), 'Reembolso de venta')
  )
  RETURNING id INTO v_pago_id;

  IF COALESCE(p_cortar, false) THEN
    UPDATE public.ventas
    SET
      estado = 'inactivo'::venta_estado_enum,
      cortada_at = COALESCE(cortada_at, now()),
      cortada_by = COALESCE(cortada_by, v_created_by),
      motivo_corte = NULLIF(p_motivo_corte, ''),
      updated_at = now()
    WHERE id = p_venta_id;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_venta_refund', v_pago_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_pago_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_venta_with_initial_payment(p_cliente_id text, p_servicio_id text, p_categoria_id text, p_estado venta_estado_enum, p_perfil_numero integer, p_perfil_nombre text, p_codigo text, p_notas text, p_fecha_inicio date, p_fecha_fin date, p_ciclo_pago ciclo_pago_enum, p_precio_original numeric, p_descuento numeric, p_total_original numeric, p_moneda_original text, p_total_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_plan_id text DEFAULT NULL::text, p_plan_nombre_snapshot text DEFAULT NULL::text, p_plan_tipo_nombre_snapshot text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_venta_id TEXT;
  v_periodo_id TEXT;
BEGIN
  INSERT INTO ventas (
    cliente_id,
    servicio_id,
    categoria_id,
    estado,
    perfil_numero,
    perfil_nombre,
    codigo,
    notas,
    created_by
  )
  VALUES (
    NULLIF(p_cliente_id, ''),
    p_servicio_id,
    p_categoria_id,
    COALESCE(p_estado, 'activo'::venta_estado_enum),
    p_perfil_numero,
    NULLIF(p_perfil_nombre, ''),
    NULLIF(p_codigo, ''),
    NULLIF(p_notas, ''),
    p_created_by
  )
  RETURNING id INTO v_venta_id;

  INSERT INTO venta_periodos (
    venta_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_fin,
    ciclo_pago,
    plan_id,
    plan_nombre_snapshot,
    plan_tipo_nombre_snapshot,
    precio_original,
    descuento,
    total_original,
    moneda_original,
    total_usd,
    exchange_rate,
    created_by
  )
  VALUES (
    v_venta_id,
    1,
    'inicial'::periodo_tipo_enum,
    p_fecha_inicio,
    p_fecha_fin,
    p_ciclo_pago,
    NULLIF(p_plan_id, ''),
    COALESCE(NULLIF(p_plan_nombre_snapshot, ''), ''),
    COALESCE(NULLIF(p_plan_tipo_nombre_snapshot, ''), ''),
    p_precio_original,
    COALESCE(p_descuento, 0),
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    p_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    v_venta_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    p_created_by
  );

  RETURN v_venta_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_venta_with_initial_payment(p_cliente_id text, p_servicio_id text, p_categoria_id text, p_estado venta_estado_enum, p_perfil_numero integer, p_perfil_nombre text, p_codigo text, p_notas text, p_fecha_inicio date, p_fecha_fin date, p_ciclo_pago ciclo_pago_enum, p_precio_original numeric, p_descuento numeric, p_total_original numeric, p_moneda_original text, p_total_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_fecha_pago timestamp with time zone DEFAULT now(), p_pago_notas text DEFAULT NULL::text, p_plan_id text DEFAULT NULL::text, p_plan_nombre_snapshot text DEFAULT NULL::text, p_plan_tipo_nombre_snapshot text DEFAULT NULL::text, p_created_by uuid DEFAULT auth.uid(), p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_venta_id TEXT;
  v_periodo_id TEXT;
  v_existing_result_id TEXT;
  v_created_by UUID := auth.uid();
BEGIN
  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_created_by IS NOT NULL AND p_created_by <> v_created_by THEN
    RAISE EXCEPTION 'created_by must match authenticated user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::TEXT, 0));

    SELECT result_id
      INTO v_existing_result_id
    FROM public.rpc_idempotency_keys
    WHERE idempotency_key = p_idempotency_key
      AND rpc_name = 'create_venta_with_initial_payment'
      AND created_by = v_created_by
    LIMIT 1;

    IF v_existing_result_id IS NOT NULL THEN
      RETURN v_existing_result_id;
    END IF;
  END IF;

  INSERT INTO ventas (
    cliente_id,
    servicio_id,
    categoria_id,
    estado,
    perfil_numero,
    perfil_nombre,
    codigo,
    notas,
    created_by
  )
  VALUES (
    NULLIF(p_cliente_id, ''),
    p_servicio_id,
    p_categoria_id,
    COALESCE(p_estado, 'activo'::venta_estado_enum),
    p_perfil_numero,
    NULLIF(p_perfil_nombre, ''),
    NULLIF(p_codigo, ''),
    NULLIF(p_notas, ''),
    v_created_by
  )
  RETURNING id INTO v_venta_id;

  INSERT INTO venta_periodos (
    venta_id,
    numero_periodo,
    tipo,
    fecha_inicio,
    fecha_fin,
    ciclo_pago,
    plan_id,
    plan_nombre_snapshot,
    plan_tipo_nombre_snapshot,
    precio_original,
    descuento,
    total_original,
    moneda_original,
    total_usd,
    exchange_rate,
    created_by
  )
  VALUES (
    v_venta_id,
    1,
    'inicial'::periodo_tipo_enum,
    p_fecha_inicio,
    p_fecha_fin,
    p_ciclo_pago,
    NULLIF(p_plan_id, ''),
    COALESCE(NULLIF(p_plan_nombre_snapshot, ''), ''),
    COALESCE(NULLIF(p_plan_tipo_nombre_snapshot, ''), ''),
    p_precio_original,
    COALESCE(p_descuento, 0),
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    v_created_by
  )
  RETURNING id INTO v_periodo_id;

  INSERT INTO pagos_venta (
    venta_periodo_id,
    venta_id,
    fecha_pago,
    estado,
    monto_original,
    moneda_original,
    monto_usd,
    exchange_rate,
    metodo_pago_id,
    metodo_pago_nombre_snapshot,
    notas,
    created_by
  )
  VALUES (
    v_periodo_id,
    v_venta_id,
    COALESCE(p_fecha_pago, now()),
    'registrado'::pago_estado_enum,
    p_total_original,
    p_moneda_original,
    p_total_usd,
    p_exchange_rate,
    NULLIF(p_metodo_pago_id, ''),
    NULLIF(p_metodo_pago_nombre_snapshot, ''),
    NULLIF(p_pago_notas, ''),
    v_created_by
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_keys (idempotency_key, rpc_name, result_id, created_by)
    VALUES (p_idempotency_key, 'create_venta_with_initial_payment', v_venta_id, v_created_by)
    ON CONFLICT (created_by, rpc_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_venta_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_categoria(p_categoria_id text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_servicios_count INTEGER;
  v_ventas_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_servicios_count
  FROM servicios
  WHERE categoria_id = p_categoria_id;

  SELECT COUNT(*) INTO v_ventas_count
  FROM ventas
  WHERE categoria_id = p_categoria_id;

  IF v_servicios_count > 0 OR v_ventas_count > 0 THEN
    RAISE EXCEPTION
      'No se puede eliminar esta categoria porque tiene % servicio(s) y % venta(s) asociados. Elimina o migra esos registros primero.',
      v_servicios_count,
      v_ventas_count
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM planes
  WHERE categoria_id = p_categoria_id;

  DELETE FROM planes_tipos
  WHERE categoria_id = p_categoria_id;

  DELETE FROM categorias
  WHERE id = p_categoria_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_servicio_payment_and_empty_period(p_pago_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_periodo_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT servicio_periodo_id
    INTO v_periodo_id
  FROM pagos_servicio
  WHERE id = p_pago_id
  FOR UPDATE;

  IF v_periodo_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM pagos_servicio WHERE id = p_pago_id;

  IF NOT EXISTS (SELECT 1 FROM pagos_servicio WHERE servicio_periodo_id = v_periodo_id) THEN
    DELETE FROM servicio_periodos WHERE id = v_periodo_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_servicio_with_payments(p_servicio_id text, p_delete_payments boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_venta_payment_and_empty_period(p_pago_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_periodo_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT venta_periodo_id
    INTO v_periodo_id
  FROM pagos_venta
  WHERE id = p_pago_id
  FOR UPDATE;

  IF v_periodo_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM pagos_venta WHERE id = p_pago_id;

  IF NOT EXISTS (SELECT 1 FROM pagos_venta WHERE venta_periodo_id = v_periodo_id) THEN
    DELETE FROM venta_periodos WHERE id = v_periodo_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_venta_with_payments(p_venta_id text, p_delete_payments boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.dismiss_yappy_payment(p_payment_id uuid, p_note text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_payment public.yappy_payments%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR (SELECT private.auth_role()) <> 'admin'
    OR NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active)
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF nullif(btrim(p_note), '') IS NULL OR char_length(p_note) > 1000 THEN RAISE EXCEPTION 'invalid note'; END IF;
  SELECT * INTO v_payment FROM public.yappy_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF v_payment.match_status = 'descartado' THEN RETURN 'descartado'; END IF;
  IF v_payment.match_status = 'registrado' THEN RAISE EXCEPTION 'payment already resolved'; END IF;
  UPDATE public.yappy_payments SET match_status = 'descartado', resolved_by = auth.uid(),
    resolved_at = now(), resolution_note = btrim(p_note) WHERE id = p_payment_id;
  RETURN 'descartado';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_notification_integrity_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_venta_payment_promise()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fecha_prometida_pago IS NOT NULL THEN
    NEW.leida := TRUE;
    NEW.read_at := COALESCE(NEW.read_at, CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fill_metodo_pago_nombre_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre TEXT;
BEGIN
  IF NEW.metodo_pago_id IS NULL THEN
    -- Sin metodo_pago_id no podemos derivar nombre; respetamos lo que venga
    -- (puede ser '' tras la migracion de NOT NULL DEFAULT '').
    RETURN NEW;
  END IF;

  -- Caso 1: INSERT y la app no paso el snapshot -> derivarlo.
  IF TG_OP = 'INSERT'
     AND (NEW.metodo_pago_nombre_snapshot IS NULL OR NEW.metodo_pago_nombre_snapshot = '')
  THEN
    SELECT mp.nombre INTO v_nombre
    FROM public.metodos_pago mp
    WHERE mp.id = NEW.metodo_pago_id;
    NEW.metodo_pago_nombre_snapshot := COALESCE(v_nombre, '');
    RETURN NEW;
  END IF;

  -- Caso 2: UPDATE que cambia metodo_pago_id y la app no esta forzando un
  -- snapshot distinto -> sincronizar snapshot con el nuevo metodo.
  IF TG_OP = 'UPDATE'
     AND NEW.metodo_pago_id IS DISTINCT FROM OLD.metodo_pago_id
     AND NEW.metodo_pago_nombre_snapshot IS NOT DISTINCT FROM OLD.metodo_pago_nombre_snapshot
  THEN
    SELECT mp.nombre INTO v_nombre
    FROM public.metodos_pago mp
    WHERE mp.id = NEW.metodo_pago_id;
    NEW.metodo_pago_nombre_snapshot := COALESCE(v_nombre, '');
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fill_venta_periodo_plan_snapshots()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_id          TEXT;
  v_plan_nombre      TEXT;
  v_plan_tipo_nombre TEXT;
  v_match_count      INTEGER;
BEGIN
  IF NEW.plan_id IS NULL THEN
    SELECT COUNT(*)::INTEGER, MAX(p.id), MAX(p.nombre), MAX(pt.nombre)
      INTO v_match_count, v_plan_id, v_plan_nombre, v_plan_tipo_nombre
    FROM public.ventas v
    JOIN public.servicios s ON s.id = v.servicio_id
    JOIN public.planes p
      ON p.categoria_id = v.categoria_id
     AND p.plan_tipo_id = s.plan_tipo_id
     AND p.ciclo_pago = NEW.ciclo_pago
     AND ABS(p.precio - NEW.precio_original) < 0.01
    JOIN public.planes_tipos pt
      ON pt.id = p.plan_tipo_id
     AND pt.categoria_id = p.categoria_id
    WHERE v.id = NEW.venta_id
      AND s.plan_tipo_id IS NOT NULL;

    IF v_match_count = 1 THEN
      NEW.plan_id := v_plan_id;
      IF NEW.plan_nombre_snapshot IS NULL OR NEW.plan_nombre_snapshot = '' THEN
        NEW.plan_nombre_snapshot := COALESCE(v_plan_nombre, '');
      END IF;
      IF NEW.plan_tipo_nombre_snapshot IS NULL OR NEW.plan_tipo_nombre_snapshot = '' THEN
        NEW.plan_tipo_nombre_snapshot := COALESCE(v_plan_tipo_nombre, '');
      END IF;
      RETURN NEW;
    END IF;

    NEW.plan_nombre_snapshot := COALESCE(NEW.plan_nombre_snapshot, '');
    NEW.plan_tipo_nombre_snapshot := COALESCE(NEW.plan_tipo_nombre_snapshot, '');
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     AND (
       NEW.plan_nombre_snapshot IS NULL OR NEW.plan_nombre_snapshot = ''
       OR NEW.plan_tipo_nombre_snapshot IS NULL OR NEW.plan_tipo_nombre_snapshot = ''
     )
  THEN
    SELECT p.nombre, pt.nombre
      INTO v_plan_nombre, v_plan_tipo_nombre
    FROM public.planes p
    JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id
    WHERE p.id = NEW.plan_id;

    IF NEW.plan_nombre_snapshot IS NULL OR NEW.plan_nombre_snapshot = '' THEN
      NEW.plan_nombre_snapshot := COALESCE(v_plan_nombre, '');
    END IF;
    IF NEW.plan_tipo_nombre_snapshot IS NULL OR NEW.plan_tipo_nombre_snapshot = '' THEN
      NEW.plan_tipo_nombre_snapshot := COALESCE(v_plan_tipo_nombre, '');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.plan_id IS DISTINCT FROM OLD.plan_id
     AND NEW.plan_nombre_snapshot IS NOT DISTINCT FROM OLD.plan_nombre_snapshot
     AND NEW.plan_tipo_nombre_snapshot IS NOT DISTINCT FROM OLD.plan_tipo_nombre_snapshot
  THEN
    SELECT p.nombre, pt.nombre
      INTO v_plan_nombre, v_plan_tipo_nombre
    FROM public.planes p
    JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id
    WHERE p.id = NEW.plan_id;
    NEW.plan_nombre_snapshot      := COALESCE(v_plan_nombre, '');
    NEW.plan_tipo_nombre_snapshot := COALESCE(v_plan_tipo_nombre, '');
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finish_whatsapp_notice_reply(p_reply_id bigint, p_attempt integer, p_result text, p_error_label text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_updated bigint;
BEGIN
  IF p_result NOT IN ('accepted', 'failed', 'uncertain')
    OR (p_error_label IS NOT NULL AND p_error_label !~ '^[A-Z_]{1,64}$') THEN
    RAISE EXCEPTION 'invalid notice reply finish';
  END IF;
  UPDATE public.whatsapp_notice_replies r SET result = p_result,
    handled_at = now(), locked_until = NULL, last_error = p_error_label,
    next_attempt_at = CASE WHEN p_result = 'failed' AND r.attempts < 5
      THEN now() + (power(2, r.attempts - 1) * interval '1 minute') ELSE NULL END
    WHERE r.id = p_reply_id AND r.attempts = p_attempt AND r.result = 'processing'
    RETURNING r.id INTO v_updated;
  RETURN v_updated IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_categorias_counts()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT jsonb_build_object(
    'totalCategorias', COUNT(*),
    'categoriasClientes', COUNT(*) FILTER (WHERE tipo = 'cliente'),
    'categoriasRevendedores', COUNT(*) FILTER (WHERE tipo = 'revendedor')
  )
  FROM categorias;
$function$
;

CREATE OR REPLACE FUNCTION public.get_categorias_full()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_churn_stats()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
WITH bounds AS (
  SELECT date_trunc('month', now() AT TIME ZONE 'America/Panama')::date AS current_month
),
months AS (
  SELECT
    gs::date AS month_start,
    (gs::date + INTERVAL '1 month')::date AS month_end,
    (gs::timestamp AT TIME ZONE 'America/Panama') AS month_start_at,
    ((gs + INTERVAL '1 month')::timestamp AT TIME ZONE 'America/Panama') AS month_end_at
  FROM bounds,
    generate_series(
      (bounds.current_month - INTERVAL '11 months')::date,
      bounds.current_month,
      INTERVAL '1 month'
    ) AS gs
),
clientes_activos AS (
  SELECT COUNT(DISTINCT t.id) AS total
  FROM public.terceros t
  JOIN public.ventas v ON v.cliente_id = t.id
  WHERE t.tipo = 'cliente'
    AND t.active = true
    AND v.archivado_at IS NULL
    AND v.estado = 'activo'
),
clientes_inactivos AS (
  SELECT COUNT(DISTINCT t.id) AS total
  FROM public.terceros t
  WHERE t.tipo = 'cliente'
    AND t.active = true
    AND EXISTS (
      SELECT 1
      FROM public.ventas v
      WHERE v.cliente_id = t.id
        AND v.archivado_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.ventas v
      WHERE v.cliente_id = t.id
        AND v.archivado_at IS NULL
        AND v.estado = 'activo'
    )
),
churn_events AS (
  SELECT DISTINCT
    t.id AS cliente_id,
    date_trunc('month', v.cortada_at AT TIME ZONE 'America/Panama')::date AS month_start
  FROM public.ventas v
  JOIN public.terceros t ON t.id = v.cliente_id
  WHERE t.tipo = 'cliente'
    AND t.active = true
    AND v.archivado_at IS NULL
    AND v.cortada_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.ventas other_v
      WHERE other_v.cliente_id = v.cliente_id
        AND other_v.id <> v.id
        AND other_v.archivado_at IS NULL
        AND other_v.created_at <= v.cortada_at
        AND (
          (other_v.estado = 'activo' AND other_v.cortada_at IS NULL)
          OR other_v.cortada_at > v.cortada_at
        )
    )
),
perdidos_por_mes AS (
  SELECT
    m.month_start,
    COUNT(DISTINCT ce.cliente_id) AS perdidos
  FROM months m
  LEFT JOIN churn_events ce ON ce.month_start = m.month_start
  GROUP BY m.month_start
),
activos_inicio_mes AS (
  SELECT
    m.month_start,
    COUNT(DISTINCT t.id) AS activos_inicio
  FROM months m
  LEFT JOIN public.ventas v
    ON v.archivado_at IS NULL
    AND v.created_at < m.month_start_at
    AND (
      (v.estado = 'activo' AND v.cortada_at IS NULL)
      OR v.cortada_at >= m.month_start_at
    )
  LEFT JOIN public.terceros t
    ON t.id = v.cliente_id
    AND t.tipo = 'cliente'
    AND t.active = true
  GROUP BY m.month_start
),
por_mes AS (
  SELECT
    m.month_start,
    to_char(m.month_start, 'YYYY-MM') AS mes,
    COALESCE(ppm.perdidos, 0)::integer AS perdidos,
    COALESCE(aim.activos_inicio, 0)::integer AS activos_inicio,
    CASE
      WHEN COALESCE(aim.activos_inicio, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(ppm.perdidos, 0)::numeric / aim.activos_inicio::numeric) * 100, 2)
    END AS churn_pct
  FROM months m
  LEFT JOIN perdidos_por_mes ppm ON ppm.month_start = m.month_start
  LEFT JOIN activos_inicio_mes aim ON aim.month_start = m.month_start
),
current_month_churn AS (
  SELECT COALESCE(churn_pct, 0) AS churn_pct
  FROM por_mes, bounds
  WHERE por_mes.month_start = bounds.current_month
)
SELECT jsonb_build_object(
  'kpis', jsonb_build_object(
    'clientesActivos', COALESCE((SELECT total FROM clientes_activos), 0),
    'clientesInactivos', COALESCE((SELECT total FROM clientes_inactivos), 0),
    'tasaChurnMesActual', COALESCE((SELECT churn_pct FROM current_month_churn), 0)
  ),
  'porMes', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'mes', mes,
        'perdidos', perdidos,
        'activosInicio', activos_inicio,
        'churnPct', churn_pct
      )
      ORDER BY month_start
    )
    FROM por_mes
  ), '[]'::jsonb)
);
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_home()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_stats record;
  v_activity jsonb;
BEGIN
  SELECT * INTO v_stats FROM public.get_dashboard_stats_snapshot() LIMIT 1;

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
    FROM public.activity_log
    ORDER BY timestamp DESC
    LIMIT 6
  ) al;

  RETURN jsonb_build_object(
    'stats', jsonb_build_object(
      'id', v_stats.id,
      'ingresos_total', v_stats.ingresos_total,
      'gastos_total', v_stats.gastos_total,
      'terceros_por_mes', v_stats.terceros_por_mes,
      'terceros_por_dia', v_stats.terceros_por_dia,
      'ingresos_por_mes', v_stats.ingresos_por_mes,
      'ingresos_por_dia', v_stats.ingresos_por_dia,
      'ingresos_por_categoria', v_stats.ingresos_por_categoria,
      'ingresos_categorias_por_mes', v_stats.ingresos_categorias_por_mes,
      'ventas_pronostico', v_stats.ventas_pronostico,
      'servicios_pronostico', v_stats.servicios_pronostico,
      'churn_stats', COALESCE(
        v_stats.churn_stats,
        '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb
      ),
      'updated_at', v_stats.updated_at
    ),
    'counts', jsonb_build_object(
      'ventasActivas', (
        SELECT COUNT(*)
        FROM public.ventas
        WHERE archivado_at IS NULL
          AND estado = 'activo'
      ),
      'totalClientes', (
        SELECT COUNT(*)
        FROM public.terceros
        WHERE tipo = 'cliente'
      ),
      'totalRevendedores', (
        SELECT COUNT(*)
        FROM public.terceros
        WHERE tipo = 'revendedor'
      )
    ),
    'recentActivity', v_activity
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_live()
 RETURNS TABLE(id text, ingresos_total numeric, gastos_total numeric, terceros_por_mes jsonb, terceros_por_dia jsonb, ingresos_por_mes jsonb, ingresos_por_dia jsonb, ingresos_por_categoria jsonb, ingresos_categorias_por_mes jsonb, ventas_pronostico jsonb, servicios_pronostico jsonb, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'migration_audit', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
  WITH legacy_base AS (
    SELECT
      CASE
        WHEN lor.source_collection = 'pagosVenta' THEN 'ingresos'
        ELSE 'gastos'
      END AS kind,
      ((COALESCE(
        NULLIF(lor.payload ->> 'fechaInicio', ''),
        NULLIF(lor.payload ->> 'fecha', ''),
        NULLIF(lor.payload ->> 'createdAt', '')
      ))::timestamptz AT TIME ZONE 'America/Panama')::date AS fecha,
      COALESCE((lor.payload ->> 'monto')::numeric, (lor.payload ->> 'total')::numeric, 0) AS amount_original,
      UPPER(COALESCE(NULLIF(lor.payload ->> 'moneda', ''), 'USD')) AS currency,
      NULLIF(lor.payload ->> 'categoriaId', '') AS categoria_id
    FROM migration_audit.legacy_orphan_records lor
    WHERE lor.resolved_at IS NULL
      AND lor.source_collection IN ('pagosVenta', 'pagosServicio')
      AND COALESCE(
        NULLIF(lor.payload ->> 'fechaInicio', ''),
        NULLIF(lor.payload ->> 'fecha', ''),
        NULLIF(lor.payload ->> 'createdAt', '')
      ) IS NOT NULL
  ),
  legacy_finance AS (
    SELECT
      lb.kind,
      lb.fecha,
      CASE
        WHEN lb.currency IN ('USD', 'PAB') THEN lb.amount_original
        WHEN direct.rate IS NOT NULL AND direct.rate > 0 THEN lb.amount_original * direct.rate
        WHEN inverse.rate IS NOT NULL AND inverse.rate > 0 THEN lb.amount_original / inverse.rate
        ELSE lb.amount_original
      END AS amount_usd,
      lb.categoria_id,
      COALESCE(c.nombre, lb.categoria_id) AS categoria_nombre
    FROM legacy_base lb
    LEFT JOIN exchange_rates direct ON direct.currency_pair = lb.currency || '_USD'
    LEFT JOIN exchange_rates inverse ON inverse.currency_pair = 'USD_' || lb.currency
    LEFT JOIN categorias c ON c.id = lb.categoria_id
    WHERE lb.fecha IS NOT NULL
  ),
  finance AS (
    SELECT
      'ingresos'::text AS kind,
      COALESCE(
        CASE WHEN pv.estado = 'reembolsado' THEN pv.fecha_pago::date ELSE vp.fecha_inicio END,
        pv.fecha_pago::date
      ) AS fecha,
      CASE
        WHEN pv.estado = 'reembolsado' THEN -pv.monto_usd::numeric
        ELSE pv.monto_usd::numeric
      END AS amount_usd,
      v.categoria_id,
      COALESCE(c.nombre, v.categoria_id) AS categoria_nombre
    FROM pagos_venta pv
    JOIN venta_periodos vp ON vp.id = pv.venta_periodo_id
    JOIN ventas v ON v.id = pv.venta_id
    LEFT JOIN categorias c ON c.id = v.categoria_id
    WHERE pv.estado IN ('registrado', 'reembolsado')

    UNION ALL

    SELECT
      'gastos'::text AS kind,
      COALESCE(sp.fecha_inicio, ps.fecha_pago::date) AS fecha,
      ps.monto_usd::numeric AS amount_usd,
      COALESCE(ps.categoria_id_snapshot, s.categoria_id) AS categoria_id,
      COALESCE(c.nombre, COALESCE(ps.categoria_id_snapshot, s.categoria_id)) AS categoria_nombre
    FROM pagos_servicio ps
    JOIN servicio_periodos sp ON sp.id = ps.servicio_periodo_id
    JOIN servicios s ON s.id = ps.servicio_id
    LEFT JOIN categorias c ON c.id = COALESCE(ps.categoria_id_snapshot, s.categoria_id)
    WHERE ps.estado = 'registrado'

    UNION ALL

    SELECT
      'gastos'::text AS kind,
      g.fecha,
      g.monto_usd::numeric AS amount_usd,
      NULL::text AS categoria_id,
      NULL::text AS categoria_nombre
    FROM gastos g

    UNION ALL

    SELECT kind, fecha, amount_usd, categoria_id, categoria_nombre
    FROM legacy_finance
  ),
  totals AS (
    SELECT
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS ingresos_total,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos_total
    FROM finance
  ),
  monthly AS (
    SELECT
      to_char(fecha, 'YYYY-MM') AS mes,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS ingresos,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance
    GROUP BY to_char(fecha, 'YYYY-MM')
  ),
  current_month AS (
    SELECT date_trunc('month', (now() AT TIME ZONE 'America/Panama')::date::timestamp)::date AS first_day
  ),
  daily AS (
    SELECT
      to_char(fecha, 'YYYY-MM-DD') AS dia,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS ingresos,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance, current_month cm
    WHERE fecha >= cm.first_day
      AND fecha < (cm.first_day + INTERVAL '1 month')::date
    GROUP BY to_char(fecha, 'YYYY-MM-DD')
  ),
  user_base AS (
    SELECT
      (u.created_at AT TIME ZONE 'America/Panama')::date AS fecha,
      u.tipo
    FROM terceros u
    WHERE u.tipo IN ('cliente', 'revendedor')
  ),
  user_monthly AS (
    SELECT
      to_char(fecha, 'YYYY-MM') AS mes,
      COUNT(*) FILTER (WHERE tipo = 'cliente') AS clientes,
      COUNT(*) FILTER (WHERE tipo = 'revendedor') AS revendedores
    FROM user_base
    GROUP BY to_char(fecha, 'YYYY-MM')
  ),
  user_daily AS (
    SELECT
      to_char(fecha, 'YYYY-MM-DD') AS dia,
      COUNT(*) FILTER (WHERE tipo = 'cliente') AS clientes,
      COUNT(*) FILTER (WHERE tipo = 'revendedor') AS revendedores
    FROM user_base, current_month cm
    WHERE fecha >= cm.first_day
      AND fecha < (cm.first_day + INTERVAL '1 month')::date
    GROUP BY to_char(fecha, 'YYYY-MM-DD')
  ),
  category_totals AS (
    SELECT
      categoria_id,
      categoria_nombre,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS total,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance
    WHERE categoria_id IS NOT NULL
    GROUP BY categoria_id, categoria_nombre
  ),
  category_monthly AS (
    SELECT
      to_char(fecha, 'YYYY-MM') AS mes,
      categoria_id,
      categoria_nombre,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'ingresos'), 0) AS total,
      COALESCE(SUM(amount_usd) FILTER (WHERE kind = 'gastos'), 0) AS gastos
    FROM finance
    WHERE categoria_id IS NOT NULL
    GROUP BY to_char(fecha, 'YYYY-MM'), categoria_id, categoria_nombre
  ),
  latest_venta_period AS (
    SELECT DISTINCT ON (vp.venta_id)
      vp.*
    FROM venta_periodos vp
    ORDER BY vp.venta_id, vp.fecha_fin DESC, vp.numero_periodo DESC, vp.created_at DESC
  ),
  latest_venta_payment_period AS (
    SELECT DISTINCT ON (pv.venta_id)
      pv.venta_id,
      vp.fecha_inicio,
      vp.fecha_fin,
      vp.ciclo_pago,
      vp.precio_original,
      vp.total_original,
      pv.monto_original,
      COALESCE(NULLIF(pv.moneda_original, ''), NULLIF(vp.moneda_original, '')) AS moneda_original
    FROM pagos_venta pv
    JOIN venta_periodos vp ON vp.id = pv.venta_periodo_id
    WHERE pv.estado = 'registrado'
    ORDER BY pv.venta_id, vp.fecha_fin DESC, vp.numero_periodo DESC, pv.fecha_pago DESC, pv.created_at DESC
  ),
  venta_forecast AS (
    SELECT
      v.id,
      v.categoria_id,
      COALESCE(lpp.fecha_inicio, lvp.fecha_inicio) AS fecha_inicio,
      COALESCE(lpp.fecha_fin, lvp.fecha_fin) AS fecha_fin,
      COALESCE(lpp.ciclo_pago, lvp.ciclo_pago, 'mensual'::ciclo_pago_enum) AS ciclo_pago,
      COALESCE(
        NULLIF(lpp.precio_original, 0),
        NULLIF(lpp.monto_original, 0),
        NULLIF(lpp.total_original, 0),
        NULLIF(lvp.precio_original, 0),
        lvp.total_original,
        0
      ) AS precio_final,
      COALESCE(NULLIF(lpp.moneda_original, ''), NULLIF(lvp.moneda_original, ''), 'USD') AS moneda
    FROM ventas v
    LEFT JOIN latest_venta_period lvp ON lvp.venta_id = v.id
    LEFT JOIN latest_venta_payment_period lpp ON lpp.venta_id = v.id
    WHERE v.estado <> 'inactivo'
      AND v.archivado_at IS NULL
  ),
  latest_servicio_period AS (
    SELECT DISTINCT ON (sp.servicio_id)
      sp.*
    FROM servicio_periodos sp
    ORDER BY sp.servicio_id, sp.fecha_vencimiento DESC, sp.numero_periodo DESC, sp.created_at DESC
  ),
  servicio_forecast AS (
    SELECT
      s.id,
      lsp.fecha_vencimiento,
      COALESCE(lsp.ciclo_pago, 'mensual'::ciclo_pago_enum) AS ciclo_pago,
      COALESCE(lsp.costo_original, 0) AS costo_servicio,
      COALESCE(NULLIF(lsp.moneda_original, ''), 'USD') AS moneda
    FROM servicios s
    JOIN latest_servicio_period lsp ON lsp.servicio_id = s.id
    WHERE s.activo = true
      AND s.en_reposo = false
      AND s.archivado_at IS NULL
      AND COALESCE(lsp.costo_original, 0) > 0
  )
  SELECT
    'singleton'::text AS id,
    (SELECT totals.ingresos_total FROM totals) AS ingresos_total,
    (SELECT totals.gastos_total FROM totals) AS gastos_total,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('mes', mes, 'clientes', clientes, 'revendedores', revendedores)
        ORDER BY mes
      )
      FROM user_monthly
    ), '[]'::jsonb) AS terceros_por_mes,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('dia', dia, 'clientes', clientes, 'revendedores', revendedores)
        ORDER BY dia
      )
      FROM user_daily
    ), '[]'::jsonb) AS terceros_por_dia,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('mes', mes, 'ingresos', ingresos, 'gastos', gastos)
        ORDER BY mes
      )
      FROM monthly
    ), '[]'::jsonb) AS ingresos_por_mes,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('dia', dia, 'ingresos', ingresos, 'gastos', gastos)
        ORDER BY dia
      )
      FROM daily
    ), '[]'::jsonb) AS ingresos_por_dia,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'categoriaId', categoria_id,
          'nombre', categoria_nombre,
          'total', total,
          'gastos', gastos
        )
        ORDER BY categoria_nombre
      )
      FROM category_totals
    ), '[]'::jsonb) AS ingresos_por_categoria,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'mes', mes,
          'categoriaId', categoria_id,
          'nombre', categoria_nombre,
          'total', total,
          'gastos', gastos
        )
        ORDER BY mes, categoria_nombre
      )
      FROM category_monthly
    ), '[]'::jsonb) AS ingresos_categorias_por_mes,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vf.id,
          'categoriaId', vf.categoria_id,
          'fechaInicio', to_char(vf.fecha_inicio, 'YYYY-MM-DD') || 'T00:00:00',
          'fechaFin', to_char(vf.fecha_fin, 'YYYY-MM-DD') || 'T00:00:00',
          'cicloPago', vf.ciclo_pago,
          'precioFinal', vf.precio_final,
          'moneda', vf.moneda
        )
        ORDER BY vf.id
      )
      FROM venta_forecast vf
      WHERE vf.fecha_fin IS NOT NULL
    ), '[]'::jsonb) AS ventas_pronostico,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', sf.id,
          'fechaVencimiento', to_char(sf.fecha_vencimiento, 'YYYY-MM-DD') || 'T00:00:00',
          'cicloPago', sf.ciclo_pago,
          'costoServicio', sf.costo_servicio,
          'moneda', sf.moneda
        )
        ORDER BY sf.id
      )
      FROM servicio_forecast sf
      WHERE sf.fecha_vencimiento IS NOT NULL
    ), '[]'::jsonb) AS servicios_pronostico,
    now() AS updated_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_snapshot()
 RETURNS TABLE(id text, ingresos_total numeric, gastos_total numeric, terceros_por_mes jsonb, terceros_por_dia jsonb, ingresos_por_mes jsonb, ingresos_por_dia jsonb, ingresos_por_categoria jsonb, ingresos_categorias_por_mes jsonb, ventas_pronostico jsonb, servicios_pronostico jsonb, updated_at timestamp with time zone, churn_stats jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'migration_audit', 'pg_catalog'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM private.dashboard_stats_snapshot
    WHERE dashboard_stats_snapshot.id = 'dashboard'
  ) THEN
    PERFORM public.refresh_dashboard_stats_snapshot(true);
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(snapshot.stats ->> 'id', 'singleton')::text AS id,
    COALESCE((snapshot.stats ->> 'ingresos_total')::numeric, 0) AS ingresos_total,
    COALESCE((snapshot.stats ->> 'gastos_total')::numeric, 0) AS gastos_total,
    COALESCE(snapshot.stats -> 'terceros_por_mes', '[]'::jsonb) AS terceros_por_mes,
    COALESCE(snapshot.stats -> 'terceros_por_dia', '[]'::jsonb) AS terceros_por_dia,
    COALESCE(snapshot.stats -> 'ingresos_por_mes', '[]'::jsonb) AS ingresos_por_mes,
    COALESCE(snapshot.stats -> 'ingresos_por_dia', '[]'::jsonb) AS ingresos_por_dia,
    COALESCE(snapshot.stats -> 'ingresos_por_categoria', '[]'::jsonb) AS ingresos_por_categoria,
    COALESCE(snapshot.stats -> 'ingresos_categorias_por_mes', '[]'::jsonb) AS ingresos_categorias_por_mes,
    COALESCE(snapshot.stats -> 'ventas_pronostico', '[]'::jsonb) AS ventas_pronostico,
    COALESCE(snapshot.stats -> 'servicios_pronostico', '[]'::jsonb) AS servicios_pronostico,
    snapshot.refreshed_at AS updated_at,
    COALESCE(
      snapshot.stats -> 'churn_stats',
      '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb
    ) AS churn_stats
  FROM private.dashboard_stats_snapshot snapshot
  WHERE snapshot.id = 'dashboard'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      live.id,
      live.ingresos_total,
      live.gastos_total,
      live.terceros_por_mes,
      live.terceros_por_dia,
      live.ingresos_por_mes,
      live.ingresos_por_dia,
      live.ingresos_por_categoria,
      live.ingresos_categorias_por_mes,
      live.ventas_pronostico,
      live.servicios_pronostico,
      live.updated_at,
      COALESCE(
        public.get_dashboard_churn_stats(),
        '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb
      ) AS churn_stats
    FROM public.get_dashboard_stats_live() live
    LIMIT 1;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_usuarios_role_active()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active)
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND (SELECT auth.role()) IS DISTINCT FROM 'service_role'
     AND (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador activo puede cambiar role o active'
      USING ERRCODE = '42501';
  END IF;
  -- Serializa bajas/promociones de admin para no dejar el sistema sin acceso.
  IF OLD.role = 'admin' AND OLD.active
     AND (NEW.role <> 'admin' OR NOT NEW.active) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(20261001, 1);
    IF (SELECT count(*) FROM public.usuarios AS u
        WHERE u.role = 'admin' AND u.active) <= 1 THEN
      RAISE EXCEPTION 'Debe quedar al menos un administrador activo'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.usuarios (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, ''),
    'operador'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.hide_whatsapp_message(p_message_id uuid, p_direction text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF auth.role() <> 'authenticated' OR (SELECT private.auth_role()) <> 'admin'
    OR NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active)
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_direction NOT IN ('inbound', 'outbound') THEN RAISE EXCEPTION 'invalid direction'; END IF;
  IF p_direction = 'inbound' THEN
    UPDATE public.whatsapp_inbound_messages SET hidden_at = now(), hidden_by = auth.uid()
    WHERE id = p_message_id AND hidden_at IS NULL;
  ELSE
    UPDATE public.whatsapp_outbound_messages SET hidden_at = now(), hidden_by = auth.uid()
    WHERE id = p_message_id AND hidden_at IS NULL;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ingest_yappy_payment(p_uid_validity bigint, p_imap_uid bigint, p_internet_message_id text, p_received_at timestamp with time zone, p_subject text, p_dmarc_pass boolean, p_parser_version integer, p_confirmation_code text, p_amount numeric, p_payer_name_short text, p_payer_phone_last4 text, p_paid_at timestamp with time zone, p_reject_reason text DEFAULT NULL::text)
 RETURNS TABLE(outcome text, payment_id uuid, match_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_mail_id uuid; v_payment_id uuid; v_status text;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_uid_validity <= 0 OR p_imap_uid <= 0 OR p_payer_phone_last4 !~ '^[0-9]{4}$'
    OR p_amount <= 0 OR p_confirmation_code IS NULL OR btrim(p_confirmation_code) = ''
  THEN RAISE EXCEPTION 'invalid payment input'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.terceros t
    JOIN public.ventas v ON v.cliente_id = t.id
    WHERE t.active AND v.estado = 'activo'
      AND right(regexp_replace(t.telefono, '[^0-9]', '', 'g'), 4) = p_payer_phone_last4
  ) THEN
    RETURN QUERY SELECT 'ignorado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  SELECT m.id INTO v_mail_id FROM public.yappy_mail_messages m
    WHERE m.uid_validity = p_uid_validity AND m.imap_uid = p_imap_uid;
  IF v_mail_id IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  INSERT INTO public.yappy_mail_messages(uid_validity, imap_uid, internet_message_id,
    received_at, from_address, subject, dmarc_pass, parser_version, status, failure_reason)
  VALUES (p_uid_validity, p_imap_uid, p_internet_message_id, p_received_at,
    'notificaciones@yappy.com.pa', p_subject, p_dmarc_pass, p_parser_version,
    CASE WHEN p_reject_reason IS NULL THEN 'extraido'
      WHEN p_reject_reason = 'dmarc_failed' THEN 'invalido' ELSE 'descartado' END, p_reject_reason)
  RETURNING id INTO v_mail_id;
  IF p_reject_reason IS NOT NULL THEN
    RETURN QUERY SELECT 'nuevo'::text, NULL::uuid,
      CASE WHEN p_reject_reason = 'dmarc_failed' THEN 'invalido' ELSE 'descartado' END::text;
    RETURN;
  END IF;
  INSERT INTO public.yappy_payments(confirmation_code, amount, payer_name_short,
    payer_phone_last4, paid_at, mail_message_id)
  VALUES (upper(btrim(p_confirmation_code)), p_amount, p_payer_name_short,
    p_payer_phone_last4, p_paid_at, v_mail_id)
  ON CONFLICT (confirmation_code) DO NOTHING RETURNING id INTO v_payment_id;
  IF v_payment_id IS NULL THEN
    UPDATE public.yappy_mail_messages SET status = 'duplicado',
      failure_reason = 'confirmation_code_exists' WHERE id = v_mail_id;
    RETURN QUERY SELECT 'duplicado'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  v_status := public.match_yappy_payment(v_payment_id);
  RETURN QUERY SELECT 'nuevo'::text, v_payment_id, v_status;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invalidate_notificaciones_reposo_on_servicio_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.en_reposo IS DISTINCT FROM OLD.en_reposo
     OR NEW.fecha_inicio_reposo IS DISTINCT FROM OLD.fecha_inicio_reposo
     OR NEW.fecha_fin_reposo IS DISTINCT FROM OLD.fecha_fin_reposo
  THEN
    DELETE FROM public.notificaciones n
    USING public.notificaciones_reposo nr
    WHERE nr.notificacion_id = n.id
      AND nr.servicio_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invalidate_notificaciones_servicio_on_periodo_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
     OR NEW.fecha_vencimiento IS DISTINCT FROM OLD.fecha_vencimiento
  THEN
    DELETE FROM public.notificaciones n
    USING public.notificaciones_servicio ns
    WHERE ns.notificacion_id = n.id
      AND ns.servicio_periodo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invalidate_notificaciones_venta_on_periodo_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
     OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin
  THEN
    DELETE FROM public.notificaciones n
    USING public.notificaciones_venta nv
    WHERE nv.notificacion_id = n.id
      AND nv.venta_periodo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_authenticated()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.usuarios AS u
      WHERE u.id = (SELECT auth.uid()) AND u.active
    )
  END
$function$
;

CREATE OR REPLACE FUNCTION public.list_retryable_whatsapp_notice_replies(p_limit integer)
 RETURNS TABLE(reply_id bigint, notice_id uuid, action text, inbound_wa_message_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH candidates AS (
    SELECT r.id AS reply_id, r.notice_id, r.action, r.inbound_wa_message_id,
      0 AS priority, r.id AS sort_id
    FROM public.whatsapp_notice_replies r
    WHERE (r.result = 'processing' AND r.locked_until <= now())
      OR (r.result = 'failed' AND r.attempts < 5 AND r.next_attempt_at <= now())
    UNION ALL
    -- Recupera tambien un after() que fallo antes de crear la fila de respuesta.
    SELECT NULL::bigint, n.id, split_part(i.payload->>'payload', ':', 1), i.wa_message_id,
      1, 0::bigint
    FROM public.whatsapp_inbound_messages i
    JOIN public.whatsapp_notices n ON n.id = CASE
      WHEN i.payload->>'payload' ~ '^(RENOVAR|NO_CONTINUAR|DATOS):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN split_part(i.payload->>'payload', ':', 2)::uuid ELSE NULL END
      AND n.status = 'accepted' AND n.wa_id = i.from_wa_id
      AND (i.context_wa_message_id IS NULL OR i.context_wa_message_id = n.wa_message_id)
    WHERE i.message_type = 'button' AND i.payload->>'type' = 'template_button'
      AND i.sent_at >= now() - interval '30 days'
      AND i.payload->>'payload' ~ '^(RENOVAR|NO_CONTINUAR|DATOS):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND n.created_at >= now() - interval '30 days'
      AND ((split_part(i.payload->>'payload', ':', 1) = 'DATOS'
          AND n.tipo IN ('actualizacion_credenciales', 'transferencia_servicio'))
        OR (split_part(i.payload->>'payload', ':', 1) = 'NO_CONTINUAR'
          AND n.tipo IN ('notificacion_regular', 'dia_pago'))
        OR (split_part(i.payload->>'payload', ':', 1) = 'RENOVAR'
          AND n.tipo IN ('notificacion_regular', 'dia_pago', 'cancelacion')))
      AND NOT EXISTS (SELECT 1 FROM public.whatsapp_notice_replies r
        WHERE r.notice_id = n.id AND r.action = split_part(i.payload->>'payload', ':', 1))
  )
  SELECT c.reply_id, c.notice_id, c.action, c.inbound_wa_message_id
  FROM candidates c ORDER BY c.priority, c.sort_id, c.inbound_wa_message_id
  LIMIT least(greatest(coalesce(p_limit, 0), 0), 100);
$function$
;

CREATE OR REPLACE FUNCTION public.match_yappy_payment(p_payment_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_payment public.yappy_payments%ROWTYPE;
  v_candidates text[];
  v_status text;
  v_days_before constant integer := 15;
  v_days_after constant integer := 7;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_payment FROM public.yappy_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF v_payment.match_status IN ('registrado', 'descartado') THEN RETURN v_payment.match_status; END IF;
  SELECT coalesce(array_agg(v.id ORDER BY v.id), '{}') INTO v_candidates
  FROM public.ventas v
  JOIN public.terceros t ON t.id = v.cliente_id
  JOIN LATERAL (
    SELECT vp.fecha_fin, vp.total_original, vp.moneda_original
    FROM public.venta_periodos vp WHERE vp.venta_id = v.id
    ORDER BY vp.numero_periodo DESC LIMIT 1
  ) last_period ON true
  WHERE v.estado = 'activo' AND t.active
    AND right(regexp_replace(t.telefono, '[^0-9]', '', 'g'), 4) = v_payment.payer_phone_last4
    AND last_period.moneda_original = 'USD'
    AND last_period.total_original = v_payment.amount
    AND last_period.fecha_fin BETWEEN
      ((v_payment.paid_at AT TIME ZONE 'America/Panama')::date - v_days_before)
      AND ((v_payment.paid_at AT TIME ZONE 'America/Panama')::date + v_days_after);
  v_status := CASE cardinality(v_candidates) WHEN 0 THEN 'sin_match' WHEN 1 THEN 'match_unico' ELSE 'ambiguo' END;
  UPDATE public.yappy_payments SET candidate_venta_ids = v_candidates, match_status = v_status
  WHERE id = p_payment_id;
  RETURN v_status;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.publish_whatsapp_bot_version(p_definition jsonb, p_note text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_note text := btrim(coalesce(p_note, ''));
  v_version integer;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_definition IS NULL OR jsonb_typeof(p_definition) <> 'object'
    OR octet_length(p_definition::text) > 262144 THEN
    RAISE EXCEPTION 'invalid bot definition';
  END IF;
  IF length(v_note) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid bot version note';
  END IF;

  -- Serializa publicaciones concurrentes y falla si la configuracion global no existe.
  PERFORM 1 FROM public.whatsapp_bot_config WHERE id = 'global' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bot configuration missing';
  END IF;

  INSERT INTO public.whatsapp_bot_versions (definition, note, created_by)
  VALUES (p_definition, v_note, (SELECT auth.uid()))
  RETURNING version INTO v_version;

  UPDATE public.whatsapp_bot_config
  SET published_version = v_version, updated_at = now(), updated_by = (SELECT auth.uid())
  WHERE id = 'global';

  RETURN v_version;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalc_perfiles_ocupados()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_servicio_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_servicio_ids := ARRAY[NEW.servicio_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_servicio_ids := ARRAY[OLD.servicio_id];
  ELSE
    IF NEW.servicio_id <> OLD.servicio_id THEN
      v_servicio_ids := ARRAY[NEW.servicio_id, OLD.servicio_id];
    ELSE
      v_servicio_ids := ARRAY[NEW.servicio_id];
    END IF;
  END IF;

  -- Bloquear las filas de servicio antes de recalcular para serializar
  -- actualizaciones concurrentes del contador perfiles_ocupados.
  PERFORM id
  FROM public.servicios
  WHERE id = ANY(v_servicio_ids)
  FOR UPDATE;

  UPDATE servicios s
  SET perfiles_ocupados = sub.real_count
  FROM (
    SELECT
      s2.id,
      COALESCE(COUNT(v.id), 0)::INTEGER AS real_count
    FROM servicios s2
    LEFT JOIN ventas v
      ON v.servicio_id = s2.id
      AND v.estado = 'activo'
      AND v.archivado_at IS NULL
      AND v.perfil_numero IS NOT NULL
    WHERE s2.id = ANY(v_servicio_ids)
    GROUP BY s2.id
  ) sub
  WHERE s.id = sub.id
    AND s.perfiles_ocupados IS DISTINCT FROM sub.real_count;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_invalid_yappy_mail(p_uid_validity bigint, p_imap_uid bigint, p_received_at timestamp with time zone, p_parser_version integer, p_failure_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_failure_reason IS NULL OR p_failure_reason NOT IN ('monto', 'confirmacion', 'telefono', 'fecha', 'nombre', 'mime_invalid', 'reenviado')
    OR p_uid_validity <= 0 OR p_imap_uid <= 0 THEN RAISE EXCEPTION 'invalid mail input'; END IF;
  INSERT INTO public.yappy_mail_messages(uid_validity, imap_uid, received_at,
    from_address, parser_version, status, failure_reason)
  VALUES (p_uid_validity, p_imap_uid, p_received_at, 'notificaciones@yappy.com.pa',
    p_parser_version, CASE WHEN p_failure_reason = 'reenviado' THEN 'descartado' ELSE 'invalido' END, p_failure_reason)
  ON CONFLICT (uid_validity, imap_uid) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_whatsapp_bot_event(p_wa_id text, p_cliente_id text, p_type text, p_node_id text, p_option_id text, p_detail jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
  DELETE FROM public.whatsapp_bot_events WHERE created_at < now() - interval '90 days';

  INSERT INTO public.whatsapp_bot_events (wa_id, cliente_id, type, node_id, option_id, detail)
  VALUES (p_wa_id, p_cliente_id, p_type, p_node_id, p_option_id, coalesce(p_detail, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats_snapshot(p_force boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'migration_audit', 'pg_catalog'
AS $function$
DECLARE
  v_locked boolean;
  v_dirty boolean;
  v_stats record;
  v_churn_stats jsonb;
  v_started_at timestamptz := now();
BEGIN
  SELECT pg_try_advisory_xact_lock(hashtext('dashboard_stats_snapshot_refresh'))
  INTO v_locked;

  IF NOT v_locked THEN
    RETURN false;
  END IF;

  INSERT INTO private.dashboard_read_model_state (id, dirty, dirty_reason, dirty_since)
  VALUES ('dashboard', true, 'missing_state', now())
  ON CONFLICT (id) DO NOTHING;

  SELECT dirty
  INTO v_dirty
  FROM private.dashboard_read_model_state
  WHERE id = 'dashboard'
  FOR UPDATE;

  IF NOT p_force AND NOT COALESCE(v_dirty, true) THEN
    RETURN false;
  END IF;

  UPDATE private.dashboard_read_model_state
  SET last_refresh_started_at = v_started_at,
      last_refresh_error = NULL,
      updated_at = now()
  WHERE id = 'dashboard';

  SELECT *
  INTO v_stats
  FROM public.get_dashboard_stats_live()
  LIMIT 1;

  SELECT public.get_dashboard_churn_stats()
  INTO v_churn_stats;

  INSERT INTO private.dashboard_stats_snapshot (id, stats, refreshed_at)
  VALUES (
    'dashboard',
    jsonb_build_object(
      'id', COALESCE(v_stats.id, 'singleton'),
      'ingresos_total', COALESCE(v_stats.ingresos_total, 0),
      'gastos_total', COALESCE(v_stats.gastos_total, 0),
      'terceros_por_mes', COALESCE(v_stats.terceros_por_mes, '[]'::jsonb),
      'terceros_por_dia', COALESCE(v_stats.terceros_por_dia, '[]'::jsonb),
      'ingresos_por_mes', COALESCE(v_stats.ingresos_por_mes, '[]'::jsonb),
      'ingresos_por_dia', COALESCE(v_stats.ingresos_por_dia, '[]'::jsonb),
      'ingresos_por_categoria', COALESCE(v_stats.ingresos_por_categoria, '[]'::jsonb),
      'ingresos_categorias_por_mes', COALESCE(v_stats.ingresos_categorias_por_mes, '[]'::jsonb),
      'ventas_pronostico', COALESCE(v_stats.ventas_pronostico, '[]'::jsonb),
      'servicios_pronostico', COALESCE(v_stats.servicios_pronostico, '[]'::jsonb),
      'churn_stats', COALESCE(
        v_churn_stats,
        '{"kpis":{"clientesActivos":0,"clientesInactivos":0,"tasaChurnMesActual":0},"porMes":[]}'::jsonb
      ),
      'updated_at', now()
    ),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET stats = EXCLUDED.stats,
      refreshed_at = EXCLUDED.refreshed_at;

  UPDATE private.dashboard_read_model_state
  SET dirty = false,
      dirty_reason = NULL,
      dirty_since = NULL,
      last_refresh_finished_at = now(),
      last_refresh_error = NULL,
      updated_at = now()
  WHERE id = 'dashboard';

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  UPDATE private.dashboard_read_model_state
  SET last_refresh_finished_at = now(),
      last_refresh_error = SQLERRM,
      updated_at = now()
  WHERE id = 'dashboard';

  RETURN false;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.release_netflix_code(p_mail_key text, p_wa_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_deleted integer;
BEGIN
  IF p_mail_key IS NULL OR p_mail_key !~ '^[0-9a-f]{64}$'
    OR p_wa_id IS NULL OR length(p_wa_id) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'invalid netflix code release';
  END IF;
  DELETE FROM public.netflix_code_claims WHERE mail_key = p_mail_key AND wa_id = p_wa_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reserve_whatsapp_notice(p_dedupe_key text, p_tipo tipo_template_enum, p_tercero_id text, p_wa_id text, p_channel text, p_meta_template_name text, p_fecha_vencimiento date, p_origin text, p_idempotency_key uuid, p_created_by uuid, p_venta_ids text[])
 RETURNS whatsapp_notices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE reserved public.whatsapp_notices;
BEGIN
  INSERT INTO public.whatsapp_notices
    (dedupe_key, tipo, tercero_id, wa_id, channel, meta_template_name,
     fecha_vencimiento, origin, idempotency_key, created_by)
  VALUES
    (p_dedupe_key, p_tipo, p_tercero_id, p_wa_id, p_channel, p_meta_template_name,
     p_fecha_vencimiento, p_origin, p_idempotency_key, p_created_by)
  ON CONFLICT (dedupe_key) DO UPDATE SET
    status = 'pending', idempotency_key = EXCLUDED.idempotency_key,
    outbound_message_id = NULL, wa_message_id = NULL, skip_reason = NULL,
    wa_id = EXCLUDED.wa_id, channel = EXCLUDED.channel,
    meta_template_name = EXCLUDED.meta_template_name,
    origin = EXCLUDED.origin, created_by = EXCLUDED.created_by,
    created_at = now(), updated_at = now()
  WHERE public.whatsapp_notices.status IN ('failed', 'skipped') AND p_origin = 'manual'
  RETURNING * INTO reserved;

  IF reserved.id IS NULL THEN
    SELECT * INTO reserved FROM public.whatsapp_notices WHERE dedupe_key = p_dedupe_key;
  END IF;
  INSERT INTO public.whatsapp_notice_ventas (notice_id, venta_id)
    SELECT reserved.id, unnest(p_venta_ids)
    ON CONFLICT DO NOTHING;
  RETURN reserved;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_yappy_payment(p_payment_id uuid, p_venta_id text, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_payment public.yappy_payments%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR (SELECT private.auth_role()) <> 'admin'
    OR NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active)
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 1000 THEN RAISE EXCEPTION 'note too long'; END IF;
  SELECT * INTO v_payment FROM public.yappy_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF v_payment.match_status = 'registrado' AND v_payment.matched_venta_id = p_venta_id THEN RETURN 'registrado'; END IF;
  IF v_payment.match_status IN ('registrado', 'descartado') THEN RAISE EXCEPTION 'payment already resolved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ventas WHERE id = p_venta_id) THEN RAISE EXCEPTION 'sale not found'; END IF;
  UPDATE public.yappy_payments SET match_status = 'registrado', matched_venta_id = p_venta_id,
    resolved_by = auth.uid(), resolved_at = now(), resolution_note = nullif(btrim(p_note), '')
  WHERE id = p_payment_id;
  RETURN 'registrado';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.run_all_validations()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'ventas_sin_servicio', (SELECT COUNT(*) FROM check_ventas_sin_servicio()),
    'ventas_categoria_inconsistente', (SELECT COUNT(*) FROM check_ventas_categoria_inconsistente()),
    'perfiles_ocupados_inconsistentes', (SELECT COUNT(*) FROM check_perfiles_ocupados_inconsistentes()),
    'doble_venta_perfil', (SELECT COUNT(*) FROM check_doble_venta_perfil()),
    'pagos_venta_sin_periodo', (SELECT COUNT(*) FROM check_pagos_venta_sin_periodo()),
    'pagos_servicio_sin_periodo', (SELECT COUNT(*) FROM check_pagos_servicio_sin_periodo()),
    'periodos_venta_saldo_distinto', (SELECT COUNT(*) FROM check_periodos_venta_saldo_distinto()),
    'periodos_servicio_saldo_distinto', (SELECT COUNT(*) FROM check_periodos_servicio_saldo_distinto()),
    'ventas_archivadas_activas', (SELECT COUNT(*) FROM check_ventas_archivadas_activas()),
    'servicios_archivados_activos', (SELECT COUNT(*) FROM check_servicios_archivados_activos())
  );
$function$
;

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
      ('netflix_code_claims'), ('whatsapp_bot_config'), ('whatsapp_bot_versions'), ('whatsapp_bot_events')
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
      ('set_whatsapp_bot_enabled')
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
      ('hide_whatsapp_message')
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

CREATE OR REPLACE FUNCTION public.set_pagos_servicio_categoria_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.categoria_id_snapshot IS NULL THEN
    SELECT s.categoria_id
      INTO NEW.categoria_id_snapshot
    FROM servicios s
    WHERE s.id = NEW.servicio_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_venta_categoria_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_categoria_id TEXT;
  v_archivado_at TIMESTAMPTZ;
BEGIN
  SELECT categoria_id, archivado_at
    INTO v_categoria_id, v_archivado_at
  FROM servicios
  WHERE id = NEW.servicio_id;

  IF v_categoria_id IS NULL THEN
    RAISE EXCEPTION 'servicio_id invalido: %', NEW.servicio_id;
  END IF;

  IF v_archivado_at IS NOT NULL THEN
    RAISE EXCEPTION 'no se puede crear venta sobre servicio archivado: %', NEW.servicio_id;
  END IF;

  NEW.categoria_id = v_categoria_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_whatsapp_bot_enabled(p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'invalid bot enabled flag';
  END IF;

  UPDATE public.whatsapp_bot_config
  SET enabled = p_enabled, updated_at = now(), updated_by = (SELECT auth.uid())
  WHERE id = 'global';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bot configuration missing';
  END IF;

  RETURN p_enabled;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_venta_categoria_from_servicio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_categoria_id TEXT;
BEGIN
  SELECT categoria_id
    INTO v_categoria_id
  FROM servicios
  WHERE id = NEW.servicio_id;

  IF v_categoria_id IS NULL THEN
    RAISE EXCEPTION 'Servicio % no tiene categoria valida', NEW.servicio_id;
  END IF;

  NEW.categoria_id = v_categoria_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.template_button_actions_valid(payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(payload) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT jsonb_array_elements(payload) LOOP
    IF jsonb_typeof(item) <> 'string'
      OR item #>> '{}' NOT IN ('RENOVAR', 'NO_CONTINUAR', 'DATOS', 'NINGUNA') THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_auto_notices()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_secret text; v_url text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_auto_notices_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'whatsapp_auto_notices_url' LIMIT 1;
  -- Sin secretos en vault el automatico no esta configurado: salir sin error para no ensuciar cron.
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 240000) INTO v_request_id;
  RETURN v_request_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_executive_push()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_secret     TEXT;
  v_url        TEXT;
  v_request_id BIGINT;
  v_run_id     UUID;
BEGIN
  v_run_id := public.claim_executive_push_due();
  IF v_run_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'executive_push_cron_secret'
  LIMIT 1;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'executive_push_daily_url'
  LIMIT 1;

  IF v_secret IS NULL OR v_url IS NULL THEN
    UPDATE public.executive_push_runs
    SET
      status = 'failed',
      reason = 'missing_secrets',
      error = 'executive_push secrets not configured in vault',
      finished_at = now()
    WHERE id = v_run_id;

    RAISE EXCEPTION 'executive_push secrets not configured in vault. Run vault.create_secret for executive_push_cron_secret and executive_push_daily_url.';
  END IF;

  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    ),
    body                  := jsonb_build_object('run_id', v_run_id),
    timeout_milliseconds  := 240000
  ) INTO v_request_id;

  UPDATE public.executive_push_runs
  SET request_id = v_request_id
  WHERE id = v_run_id;

  RETURN v_run_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_notice_reply_retries()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_secret text; v_url text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = 'whatsapp_auto_notices_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name = 'whatsapp_notice_replies_retry_url' LIMIT 1;
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 240000) INTO v_request_id;
  RETURN v_request_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_yappy_sync()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_secret text; v_url text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'yappy_sync_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'yappy_sync_url' LIMIT 1;
  IF v_secret IS NULL OR v_url IS NULL THEN RAISE EXCEPTION 'yappy sync vault configuration missing'; END IF;
  SELECT net.http_post(url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 240000) INTO v_request_id;
  RETURN v_request_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_servicio_payment_and_period(p_pago_id text, p_fecha_inicio date, p_fecha_vencimiento date, p_ciclo_pago ciclo_pago_enum, p_costo_original numeric, p_moneda_original text, p_costo_usd numeric, p_exchange_rate numeric, p_renovacion_automatica boolean, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_pago_notas text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_periodo_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT servicio_periodo_id
    INTO v_periodo_id
  FROM pagos_servicio
  WHERE id = p_pago_id
  FOR UPDATE;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'pago_servicio % not found', p_pago_id;
  END IF;

  UPDATE pagos_servicio
  SET monto_original = p_costo_original,
      moneda_original = p_moneda_original,
      monto_usd = p_costo_usd,
      exchange_rate = p_exchange_rate,
      metodo_pago_id = NULLIF(p_metodo_pago_id, ''),
      metodo_pago_nombre_snapshot = NULLIF(p_metodo_pago_nombre_snapshot, ''),
      notas = NULLIF(p_pago_notas, '')
  WHERE id = p_pago_id;

  UPDATE servicio_periodos
  SET fecha_inicio = p_fecha_inicio,
      fecha_vencimiento = p_fecha_vencimiento,
      ciclo_pago = p_ciclo_pago,
      costo_original = p_costo_original,
      moneda_original = p_moneda_original,
      costo_usd = p_costo_usd,
      exchange_rate = p_exchange_rate,
      renovacion_automatica = COALESCE(p_renovacion_automatica, false)
  WHERE id = v_periodo_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_venta_payment_and_period(p_pago_id text, p_fecha_inicio date, p_fecha_fin date, p_ciclo_pago ciclo_pago_enum, p_precio_original numeric, p_descuento numeric, p_total_original numeric, p_moneda_original text, p_total_usd numeric, p_exchange_rate numeric, p_metodo_pago_id text, p_metodo_pago_nombre_snapshot text, p_pago_notas text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_periodo_id TEXT;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT venta_periodo_id
    INTO v_periodo_id
  FROM pagos_venta
  WHERE id = p_pago_id
  FOR UPDATE;

  IF v_periodo_id IS NULL THEN
    RAISE EXCEPTION 'pago_venta % not found', p_pago_id;
  END IF;

  UPDATE pagos_venta
  SET monto_original = p_total_original,
      moneda_original = p_moneda_original,
      monto_usd = p_total_usd,
      exchange_rate = p_exchange_rate,
      metodo_pago_id = NULLIF(p_metodo_pago_id, ''),
      metodo_pago_nombre_snapshot = NULLIF(p_metodo_pago_nombre_snapshot, ''),
      notas = NULLIF(p_pago_notas, '')
  WHERE id = p_pago_id;

  UPDATE venta_periodos
  SET fecha_inicio = p_fecha_inicio,
      fecha_fin = p_fecha_fin,
      ciclo_pago = p_ciclo_pago,
      precio_original = p_precio_original,
      descuento = COALESCE(p_descuento, 0),
      total_original = p_total_original,
      moneda_original = p_moneda_original,
      total_usd = p_total_usd,
      exchange_rate = p_exchange_rate
  WHERE id = v_periodo_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_notification_aggregate(p_base jsonb, p_detail jsonb, p_preserve_existing_state boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.whatsapp_meta_buttons_valid(payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(payload) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT jsonb_array_elements(payload) LOOP
    IF jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item -> 'type') <> 'string'
      OR jsonb_typeof(item -> 'text') <> 'string' THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$function$
;
