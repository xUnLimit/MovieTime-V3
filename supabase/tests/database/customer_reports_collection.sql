BEGIN;
SELECT plan(31);
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000000','95555555-5555-4555-8555-555555555555','authenticated','authenticated','reports-admin@example.test','',now()),
('00000000-0000-0000-0000-000000000000','96666666-6666-4666-8666-666666666666','authenticated','authenticated','reports-user@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='95555555-5555-4555-8555-555555555555';
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.customer_reports'::regclass), 'reports RLS enabled');
SELECT ok(NOT has_table_privilege('anon','public.customer_reports','SELECT'), 'anon cannot read reports');
SELECT ok(NOT has_table_privilege('authenticated','public.customer_reports','INSERT'), 'clients cannot forge reports');
SELECT ok(NOT has_function_privilege('authenticated','public.create_customer_report(text,text,text,uuid,bigint)','EXECUTE'), 'only workers create reports');

INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,text_body,sent_at)
VALUES ('reports-before-human','fixture','50760000071','text','hola',now());
SELECT set_config('request.jwt.claims','{"sub":"95555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT ok(public.set_whatsapp_conversation_mode('50760000071','human',0), 'operator takes chat');
RESET ROLE;
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,text_body,sent_at)
VALUES ('reports-during-human','fixture','50760000071','text','cancelar',now());
SELECT is((SELECT count(*) FROM public.whatsapp_automation_inbox WHERE wa_id='50760000071' AND status<>'done'),0::bigint,'no work accumulates during human attention');
SELECT is((SELECT count(*) FROM public.whatsapp_inbound_messages WHERE from_wa_id='50760000071'),2::bigint,'history remains intact');
SET LOCAL ROLE authenticated;
SELECT ok(public.set_whatsapp_conversation_mode('50760000071','bot',1),'operator resumes bot');
RESET ROLE;
SELECT is(public.claim_whatsapp_automation(90),NULL::jsonb,'resume does not replay history');
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,text_body,sent_at)
VALUES ('reports-after-resume','fixture','50760000071','text','hola',now());
SELECT is(public.claim_whatsapp_automation(90)->'message'->>'wa_message_id','reports-after-resume','only new messages activate the resumed bot');

INSERT INTO public.whatsapp_conversation_state(wa_id) VALUES ('50760000072');
INSERT INTO public.whatsapp_bot_waits(wa_id,node_id,expires_at,collect_minutes) VALUES ('50760000072','problema',now()+interval '12 hours',1);
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,text_body,sent_at)
VALUES ('reports-part-1','fixture','50760000072','text','El servicio no abre.',now()), ('reports-part-2','fixture','50760000072','text','Desde ayer.',now());
SELECT is(public.claim_whatsapp_automation(90),NULL::jsonb,'first message starts a window without answering');
SELECT is((SELECT count(DISTINCT available_at) FROM public.whatsapp_automation_inbox WHERE wa_id='50760000072'),1::bigint,'subsequent messages share the fixed deadline');
SELECT ok((SELECT collect_started_at IS NOT NULL FROM public.whatsapp_bot_waits WHERE wa_id='50760000072'),'collection start persisted');
UPDATE public.whatsapp_automation_inbox SET available_at=now()-interval '1 second' WHERE wa_id='50760000072';
CREATE TEMP TABLE report_claim AS SELECT public.claim_whatsapp_automation(90) AS value;
SELECT is((SELECT value->'message'->>'text_body' FROM report_claim),E'El servicio no abre.\n\nDesde ayer.','whole explanation delivered once in arrival order');
SELECT is(public.claim_whatsapp_automation(90),NULL::jsonb,'parallel worker cannot process same group');
SELECT is((SELECT count(*) FROM public.customer_reports),0::bigint,'collection itself never creates a report');
CREATE TEMP TABLE report_id AS SELECT public.create_customer_report('50760000072','reports-part-1',E'El servicio no abre.\n\nDesde ayer.',(SELECT (value->>'token')::uuid FROM report_claim),(SELECT (value->>'fence')::bigint FROM report_claim)) AS value;
GRANT SELECT ON report_id TO authenticated;
SELECT is(public.create_customer_report('50760000072','reports-part-1','Retry',(SELECT (value->>'token')::uuid FROM report_claim),(SELECT (value->>'fence')::bigint FROM report_claim)),(SELECT value FROM report_id),'retry reuses the same report');
SELECT is((SELECT description FROM public.customer_reports WHERE id=(SELECT value FROM report_id)),E'El servicio no abre.\n\nDesde ayer.','retry cannot replace original explanation');
SELECT ok(public.finish_whatsapp_automation((SELECT (value->>'id')::bigint FROM report_claim),(SELECT (value->>'token')::uuid FROM report_claim),(SELECT (value->>'fence')::bigint FROM report_claim),'handoff'),'report hands chat to team');
SELECT is((SELECT count(*) FROM public.whatsapp_automation_inbox WHERE wa_id='50760000072' AND status<>'done'),0::bigint,'all collected messages completed atomically');
SELECT is((SELECT count(*) FROM public.whatsapp_inbound_messages WHERE from_wa_id='50760000072' AND processed_at IS NOT NULL),2::bigint,'individual history marked processed');
SELECT is((SELECT mode FROM public.whatsapp_conversation_state WHERE wa_id='50760000072'),'human','report is attended by a person');
SELECT throws_ok($$SELECT public.create_customer_report('50760000072','reports-part-1','bad','00000000-0000-4000-8000-000000000001',0)$$,'P0001','Invalid automation lease','stale worker cannot create a report');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.customer_reports),1::bigint,'admin can read report');
SELECT ok(public.update_customer_report((SELECT value FROM report_id),'in_progress',0),'admin begins attention');
SELECT ok(NOT public.update_customer_report((SELECT value FROM report_id),'resolved',0),'stale status change rejected');
SELECT ok(public.update_customer_report((SELECT value FROM report_id),'resolved',1),'admin resolves report');
RESET ROLE;
SELECT is((SELECT updated_by FROM public.customer_reports),'95555555-5555-4555-8555-555555555555'::uuid,'status actor audited');
SELECT set_config('request.jwt.claims','{"sub":"96666666-6666-4666-8666-666666666666","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.customer_reports),0::bigint,'operator cannot read reports');
SELECT throws_ok($$SELECT public.update_customer_report('00000000-0000-4000-8000-000000000001','resolved',0)$$,'42501','Unauthorized','operator cannot change reports');
RESET ROLE;
SELECT throws_ok($$SELECT public.create_customer_report('50760000072','reports-part-1','bad',NULL,NULL)$$,'P0001','Invalid automation lease','missing lease fails closed');
SELECT * FROM finish();
ROLLBACK;
