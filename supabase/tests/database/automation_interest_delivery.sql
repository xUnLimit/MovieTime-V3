BEGIN;
SELECT plan(37);
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
VALUES('00000000-0000-0000-0000-000000000000','b1111111-1111-4111-8111-111111111111','authenticated','authenticated','interest-admin@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='b1111111-1111-4111-8111-111111111111';
INSERT INTO public.categorias(id,nombre,tipo) VALUES('b2222222-2222-4222-8222-222222222222','Interest fixture','cliente');
INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES('b3333333-3333-4333-8333-333333333333','b2222222-2222-4222-8222-222222222222','Individual');
INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,ciclo_pago,precio)
VALUES('b4444444-4444-4444-8444-444444444444','b2222222-2222-4222-8222-222222222222','b3333333-3333-4333-8333-333333333333','Mensual','mensual',10);
INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles,en_reposo)
VALUES('b5555555-5555-4555-8555-555555555555','b2222222-2222-4222-8222-222222222222','b3333333-3333-4333-8333-333333333333','Interest fixture','interest@example.test',gen_random_uuid()::text,1,true);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
CREATE TEMP TABLE interest_fixture AS SELECT public.mt_register_interest('50760000888','b2222222-2222-4222-8222-222222222222','b4444444-4444-4444-8444-444444444444',false)::uuid AS id;
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.mt_interest_deliveries'::regclass),'interest ledger has RLS');
SELECT ok(NOT has_function_privilege('authenticated','public.mt_claim_automatic_interest(uuid,boolean)','EXECUTE'),'clients cannot initiate automatic invitation');
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'no consent forbids invitation');
UPDATE public.intereses SET consent_at=now() WHERE id=(SELECT id FROM interest_fixture);
UPDATE public.config SET whatsapp_auto_enabled=true WHERE id='global';
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'stock in reposo is unavailable');
UPDATE public.servicios SET en_reposo=false WHERE id='b5555555-5555-4555-8555-555555555555';
UPDATE public.intereses SET paused_at=now() WHERE id=(SELECT id FROM interest_fixture);
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'paused invitation is not sent');
UPDATE public.intereses SET paused_at=NULL WHERE id=(SELECT id FROM interest_fixture);
UPDATE public.config SET whatsapp_auto_enabled=false WHERE id='global';
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'global off prevents automatic invitation');
UPDATE public.config SET whatsapp_auto_enabled=true WHERE id='global';
INSERT INTO public.whatsapp_conversation_state(wa_id,mode) VALUES('50760000888','human');
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'human-owned chat prevents second responder');
UPDATE public.whatsapp_conversation_state SET mode='bot' WHERE wa_id='50760000888';
CREATE TEMP TABLE interest_claim AS SELECT public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)) AS value;
SELECT ok((SELECT value IS NOT NULL FROM interest_claim),'returned stock claims only consented interest');
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'same conversation cannot have two senders');
SELECT ok(public.mt_check_interest_delivery((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim)),'fenced invitation is current');
UPDATE public.intereses SET paused_at=now() WHERE id=(SELECT id FROM interest_fixture);
SELECT ok(NOT public.mt_check_interest_delivery((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim)),'pausing after claim invalidates pre-send check');
UPDATE public.intereses SET paused_at=NULL WHERE id=(SELECT id FROM interest_fixture);
UPDATE public.servicios SET en_reposo=true WHERE id='b5555555-5555-4555-8555-555555555555';
SELECT ok(NOT public.mt_check_interest_delivery((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim)),'stock exhaustion after claim invalidates send');
UPDATE public.servicios SET en_reposo=false WHERE id='b5555555-5555-4555-8555-555555555555';
SELECT ok(public.mt_finish_automatic_interest((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim),'retry'),'failure remains recoverable');
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'retry respects backoff');
UPDATE public.mt_interest_deliveries SET available_at=now()-interval '1 minute' WHERE interest_id=(SELECT id FROM interest_fixture);
UPDATE interest_claim SET value=public.mt_claim_automatic_interest((SELECT id FROM interest_fixture));
INSERT INTO public.whatsapp_outbound_messages(id,idempotency_key,to_wa_id,message_kind,text_body,send_status,wa_message_id)
VALUES('b8888888-8888-4888-8888-888888888888',gen_random_uuid(),'50760000888','text','Stock fixture','accepted','interest.out');
SELECT throws_ok($$SELECT public.mt_finish_automatic_interest((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim),'accepted','b8888888-8888-4888-8888-888888888888')$$,'P0001','interest_not_accepted','unrelated accepted message cannot mark invitation');
UPDATE public.whatsapp_outbound_messages SET idempotency_key=(SELECT id FROM interest_fixture) WHERE id='b8888888-8888-4888-8888-888888888888';
SELECT ok(public.mt_finish_automatic_interest((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim),'accepted','b8888888-8888-4888-8888-888888888888'),'own accepted invitation completes');
SELECT is((SELECT estado::text FROM public.intereses WHERE id=(SELECT id FROM interest_fixture)),'avisado','interest is notified only after API acceptance');
SELECT ok((SELECT invite_until>now() FROM public.intereses WHERE id=(SELECT id FROM interest_fixture)),'accepted invitation has expiration');
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'accepted invitation is not sent again');
SELECT is((SELECT lease_token FROM public.whatsapp_conversation_state WHERE wa_id='50760000888'),NULL::uuid,'conversation lease is released');
SELECT set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SELECT throws_ok($$SELECT public.mt_claim_automatic_interest()$$,'42501','forbidden','administrator session cannot forge service auto invocation');
SELECT ok(NOT has_table_privilege('authenticated','public.mt_interest_deliveries','INSERT'),'operator cannot forge invitation ledger');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
UPDATE interest_fixture SET id=public.mt_register_interest('50760000889','b2222222-2222-4222-8222-222222222222','b4444444-4444-4444-8444-444444444444',true)::uuid;
UPDATE interest_claim SET value=public.mt_claim_automatic_interest((SELECT id FROM interest_fixture));
SELECT ok((SELECT value IS NOT NULL FROM interest_claim),'another consented interest may acquire its own chat');
SELECT set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SELECT ok(public.set_whatsapp_conversation_mode('50760000889','human',(SELECT (value->>'fence')::bigint FROM interest_claim)),'operator takeover fences pending invitation');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT ok(NOT public.mt_check_interest_delivery((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim)),'taken chat fails final send check');
SELECT ok(NOT public.mt_finish_automatic_interest((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim),'retry'),'stale worker cannot mutate the newer conversation lease');
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'automatic recovery respects human owner');
UPDATE public.config SET whatsapp_auto_enabled=false WHERE id='global';
UPDATE interest_claim SET value=public.mt_claim_automatic_interest((SELECT id FROM interest_fixture),true);
SELECT ok((SELECT value IS NOT NULL FROM interest_claim),'explicit manual invitation shares lease while automatic is off');
SELECT ok(public.mt_check_interest_delivery((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim)),'explicit manual invitation remains authorized');
SELECT ok(public.mt_finish_automatic_interest((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim),'retry'),'manual failure has the same recoverable state');
UPDATE public.mt_interest_deliveries SET attempts=5,available_at=now()-interval '1 minute' WHERE interest_id=(SELECT id FROM interest_fixture);
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture),true),NULL::jsonb,'retry count is finite');
SELECT is((SELECT status FROM public.mt_interest_deliveries WHERE interest_id=(SELECT id FROM interest_fixture)),'review','exhausted invitations require review');
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture)),NULL::jsonb,'automatic review does not silently restart delivery');
SELECT throws_ok($$SELECT public.mt_finish_automatic_interest((SELECT id FROM interest_fixture),gen_random_uuid(),1,'unexpected')$$,'P0001','invalid_interest_result','untrusted completion outcome is rejected');
UPDATE interest_claim SET value=public.mt_claim_automatic_interest((SELECT id FROM interest_fixture),true);
SELECT ok((SELECT value IS NOT NULL FROM interest_claim),'manual action can restart definite exhausted failures');
SELECT ok(public.mt_finish_automatic_interest((SELECT id FROM interest_fixture),(SELECT (value->>'token')::uuid FROM interest_claim),
 (SELECT (value->>'fence')::bigint FROM interest_claim),'review'),'uncertain invitation requires history review');
SELECT is(public.mt_claim_automatic_interest((SELECT id FROM interest_fixture),true),NULL::jsonb,'manual action cannot resend uncertain invitation');
SELECT * FROM finish();
ROLLBACK;
