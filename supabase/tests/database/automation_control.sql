BEGIN;
SELECT no_plan();

INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at) VALUES
('00000000-0000-0000-0000-000000000000','61111111-1111-4111-8111-111111111111','authenticated','authenticated','automation-admin@example.test','',now()),
('00000000-0000-0000-0000-000000000000','62222222-2222-4222-8222-222222222222','authenticated','authenticated','automation-operator@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='61111111-1111-4111-8111-111111111111';
INSERT INTO public.categorias(id,nombre,tipo) VALUES('63333333-3333-4333-8333-333333333333','Netflix Control','cliente');
INSERT INTO public.servicios(id,categoria_id,nombre,correo,contrasena,perfiles_disponibles)
VALUES('64444444-4444-4444-8444-444444444444','63333333-3333-4333-8333-333333333333','Control','fixture@example.test','synthetic-credential',2);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.mt_service_access'::regclass),'access RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.mt_automation_settings'::regclass),'settings RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.mt_ai_budget'::regclass),'budget RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.mt_integration_deliveries'::regclass),'integration RLS enabled');
SELECT ok(NOT has_function_privilege('anon','public.mt_set_service_access(text,text,boolean)','EXECUTE'),'anonymous cannot change access');
SELECT ok(NOT has_function_privilege('authenticated','public.mt_claim_ai_budget(integer)','EXECUTE'),'users cannot bypass AI budget');
SELECT ok(NOT has_function_privilege('authenticated','public.mt_register_interest(text,text,text,boolean)','EXECUTE'),'contact identity cannot be chosen by a client');
SELECT ok(NOT has_table_privilege('service_role','public.mt_service_access','UPDATE'),'service cannot change access policy directly');

SELECT set_config('request.jwt.claims','{"sub":"62222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.mt_service_access),0::bigint,'operator cannot read policies');
SELECT throws_ok($$SELECT public.mt_set_service_access('64444444-4444-4444-8444-444444444444','code',true)$$,'42501','forbidden','operator cannot enable code access');
SELECT throws_ok($$SELECT public.mt_update_automation_settings('{}')$$,'42501','forbidden','operator cannot configure automation');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.mt_set_service_access('64444444-4444-4444-8444-444444444444','code',false)$$,'22023','rotation required','code requires explicit prior rotation');
SELECT is(public.mt_set_service_access('64444444-4444-4444-8444-444444444444','code',true),'64444444-4444-4444-8444-444444444444','active admin enables verified account');
SELECT is((SELECT mode FROM public.mt_service_access WHERE service_id='64444444-4444-4444-8444-444444444444'),'code','policy is stored separately from password');
SELECT throws_ok($$SELECT public.mt_set_service_access('00000000-0000-4000-8000-000000000000','code',true)$$,'22023','service unavailable','missing account rejected');
SELECT throws_ok($$SELECT public.mt_update_automation_settings('{"aiMode":"queries","model":"","dailyCalls":1,"dailyTokens":4096,"reservationMinutes":30,"maxReservations":1,"integrationsEnabled":true}')$$,'22023','invalid settings','AI cannot activate with empty model');
SELECT throws_ok($$SELECT public.mt_update_automation_settings('{"aiMode":"queries","model":"test","dailyCalls":null,"dailyTokens":4096,"reservationMinutes":30,"maxReservations":1,"integrationsEnabled":true}')$$,'22023','invalid settings','null quota rejected at database boundary');
SELECT is(public.mt_update_automation_settings('{"aiMode":"queries","model":"configured-model","dailyCalls":1,"dailyTokens":4096,"reservationMinutes":20,"maxReservations":1,"integrationsEnabled":true}'),'global','valid controlled settings accepted');
RESET ROLE;
SELECT is((SELECT reserva_ttl_minutos FROM public.catalogo_ajustes WHERE id='global'),20,'reservation duration changes atomically with settings');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT is(public.mt_claim_ai_budget(4096),true,'first call reserves conservative budget');
SELECT is(public.mt_claim_ai_budget(4096),false,'subsequent call cannot exceed quota');
SELECT throws_ok($$SELECT public.mt_claim_ai_budget(0)$$,'22023','invalid tokens','nonpositive budget invalid');
SELECT is(public.mt_register_interest('50760000001','63333333-3333-4333-8333-333333333333',null,false),
  public.mt_register_interest('50760000001','63333333-3333-4333-8333-333333333333',null,false),'repeated interest reuses its identity');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.intereses WHERE contact_id='50760000001'),1::bigint,'interest does not duplicate contact demand');
SELECT ok((SELECT consent_at IS NULL FROM public.intereses WHERE contact_id='50760000001'),'interest does not imply campaign consent');
SELECT throws_ok($$SELECT public.mt_claim_interest_notice((SELECT id FROM public.intereses WHERE contact_id='50760000001'))$$,'22023','recipient unavailable','consent required before invitation');
SELECT public.mt_register_interest('50760000001','63333333-3333-4333-8333-333333333333',null,true);
SELECT is(public.mt_claim_interest_notice((SELECT id FROM public.intereses WHERE contact_id='50760000001'))->>'contact','50760000001','recipient comes from recorded consent');
SELECT set_config('request.jwt.claims','{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SELECT public.mt_manage_interest((SELECT id FROM public.intereses WHERE contact_id='50760000001'),'pause');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT throws_ok($$SELECT public.mt_claim_interest_notice((SELECT id FROM public.intereses WHERE contact_id='50760000001'))$$,'22023','recipient unavailable','paused invitation cannot send');
SELECT set_config('request.jwt.claims','{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SELECT public.mt_manage_interest((SELECT id FROM public.intereses WHERE contact_id='50760000001'),'resume');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.mt_finish_interest_notice((SELECT id FROM public.intereses WHERE contact_id='50760000001'));
SELECT is((SELECT estado FROM public.intereses WHERE contact_id='50760000001'),'avisado','accepted invitation advances demand state');
SELECT ok((SELECT invite_until <= now() + interval '30 minutes' FROM public.intereses WHERE contact_id='50760000001'),'invitation has finite expiry without holding inventory');

INSERT INTO public.domain_events(id,type,aggregate_type,aggregate_id,payload)
VALUES('65555555-5555-4555-8555-555555555555','pedido.pagado','pedido','fake-order','{"total":8,"moneda":"USD","password":"synthetic","contact":"50760000000"}');
CREATE TEMP TABLE exported AS SELECT public.mt_export_integration_events('demand-summary') AS events;
SELECT ok(EXISTS(SELECT 1 FROM exported,jsonb_array_elements(events) e WHERE e->>'id'='65555555-5555-4555-8555-555555555555'),'allowed event exported');
SELECT ok(NOT EXISTS(SELECT 1 FROM exported,jsonb_array_elements(events) e WHERE (e->'data') ? 'password' OR (e->'data') ? 'contact'),'integration strips secrets and contact data');
SELECT ok((SELECT processed_at IS NULL FROM public.domain_events WHERE id='65555555-5555-4555-8555-555555555555'),'export does not consume event for future consumers');
SELECT is(public.mt_ack_integration_event('demand-summary','65555555-5555-4555-8555-555555555555','00000000-0000-4000-8000-000000000000'),false,'stale or invented token cannot acknowledge');
SELECT is(public.mt_ack_integration_event('demand-summary','65555555-5555-4555-8555-555555555555',
  (SELECT token FROM public.mt_integration_deliveries WHERE event_id='65555555-5555-4555-8555-555555555555')),true,'consumer acknowledges its own lease');
SELECT is(public.mt_ack_integration_event('demand-summary','65555555-5555-4555-8555-555555555555',
  (SELECT token FROM public.mt_integration_deliveries WHERE event_id='65555555-5555-4555-8555-555555555555')),true,'acknowledgment idempotent');
SELECT throws_ok($$SELECT public.mt_export_integration_events('finance')$$,'42501','forbidden','integration consumer cannot choose another scope');
SELECT ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.mt_export_integration_events('demand-summary')) e
  WHERE e->>'id'='65555555-5555-4555-8555-555555555555'),'acknowledged event is not redelivered');
SELECT ok(NOT has_function_privilege('authenticated','public.mt_automation_metrics()','EXECUTE'),'operators cannot read aggregate operational data directly');
SELECT ok(has_function_privilege('service_role','public.mt_automation_metrics()','EXECUTE'),'authorized server can read aggregate metrics');
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,text_body,sent_at)
  VALUES('wamid.automation-metrics-fixture','123','50760000009','text','synthetic fixture',now()-interval '5 minutes');
SELECT is((public.mt_automation_metrics()->>'pendingMessages')::integer,1,'new durable input appears in pending metrics');
SELECT ok(public.mt_automation_metrics()->>'oldestPendingAt' IS NOT NULL,'pending age is visible');
SELECT ok(NOT (public.mt_automation_metrics() ? 'contact'),'aggregate metrics do not expose contacts');
SELECT * FROM finish();
ROLLBACK;
