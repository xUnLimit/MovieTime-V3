BEGIN;
CREATE TABLE public.mt_integration_deliveries (
  consumer text NOT NULL CHECK (consumer IN ('demand-summary')),
  event_id uuid NOT NULL REFERENCES public.domain_events(id),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  locked_until timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  acknowledged_at timestamptz,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  PRIMARY KEY(consumer,event_id)
);
ALTER TABLE public.mt_integration_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_integration_deliveries FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE public.mt_integration_limits (
  minute timestamptz PRIMARY KEY,
  calls integer NOT NULL CHECK (calls BETWEEN 1 AND 60)
);
ALTER TABLE public.mt_integration_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_integration_limits FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION private.mt_integration_limit() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.mt_integration_limits(minute,calls) VALUES(date_trunc('minute',now()),1)
    ON CONFLICT (minute) DO UPDATE SET calls = mt_integration_limits.calls + 1
      WHERE mt_integration_limits.calls < 60;
  IF NOT FOUND THEN RAISE EXCEPTION 'integration rate limited' USING ERRCODE = '54000'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.mt_integration_limit() FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.mt_export_integration_events(p_consumer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event record; v_token uuid; v_rows jsonb := '[]';
BEGIN
  IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' OR p_consumer IS DISTINCT FROM 'demand-summary'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM private.mt_integration_limit();
  IF NOT EXISTS (SELECT 1 FROM public.mt_automation_settings WHERE id AND settings->>'integrationsEnabled' = 'true')
    THEN RETURN v_rows; END IF;
  FOR v_event IN SELECT e.* FROM public.domain_events e
    WHERE e.type IN ('pedido.confirmado','pedido.pagado','pedido.asignado','access.mode_changed','demand.registered')
    AND NOT EXISTS (SELECT 1 FROM public.mt_integration_deliveries d WHERE d.event_id = e.id AND d.consumer = p_consumer
      AND (d.acknowledged_at IS NOT NULL OR d.locked_until > now()))
    ORDER BY e.occurred_at,e.id LIMIT 25 FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.mt_integration_deliveries(consumer,event_id) VALUES(p_consumer,v_event.id)
      ON CONFLICT (consumer,event_id) DO UPDATE SET token = gen_random_uuid(),locked_until = now() + interval '5 minutes',
        attempts = mt_integration_deliveries.attempts + 1
      WHERE mt_integration_deliveries.acknowledged_at IS NULL AND mt_integration_deliveries.locked_until <= now()
      RETURNING token INTO v_token;
    IF FOUND THEN
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('id',v_event.id,'token',v_token,'type',v_event.type,
        'version',v_event.event_version,'correlationId',v_event.correlation_id,'aggregateId',v_event.aggregate_id,'occurredAt',v_event.occurred_at,
        'data',jsonb_strip_nulls(jsonb_build_object('state',coalesce(v_event.payload->'state',v_event.payload->'estado'),
          'amount',coalesce(v_event.payload->'amount',v_event.payload->'total'),
          'currency',coalesce(v_event.payload->'currency',v_event.payload->'moneda'),'categoryId',v_event.payload->'categoryId'))));
    END IF;
  END LOOP;
  RETURN v_rows;
END;
$$;
CREATE FUNCTION public.mt_ack_integration_event(p_consumer text,p_event_id uuid,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' OR p_consumer IS DISTINCT FROM 'demand-summary'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM private.mt_integration_limit();
  UPDATE public.mt_integration_deliveries SET acknowledged_at = coalesce(acknowledged_at,now())
    WHERE consumer = p_consumer AND event_id = p_event_id AND token = p_token
      AND (locked_until > now() OR acknowledged_at IS NOT NULL);
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_export_integration_events(text), public.mt_ack_integration_event(text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mt_export_integration_events(text), public.mt_ack_integration_event(text,uuid,uuid) TO service_role;
COMMIT;
