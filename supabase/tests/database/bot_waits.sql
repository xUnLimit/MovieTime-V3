BEGIN;
SELECT no_plan();

-- La tabla de esperas solo la usa el servidor: ningun usuario ni la API publica la toca.
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.whatsapp_bot_waits'::regclass),'waits RLS enabled');
SELECT ok(NOT has_table_privilege('anon','public.whatsapp_bot_waits','SELECT'),'anonymous cannot read waits');
SELECT ok(NOT has_table_privilege('authenticated','public.whatsapp_bot_waits','SELECT'),'users cannot read waits');
SELECT ok(NOT has_table_privilege('authenticated','public.whatsapp_bot_waits','INSERT'),'users cannot write waits');
SELECT ok(has_table_privilege('service_role','public.whatsapp_bot_waits','SELECT'),'the server reads waits');
SELECT ok(has_table_privilege('service_role','public.whatsapp_bot_waits','INSERT'),'the server writes waits');
SELECT ok(has_table_privilege('service_role','public.whatsapp_bot_waits','UPDATE'),'the server updates waits');
SELECT ok(has_table_privilege('service_role','public.whatsapp_bot_waits','DELETE'),'the server deletes waits');
SELECT is((public.run_security_audit_validations()->>'rls_disabled_app_tables')::int,0,'the audit finds no app table without RLS');
SELECT is((public.run_security_audit_validations()->>'unapproved_security_definer_executable_by_authenticated')::int,0,'the audit finds no unapproved definer function');

SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT count(*) FROM public.whatsapp_bot_waits$$,'42501',NULL,'a signed-in user is denied');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT count(*) FROM public.whatsapp_bot_waits$$,'42501',NULL,'anonymous is denied');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT lives_ok($$INSERT INTO public.whatsapp_bot_waits(wa_id,node_id,expires_at) VALUES('50765331751','pregunta',now()+interval '12 hours')$$,'the server records a wait');
SELECT lives_ok($$INSERT INTO public.whatsapp_bot_waits(wa_id,node_id,expires_at) VALUES('50765331751','otra_pregunta',now()+interval '2 hours')
  ON CONFLICT (wa_id) DO UPDATE SET node_id=EXCLUDED.node_id,expires_at=EXCLUDED.expires_at$$,'a new wait replaces the previous one');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_waits WHERE wa_id='50765331751'),1::bigint,'one wait per customer');
SELECT is((SELECT node_id FROM public.whatsapp_bot_waits WHERE wa_id='50765331751'),'otra_pregunta','the latest wait wins');
SELECT throws_ok($$INSERT INTO public.whatsapp_bot_waits(wa_id,node_id,expires_at) VALUES('123','pregunta',now())$$,'23514',NULL,'a malformed phone is rejected');
SELECT throws_ok($$INSERT INTO public.whatsapp_bot_waits(wa_id,node_id,expires_at) VALUES('50765331752','Nodo Invalido',now())$$,'23514',NULL,'a malformed node id is rejected');
SELECT throws_ok($$INSERT INTO public.whatsapp_bot_waits(wa_id,node_id,expires_at) VALUES('50765331753','pregunta',NULL)$$,'23502',NULL,'an expiry is required');
SELECT lives_ok($$DELETE FROM public.whatsapp_bot_waits WHERE wa_id='50765331751' AND node_id='otra_pregunta'$$,'the server clears a wait');
SELECT is((SELECT count(*) FROM public.whatsapp_bot_waits),0::bigint,'nothing is left');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
