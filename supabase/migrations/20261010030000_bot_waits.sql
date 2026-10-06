-- Espera de la respuesta escrita del cliente: un texto del recorrido puede esperar lo que el cliente escriba y seguir por la salida que
-- coincide. Expand-only: tabla nueva que solo usa el servidor (service_role); la version anterior de la aplicacion la ignora.
BEGIN;
CREATE TABLE public.whatsapp_bot_waits (
  wa_id text PRIMARY KEY CHECK (char_length(wa_id) BETWEEN 6 AND 20),
  node_id text NOT NULL CHECK (node_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_bot_waits_expires_idx ON public.whatsapp_bot_waits (expires_at);
ALTER TABLE public.whatsapp_bot_waits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_bot_waits FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_bot_waits TO service_role;
COMMENT ON TABLE public.whatsapp_bot_waits IS 'Texto del recorrido del bot cuya respuesta escrita espera cada cliente; solo el servidor la lee y la escribe.';
COMMIT;
