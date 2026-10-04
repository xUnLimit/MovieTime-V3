BEGIN;
CREATE FUNCTION public.mt_automation_metrics() RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'pendingMessages',(SELECT count(*) FROM public.whatsapp_automation_inbox WHERE status IN ('queued','leased')),
    'reviewMessages',(SELECT count(*) FROM public.whatsapp_automation_inbox WHERE status='review'),
    'oldestPendingAt',(SELECT min(m.sent_at) FROM public.whatsapp_automation_inbox q JOIN public.whatsapp_inbound_messages m
      ON m.wa_message_id=q.wa_message_id WHERE q.status IN ('queued','leased')),
    'retryAttempts',(SELECT coalesce(sum(greatest(attempts-1,0)),0) FROM public.whatsapp_automation_inbox),
    'averageResolutionSeconds',(SELECT coalesce(round(avg(greatest(extract(epoch FROM (coalesce(q.resolved_at,q.completed_at)-m.sent_at)),0))),0)
      FROM public.whatsapp_automation_inbox q JOIN public.whatsapp_inbound_messages m ON m.wa_message_id=q.wa_message_id
      WHERE coalesce(q.resolved_at,q.completed_at)>=now()-interval '24 hours'),
    'pendingDeliveries',(SELECT count(*) FROM public.mt_order_deliveries WHERE status IN ('queued','leased')),
    'reviewDeliveries',(SELECT count(*) FROM public.mt_order_deliveries WHERE status='review'),
    'pendingInterests',(SELECT count(*) FROM public.mt_interest_deliveries WHERE status IN ('queued','leased')),
    'reviewInterests',(SELECT count(*) FROM public.mt_interest_deliveries WHERE status='review'),
    'ordersToday',(SELECT count(*) FROM public.pedidos WHERE actor_service='whatsapp-commerce'
      AND created_at>=(now() AT TIME ZONE 'America/Panama')::date AT TIME ZONE 'America/Panama'),
    'completedToday',(SELECT count(*) FROM public.pedidos WHERE actor_service='whatsapp-commerce' AND delivery_state='enviado'
      AND created_at>=(now() AT TIME ZONE 'America/Panama')::date AT TIME ZONE 'America/Panama'),
    'aiCallsToday',(SELECT coalesce(sum(calls),0) FROM public.mt_ai_budget WHERE day=(now() AT TIME ZONE 'America/Panama')::date),
    'aiReservedTokensToday',(SELECT coalesce(sum(reserved_tokens),0) FROM public.mt_ai_budget WHERE day=(now() AT TIME ZONE 'America/Panama')::date));
END;
$$;
REVOKE ALL ON FUNCTION public.mt_automation_metrics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_automation_metrics() TO service_role;
COMMIT;
