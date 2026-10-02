BEGIN;
SELECT plan(18);

SELECT has_column('public', 'whatsapp_inbound_messages', 'processing_attempts', 'existe processing_attempts');
SELECT has_column('public', 'whatsapp_inbound_messages', 'processing_error', 'existe processing_error');
SELECT has_column('public', 'whatsapp_inbound_messages', 'processing_locked_until', 'existe processing_locked_until');

SELECT ok(NOT has_function_privilege('anon', 'public.claim_whatsapp_inbound_batch(integer, integer)', 'EXECUTE'), 'anon no reclama');
SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_whatsapp_inbound_batch(integer, integer)', 'EXECUTE'), 'authenticated no reclama');
SELECT ok(NOT has_function_privilege('anon', 'public.finish_whatsapp_inbound(uuid, text)', 'EXECUTE'), 'anon no finaliza');
SELECT ok(NOT has_function_privilege('authenticated', 'public.finish_whatsapp_inbound(uuid, text)', 'EXECUTE'), 'authenticated no finaliza');
SELECT ok(has_function_privilege('service_role', 'public.claim_whatsapp_inbound_batch(integer, integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.finish_whatsapp_inbound(uuid, text)', 'EXECUTE'), 'service_role ejecuta ambas');

-- Filas sinteticas: una vieja sin procesar, una reciente, una ya procesada y una agotada.
INSERT INTO public.whatsapp_inbound_messages (id, wa_message_id, phone_number_id, from_wa_id, message_type, sent_at, received_at, processed_at, processing_attempts)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'wamid.OLD', '1', '50760000001', 'text', now(), now() - interval '5 minutes', NULL, 0),
  ('00000000-0000-0000-0000-0000000000a2', 'wamid.NEW', '1', '50760000002', 'text', now(), now(), NULL, 0),
  ('00000000-0000-0000-0000-0000000000a3', 'wamid.DONE', '1', '50760000003', 'text', now(), now() - interval '5 minutes', now(), 0),
  ('00000000-0000-0000-0000-0000000000a4', 'wamid.EXHAUSTED', '1', '50760000004', 'text', now(), now() - interval '5 minutes', NULL, 5);

SET LOCAL ROLE service_role;
SELECT is((SELECT count(*) FROM public.claim_whatsapp_inbound_batch(10, 60)), 1::bigint,
  'solo se reclama la fila antigua, sin procesar y con intentos disponibles');
SELECT is((SELECT count(*) FROM public.claim_whatsapp_inbound_batch(10, 60)), 0::bigint,
  'una segunda llamada no reclama la fila bloqueada (idempotente)');
RESET ROLE;
SELECT is((SELECT processing_attempts FROM public.whatsapp_inbound_messages WHERE wa_message_id = 'wamid.OLD'), 1,
  'el reclamo incrementa los intentos');
SELECT ok((SELECT processing_locked_until > now() FROM public.whatsapp_inbound_messages WHERE wa_message_id = 'wamid.OLD'),
  'el reclamo fija el bloqueo');
SELECT is((SELECT processing_attempts FROM public.whatsapp_inbound_messages WHERE wa_message_id = 'wamid.NEW'), 0,
  'una fila reciente se deja para after()');

SET LOCAL ROLE service_role;
SELECT is(public.finish_whatsapp_inbound('00000000-0000-0000-0000-0000000000a1', 'BOT_ERROR'), true,
  'finish con etiqueta libera la fila');
RESET ROLE;
SELECT ok((SELECT processed_at IS NULL AND processing_error = 'BOT_ERROR' FROM public.whatsapp_inbound_messages WHERE wa_message_id = 'wamid.OLD'),
  'la fila con error sigue sin procesar y guarda la etiqueta');

SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT public.finish_whatsapp_inbound('00000000-0000-0000-0000-0000000000a1', 'texto libre con detalle')$$,
  'invalid inbound finish', 'finish rechaza etiquetas que no son codigos');
SELECT is(public.finish_whatsapp_inbound('00000000-0000-0000-0000-0000000000a1', NULL), true, 'finish sin error marca procesada');
RESET ROLE;
SELECT ok((SELECT processed_at IS NOT NULL AND processing_error IS NULL FROM public.whatsapp_inbound_messages WHERE wa_message_id = 'wamid.OLD'),
  'processed_at queda fijado y el error limpio');

SELECT * FROM finish();
ROLLBACK;
