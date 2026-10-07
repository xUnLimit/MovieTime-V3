BEGIN;
SELECT plan(4);
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000000','97777777-7777-4777-8777-777777777777','authenticated','authenticated','pause-admin@example.test','',now());
UPDATE public.usuarios SET role='admin' WHERE id='97777777-7777-4777-8777-777777777777';
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,text_body,sent_at)
VALUES ('pause-regression-before','fixture','50760000073','text','hola',now());
SELECT set_config('request.jwt.claims','{"sub":"97777777-7777-4777-8777-777777777777","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT ok(public.set_whatsapp_conversation_mode('50760000073','human',0),'take chat');
RESET ROLE;
INSERT INTO public.whatsapp_inbound_messages(wa_message_id,phone_number_id,from_wa_id,message_type,text_body,sent_at)
VALUES ('pause-regression-during','fixture','50760000073','text','cancelar',now()),('pause-regression-greeting','fixture','50760000073','text','hola',now());
SELECT is((SELECT count(*) FROM public.whatsapp_automation_inbox WHERE wa_id='50760000073' AND status<>'done'),0::bigint,'human messages do not accumulate work');
SET LOCAL ROLE authenticated;
SELECT ok(public.set_whatsapp_conversation_mode('50760000073','bot',1),'resume bot');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.whatsapp_automation_inbox WHERE wa_id='50760000073' AND status<>'done'),0::bigint,'resume does not replay earlier greetings or buttons');
SELECT * FROM finish();
ROLLBACK;
