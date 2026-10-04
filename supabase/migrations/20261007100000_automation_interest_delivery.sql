-- Consented stock invitations share the conversation fence with replies and access.
CREATE TABLE public.mt_interest_deliveries (
  interest_id UUID PRIMARY KEY REFERENCES public.intereses(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','leased','accepted','review')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_token UUID, fence BIGINT, locked_until TIMESTAMPTZ, manual BOOLEAN NOT NULL DEFAULT false,
  outbound_id UUID REFERENCES public.whatsapp_outbound_messages(id), failure_code TEXT
);
ALTER TABLE public.mt_interest_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mt_interest_deliveries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.mt_interest_deliveries TO authenticated;
CREATE POLICY mt_interest_deliveries_admin ON public.mt_interest_deliveries FOR SELECT TO authenticated
  USING((SELECT private.auth_role())='admin');
CREATE INDEX mt_interest_deliveries_pending ON public.mt_interest_deliveries(available_at) WHERE status IN('queued','leased');
CREATE INDEX mt_interest_deliveries_outbound ON public.mt_interest_deliveries(outbound_id) WHERE outbound_id IS NOT NULL;

CREATE FUNCTION private.mt_interest_eligible(p_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.intereses i JOIN public.categorias c ON c.id=i.categoria_id
   WHERE i.id=p_id AND i.estado='esperando' AND i.consent_at IS NOT NULL AND i.paused_at IS NULL
     AND i.contact_id ~ '^507[0-9]{8}$' AND c.activo
     AND (i.plan_id IS NULL OR EXISTS(SELECT 1 FROM public.planes p WHERE p.id=i.plan_id AND p.activo))
     AND EXISTS(SELECT 1 FROM public.servicios s WHERE s.categoria_id=i.categoria_id
       AND s.activo AND NOT s.en_reposo AND s.cortado_at IS NULL AND s.archivado_at IS NULL
       AND s.perfiles_disponibles>s.perfiles_ocupados+(SELECT count(*) FROM public.reservas_perfil r
         WHERE r.servicio_id=s.id AND r.cerrada_at IS NULL AND r.expira_at>now())
       AND (i.plan_id IS NULL OR s.plan_tipo_id=(SELECT plan_tipo_id FROM public.planes WHERE id=i.plan_id))))
$$;
REVOKE ALL ON FUNCTION private.mt_interest_eligible(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mt_claim_automatic_interest(p_id UUID DEFAULT NULL,p_manual BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cs public.whatsapp_conversation_state; job public.mt_interest_deliveries; interest_row public.intereses; lease UUID:=gen_random_uuid();
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_manual IS NULL OR (p_manual AND p_id IS NULL) THEN RAISE EXCEPTION 'invalid_interest_claim'; END IF;
 IF NOT p_manual AND NOT EXISTS(SELECT 1 FROM public.config WHERE id='global' AND whatsapp_auto_enabled) THEN RETURN NULL; END IF;
 IF p_manual THEN
   UPDATE public.mt_interest_deliveries SET status='queued',attempts=0,available_at=now(),failure_code=NULL
   WHERE interest_id=p_id AND status='review' AND failure_code IN('DELIVERY_FAILED','RETRIES_EXHAUSTED')
     AND private.mt_interest_eligible(p_id);
 END IF;
 INSERT INTO public.mt_interest_deliveries(interest_id)
 SELECT id FROM public.intereses i WHERE (p_id IS NULL OR id=p_id) AND private.mt_interest_eligible(id)
 AND NOT EXISTS(SELECT 1 FROM public.mt_interest_deliveries existing WHERE existing.interest_id=i.id)
 ORDER BY created_at,id LIMIT 10 ON CONFLICT DO NOTHING;
 INSERT INTO public.whatsapp_conversation_state(wa_id)
 SELECT DISTINCT i.contact_id FROM public.intereses i JOIN public.mt_interest_deliveries d ON d.interest_id=i.id
 WHERE d.status='queued' AND d.available_at<=now() AND (p_id IS NULL OR i.id=p_id) AND private.mt_interest_eligible(i.id)
 LIMIT 10 ON CONFLICT DO NOTHING;
 SELECT c.* INTO cs FROM public.whatsapp_conversation_state c WHERE (p_manual OR c.mode='bot')
 AND (c.locked_until IS NULL OR c.locked_until<now()) AND EXISTS(SELECT 1 FROM public.mt_interest_deliveries d
   JOIN public.intereses i ON i.id=d.interest_id WHERE i.contact_id=c.wa_id AND d.status IN('queued','leased')
   AND d.available_at<=now() AND (p_id IS NULL OR i.id=p_id) AND private.mt_interest_eligible(i.id))
 ORDER BY c.updated_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT x.* INTO job FROM public.mt_interest_deliveries x JOIN public.intereses n ON n.id=x.interest_id
 WHERE n.contact_id=cs.wa_id AND x.status IN('queued','leased') AND x.available_at<=now()
   AND (p_id IS NULL OR n.id=p_id) AND private.mt_interest_eligible(n.id) ORDER BY n.created_at,n.id FOR UPDATE OF x LIMIT 1;
 IF job.attempts>=5 THEN UPDATE public.mt_interest_deliveries SET status='review',failure_code='RETRIES_EXHAUSTED' WHERE interest_id=job.interest_id; RETURN NULL; END IF;
 UPDATE public.whatsapp_conversation_state SET version=version+1,lease_token=lease,locked_until=now()+interval '90 seconds',updated_at=now()
 WHERE wa_id=cs.wa_id RETURNING * INTO cs;
 UPDATE public.mt_interest_deliveries SET status='leased',attempts=attempts+1,lease_token=lease,fence=cs.version,
 locked_until=cs.locked_until,manual=p_manual WHERE interest_id=job.interest_id RETURNING * INTO job;
 SELECT * INTO interest_row FROM public.intereses WHERE id=job.interest_id;
 RETURN jsonb_build_object('id',interest_row.id,'contact',interest_row.contact_id,'name',(SELECT nombre FROM public.categorias WHERE id=interest_row.categoria_id),
   'token',lease,'fence',job.fence,'attempts',job.attempts);
END;
$$;
REVOKE ALL ON FUNCTION public.mt_claim_automatic_interest(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_claim_automatic_interest(UUID,BOOLEAN) TO service_role;

CREATE FUNCTION public.mt_check_interest_delivery(p_id UUID,p_token UUID,p_fence BIGINT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN EXISTS(SELECT 1 FROM public.mt_interest_deliveries d JOIN public.intereses i ON i.id=d.interest_id
 JOIN public.whatsapp_conversation_state c ON c.wa_id=i.contact_id WHERE d.interest_id=p_id
 AND d.status='leased' AND d.lease_token=p_token AND d.fence=p_fence AND d.locked_until>now()
 AND c.lease_token=p_token AND c.version=p_fence AND c.locked_until>now() AND (d.manual OR c.mode='bot')
 AND (d.manual OR EXISTS(SELECT 1 FROM public.config WHERE id='global' AND whatsapp_auto_enabled)) AND private.mt_interest_eligible(i.id));
END;
$$;
REVOKE ALL ON FUNCTION public.mt_check_interest_delivery(UUID,UUID,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_check_interest_delivery(UUID,UUID,BIGINT) TO service_role;

CREATE FUNCTION public.mt_finish_automatic_interest(p_id UUID,p_token UUID,p_fence BIGINT,p_result TEXT,p_outbound_id UUID DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cs public.whatsapp_conversation_state; d public.mt_interest_deliveries;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_result IS NULL OR p_result NOT IN('accepted','retry','review') THEN RAISE EXCEPTION 'invalid_interest_result'; END IF;
 SELECT c.* INTO cs FROM public.whatsapp_conversation_state c JOIN public.intereses i ON i.contact_id=c.wa_id
 WHERE i.id=p_id FOR UPDATE OF c;
 IF NOT FOUND OR cs.lease_token IS DISTINCT FROM p_token OR cs.version<>p_fence OR cs.locked_until<=now() THEN RETURN false; END IF;
 SELECT * INTO d FROM public.mt_interest_deliveries WHERE interest_id=p_id FOR UPDATE;
 IF d.status<>'leased' OR d.lease_token IS DISTINCT FROM p_token OR d.fence<>p_fence THEN RETURN false; END IF;
 IF p_result='accepted' AND NOT EXISTS(SELECT 1 FROM public.whatsapp_outbound_messages o
 WHERE o.id=p_outbound_id AND o.to_wa_id=cs.wa_id AND o.idempotency_key=p_id AND o.send_status='accepted') THEN RAISE EXCEPTION 'interest_not_accepted'; END IF;
 UPDATE public.mt_interest_deliveries SET status=CASE WHEN p_result='accepted' THEN 'accepted'
 WHEN p_result='review' OR attempts>=5 THEN 'review' ELSE 'queued' END,lease_token=NULL,locked_until=NULL,
 available_at=now()+make_interval(secs=>least(900,30*(2^least(attempts,5))::integer)),outbound_id=coalesce(p_outbound_id,outbound_id),
 failure_code=CASE WHEN p_result='review' THEN 'DELIVERY_UNCERTAIN' WHEN p_result='retry' THEN 'DELIVERY_FAILED' END WHERE interest_id=p_id;
 IF p_result='accepted' THEN UPDATE public.intereses SET estado='avisado',avisado_at=now(),invite_until=now()+interval '30 minutes',notice_attempts=notice_attempts+1 WHERE id=p_id; END IF;
 UPDATE public.whatsapp_conversation_state SET lease_token=NULL,locked_until=NULL,updated_at=now() WHERE wa_id=cs.wa_id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_finish_automatic_interest(UUID,UUID,BIGINT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mt_finish_automatic_interest(UUID,UUID,BIGINT,TEXT,UUID) TO service_role;
