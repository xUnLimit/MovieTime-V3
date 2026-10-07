BEGIN;
SELECT plan(43);
SELECT has_table('public', 'whatsapp_automation_inbox', 'durable inbox exists');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.whatsapp_automation_inbox'::regclass), 'inbox RLS active');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.whatsapp_conversation_state'::regclass), 'conversation RLS active');
SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_whatsapp_automation(integer)', 'EXECUTE'), 'users cannot claim jobs');
SELECT ok(NOT has_function_privilege('anon', 'public.set_whatsapp_conversation_mode(text,text,bigint)', 'EXECUTE'), 'anon cannot take conversations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.whatsapp_automation_inbox', 'INSERT'), 'users cannot forge jobs');
SELECT ok(NOT has_table_privilege('anon', 'public.whatsapp_conversation_state', 'SELECT'), 'anon cannot read conversations');
SELECT is(public.normalize_panama_wa_id('6000-0088'), '50760000088', 'local phone identity canonical');
SELECT is(public.normalize_panama_wa_id('+507 6000 0088'), '50760000088', 'international format identity canonical');
SELECT is(public.normalize_panama_wa_id('invalid'), NULL, 'invalid phone fails closed');

INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000000','93333333-3333-4333-8333-333333333333','authenticated','authenticated','inbox-admin@example.test','',now());
UPDATE public.usuarios SET role = 'admin' WHERE id = '93333333-3333-4333-8333-333333333333';
INSERT INTO public.whatsapp_inbound_messages(wa_message_id, phone_number_id, from_wa_id, message_type, text_body, sent_at)
VALUES ('inbox-fixture-1','123','50760000088','text','catalogo',now()),('inbox-fixture-2','123','50760000088','text','carrito',now());
SELECT is((SELECT count(*) FROM public.whatsapp_automation_inbox WHERE wa_id = '50760000088'), 2::bigint, 'ingestion enqueues atomically');
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,sent_at)
VALUES ('inbox-fixture-1','123','50760000088','text',now()) ON CONFLICT DO NOTHING;
SELECT is((SELECT count(*) FROM public.whatsapp_automation_inbox WHERE wa_id = '50760000088'), 2::bigint, 'delivery deduplicates');

CREATE TEMP TABLE inbox_claim AS SELECT public.claim_whatsapp_automation(90) AS value;
SELECT is((SELECT value->'message'->>'wa_message_id' FROM inbox_claim), 'inbox-fixture-1', 'head is processed first');
SELECT is(public.claim_whatsapp_automation(90), NULL::jsonb, 'second worker cannot claim same conversation');
SELECT ok(public.check_whatsapp_automation_lease('50760000088', (SELECT (value->>'token')::uuid FROM inbox_claim),
  (SELECT (value->>'fence')::bigint FROM inbox_claim)), 'current worker has valid lease');
SELECT ok(public.checkpoint_whatsapp_automation('50760000088', (SELECT (value->>'token')::uuid FROM inbox_claim),
  (SELECT (value->>'fence')::bigint FROM inbox_claim), '{"stage":"buy"}', 'buy', NULL, 1), 'context persisted before external response');
SELECT is((SELECT context->>'stage' FROM public.whatsapp_conversation_state WHERE wa_id='50760000088'), 'buy', 'checkpoint is recoverable');

SELECT set_config('request.jwt.claims', '{"sub":"93333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT ok(public.set_whatsapp_conversation_mode('50760000088', 'human', 1), 'admin takes chat');
RESET ROLE;
SELECT ok(NOT public.check_whatsapp_automation_lease('50760000088', (SELECT (value->>'token')::uuid FROM inbox_claim),
  (SELECT (value->>'fence')::bigint FROM inbox_claim)), 'takeover fences pending automatic response');
SELECT ok(NOT public.finish_whatsapp_automation((SELECT (value->>'id')::bigint FROM inbox_claim),
  (SELECT (value->>'token')::uuid FROM inbox_claim), (SELECT (value->>'fence')::bigint FROM inbox_claim), 'done'), 'stale worker cannot complete');
SELECT is(public.claim_whatsapp_automation(90), NULL::jsonb, 'human chat stays silent');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.set_whatsapp_conversation_mode('50760000088', 'bot', 1), 'stale operator cannot release');
SELECT ok(public.set_whatsapp_conversation_mode('50760000088', 'bot', 2), 'explicit release restores processing');
RESET ROLE;
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,text_body,sent_at)
VALUES ('inbox-fixture-retry','123','50760000088','text','catalogo',now()),('inbox-fixture-review','123','50760000088','text','carrito',now());
UPDATE inbox_claim SET value = public.claim_whatsapp_automation(90);
SELECT ok(public.finish_whatsapp_automation((SELECT (value->>'id')::bigint FROM inbox_claim),
  (SELECT (value->>'token')::uuid FROM inbox_claim), (SELECT (value->>'fence')::bigint FROM inbox_claim), 'retry'), 'failure retains job');
SELECT is(public.claim_whatsapp_automation(90), NULL::jsonb, 'backoff preserves conversation order');
UPDATE public.whatsapp_automation_inbox SET available_at = now()-interval '1 minute' WHERE wa_message_id='inbox-fixture-retry';
UPDATE inbox_claim SET value = public.claim_whatsapp_automation(90);
SELECT is((SELECT value->>'attempts' FROM inbox_claim), '2', 'retries counted durably');
SELECT ok(public.finish_whatsapp_automation((SELECT (value->>'id')::bigint FROM inbox_claim),
  (SELECT (value->>'token')::uuid FROM inbox_claim), (SELECT (value->>'fence')::bigint FROM inbox_claim), 'done'), 'success advances head');
SELECT ok((SELECT processed_at IS NOT NULL FROM public.whatsapp_inbound_messages WHERE wa_message_id='inbox-fixture-retry'), 'stored message is processed only after completion');
UPDATE inbox_claim SET value = public.claim_whatsapp_automation(90);
SELECT ok(public.finish_whatsapp_automation((SELECT (value->>'id')::bigint FROM inbox_claim),
  (SELECT (value->>'token')::uuid FROM inbox_claim), (SELECT (value->>'fence')::bigint FROM inbox_claim), 'review'), 'ambiguous delivery requests human');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.set_whatsapp_conversation_mode('50760000088', 'bot', 6), 'uncertain delivery cannot silently resume');
SELECT ok(NOT public.resolve_whatsapp_automation_review('50760000088', 5), 'stale resolution is rejected');
SELECT ok(public.resolve_whatsapp_automation_review('50760000088', 6), 'admin explicitly records manual resolution');
RESET ROLE;
SELECT is((SELECT resolved_by FROM public.whatsapp_automation_inbox WHERE wa_message_id='inbox-fixture-review'),
  '93333333-3333-4333-8333-333333333333'::uuid, 'manual resolution has actor audit');
SELECT is((SELECT mode FROM public.whatsapp_conversation_state WHERE wa_id='50760000088'), 'human', 'manual resolution never enables bot implicitly');
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,sent_at)
VALUES ('inbox-fixture-recovery','123','50760000089','text',now());
UPDATE inbox_claim SET value = public.claim_whatsapp_automation(90);
CREATE TEMP TABLE stale_inbox_claim AS SELECT value FROM inbox_claim;
UPDATE public.whatsapp_conversation_state SET locked_until = now()-interval '1 minute' WHERE wa_id='50760000089';
UPDATE inbox_claim SET value = public.claim_whatsapp_automation(90);
SELECT is((SELECT value->>'attempts' FROM inbox_claim), '2', 'expired worker lease is recovered');
SELECT ok(NOT public.finish_whatsapp_automation((SELECT (value->>'id')::bigint FROM stale_inbox_claim),
  (SELECT (value->>'token')::uuid FROM stale_inbox_claim), (SELECT (value->>'fence')::bigint FROM stale_inbox_claim), 'done'), 'crashed worker cannot complete recovered lease');
SELECT ok(NOT public.checkpoint_whatsapp_automation('50760000089', (SELECT (value->>'token')::uuid FROM stale_inbox_claim),
  (SELECT (value->>'fence')::bigint FROM stale_inbox_claim), '{}', NULL, NULL, 1), 'crashed worker cannot overwrite recovered context');
UPDATE public.whatsapp_conversation_state SET locked_until = now()-interval '1 minute' WHERE wa_id='50760000089';
UPDATE public.whatsapp_automation_inbox SET attempts = 5 WHERE wa_id='50760000089';
SELECT is(public.claim_whatsapp_automation(90), NULL::jsonb, 'repeated crashes have a finite retry budget');
SELECT is((SELECT handoff_reason FROM public.whatsapp_conversation_state WHERE wa_id='50760000089'), 'retry_exhausted', 'retry budget creates visible intervention reason');
SELECT throws_ok($$SELECT public.claim_whatsapp_automation(0)$$, 'P0001', 'Invalid lease', 'lease duration is bounded');
INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000000','94444444-4444-4444-8444-444444444444','authenticated','authenticated','inbox-user@example.test','',now());
SELECT set_config('request.jwt.claims', '{"sub":"94444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.whatsapp_conversation_state WHERE wa_id='50760000089'), 0::bigint, 'non-admin cannot read conversation');
SELECT throws_ok($$SELECT public.set_whatsapp_conversation_mode('50760000089','bot',2)$$, '42501', 'Unauthorized', 'non-admin cannot return chat');
SELECT throws_ok($$SELECT public.resolve_whatsapp_automation_review('50760000089',2)$$, '42501', 'Unauthorized', 'non-admin cannot resolve review');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
