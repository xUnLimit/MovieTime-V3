-- Bot de WhatsApp administrable: configuracion global, versiones inmutables y eventos de auditoria.
-- Aditiva y compatible con la version anterior de la app, que no usa estas tablas. El administrador se
-- identifica con private.auth_role() = 'admin' (usuario activo con rol admin), igual que el resto de politicas.

-- Las acciones del bot se registran en log-actividad con su propia entidad.
ALTER TYPE public.entidad_log_enum ADD VALUE IF NOT EXISTS 'bot';

CREATE TABLE public.whatsapp_bot_versions (
  version integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  definition jsonb NOT NULL
    CHECK (jsonb_typeof(definition) = 'object' AND octet_length(definition::text) <= 262144),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  created_by uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_bot_config (
  id text PRIMARY KEY CHECK (id = 'global'),
  enabled boolean NOT NULL DEFAULT false,
  published_version integer REFERENCES public.whatsapp_bot_versions (version),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.usuarios (id) ON DELETE SET NULL
);

CREATE TABLE public.whatsapp_bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  wa_id text NOT NULL CHECK (length(wa_id) BETWEEN 1 AND 32),
  cliente_id text REFERENCES public.terceros (id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type ~ '^[a-z_]{1,40}$'),
  node_id text CHECK (length(node_id) <= 64),
  option_id text CHECK (length(option_id) <= 64),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(detail) = 'object' AND octet_length(detail::text) <= 4096)
);

CREATE INDEX whatsapp_bot_events_created_at_idx ON public.whatsapp_bot_events (created_at DESC);
CREATE INDEX whatsapp_bot_events_wa_id_idx ON public.whatsapp_bot_events (wa_id, created_at DESC);
CREATE INDEX whatsapp_bot_events_type_idx ON public.whatsapp_bot_events (type);
CREATE INDEX whatsapp_bot_events_cliente_id_idx ON public.whatsapp_bot_events (cliente_id);
CREATE INDEX whatsapp_bot_versions_created_by_idx ON public.whatsapp_bot_versions (created_by);
CREATE INDEX whatsapp_bot_config_published_version_idx ON public.whatsapp_bot_config (published_version);

ALTER TABLE public.whatsapp_bot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_bot_events ENABLE ROW LEVEL SECURITY;

-- Los administradores solo leen: escriben unicamente mediante las RPC SECURITY DEFINER.
CREATE POLICY whatsapp_bot_versions_admin_read ON public.whatsapp_bot_versions
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY whatsapp_bot_config_admin_read ON public.whatsapp_bot_config
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY whatsapp_bot_events_admin_read ON public.whatsapp_bot_events
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin');

-- Los privilegios por defecto de Supabase dan acceso total a todos los roles: se quitan y se concede lo minimo.
-- Las versiones son inmutables: nadie (ni service_role) tiene UPDATE ni DELETE.
REVOKE ALL ON TABLE public.whatsapp_bot_versions, public.whatsapp_bot_config, public.whatsapp_bot_events
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.whatsapp_bot_versions_version_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.whatsapp_bot_versions, public.whatsapp_bot_config TO authenticated, service_role;
GRANT SELECT ON TABLE public.whatsapp_bot_events TO authenticated;

CREATE FUNCTION public.publish_whatsapp_bot_version(p_definition jsonb, p_note text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_note text := btrim(coalesce(p_note, ''));
  v_version integer;
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_definition IS NULL OR jsonb_typeof(p_definition) <> 'object'
    OR octet_length(p_definition::text) > 262144 THEN
    RAISE EXCEPTION 'invalid bot definition';
  END IF;
  IF length(v_note) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid bot version note';
  END IF;

  -- Serializa publicaciones concurrentes y falla si la configuracion global no existe.
  PERFORM 1 FROM public.whatsapp_bot_config WHERE id = 'global' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bot configuration missing';
  END IF;

  INSERT INTO public.whatsapp_bot_versions (definition, note, created_by)
  VALUES (p_definition, v_note, (SELECT auth.uid()))
  RETURNING version INTO v_version;

  UPDATE public.whatsapp_bot_config
  SET published_version = v_version, updated_at = now(), updated_by = (SELECT auth.uid())
  WHERE id = 'global';

  RETURN v_version;
END;
$$;

CREATE FUNCTION public.set_whatsapp_bot_enabled(p_enabled boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'invalid bot enabled flag';
  END IF;

  UPDATE public.whatsapp_bot_config
  SET enabled = p_enabled, updated_at = now(), updated_by = (SELECT auth.uid())
  WHERE id = 'global';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bot configuration missing';
  END IF;

  RETURN p_enabled;
END;
$$;

-- Solo el webhook (service role) registra eventos. La purga de mas de 90 dias ocurre al insertar, sin cron.
CREATE FUNCTION public.record_whatsapp_bot_event(
  p_wa_id text, p_cliente_id text, p_type text, p_node_id text, p_option_id text, p_detail jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  DELETE FROM public.whatsapp_bot_events WHERE created_at < now() - interval '90 days';

  INSERT INTO public.whatsapp_bot_events (wa_id, cliente_id, type, node_id, option_id, detail)
  VALUES (p_wa_id, p_cliente_id, p_type, p_node_id, p_option_id, coalesce(p_detail, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_whatsapp_bot_version(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_whatsapp_bot_enabled(boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_whatsapp_bot_event(text, text, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_whatsapp_bot_version(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_whatsapp_bot_enabled(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_bot_event(text, text, text, text, text, jsonb) TO service_role;

-- Siembra: version 1 con los valores por defecto (identicos a defaultDefinition(); una prueba lo verifica)
-- y el bot apagado hasta que un administrador lo encienda.
INSERT INTO public.whatsapp_bot_versions (definition, note)
VALUES ($bot${"schemaVersion":1,"entryNodeId":"menu","nodes":[{"id":"menu","name":"Menú principal","kind":"buttons","body":"Hola, soy el asistente de MovieTime PTY. ¿Qué necesitas?","options":[{"id":"codigo","title":"Código de Netflix","next":"netflix"},{"id":"soporte","title":"Hablar con soporte","next":"soporte"}]},{"id":"netflix","name":"Tipo de código de Netflix","kind":"buttons","body":"¿Qué código necesitas?\n\n*Iniciar sesión*: Netflix te pidió un código para entrar a tu cuenta en un dispositivo.\n*Estoy de viaje*: Netflix te pidió confirmar tu dispositivo o ubicación fuera de casa.\n\nPrimero pide el código en Netflix y luego toca el botón.","options":[{"id":"login","title":"Iniciar sesión","next":"login"},{"id":"viaje","title":"Estoy de viaje","next":"viaje"}]},{"id":"login","name":"Código de inicio de sesión","kind":"action","body":"","options":[],"action":"netflix_login_code"},{"id":"viaje","name":"Código de viaje","kind":"action","body":"","options":[],"action":"netflix_travel_code"},{"id":"soporte","name":"Hablar con soporte","kind":"action","body":"","options":[],"action":"handoff"}],"messages":{"login_code_sent":"Tu código de Netflix es *{{codigo}}*. Vence en {{minutos}} minutos; úsalo ya y no lo compartas.","travel_code_sent":"Tu código de Netflix para el perfil *{{perfil}}* es *{{codigo}}*. Vence en {{minutos}} minutos; úsalo ya y no lo compartas.","travel_link_sent":"Abre este enlace para ver tu código de acceso temporal de Netflix. Vence en {{minutos}} minutos y no lo compartas:\n{{enlace}}","login_not_found":"Todavía no me llega un código de inicio de sesión de los últimos {{minutos}} minutos. Pídelo en Netflix y vuelve a tocar el botón.","travel_not_found":"No veo tu solicitud de viaje para el perfil *{{perfil}}* en los últimos {{minutos}} minutos. Pídela en Netflix desde ese perfil y vuelve a tocar el botón.","already_sent":"Ya te envié ese código; búscalo arriba en este chat. Si no te sirvió, pide uno nuevo en Netflix y vuelve a tocar el botón.","profile_missing":"Todavía no tengo registrado tu perfil de Netflix, así que no puedo darte el código por aquí. Una persona te ayuda en breve.","no_netflix_account":"No encuentro una cuenta de Netflix activa a tu nombre. Una persona te ayuda en breve.","rate_limited":"Pediste muchos códigos seguidos. Espera {{minutos}} minutos e inténtalo de nuevo.","mailbox_unavailable":"No pude consultar el correo de Netflix en este momento. Una persona te ayuda en breve.","handoff_ack":"Listo, una persona te atiende en breve.","option_unavailable":"Esa opción ya no está disponible. Te muestro el menú de nuevo.","account_picker_body":"Tienes varias cuentas de Netflix. ¿Para cuál es el código?","account_picker_button":"Elegir cuenta"},"params":{"menuIdleHours":12,"operatorQuietMinutes":60,"loginWindowMinutes":5,"travelWindowMinutes":15,"maxTaps":6,"tapWindowMinutes":10},"keywords":["hola","buenas","buenos","menu","ayuda","opciones","codigo","netflix"]}$bot$::jsonb, 'Versión inicial');

INSERT INTO public.whatsapp_bot_config (id, enabled, published_version)
SELECT 'global', false, version FROM public.whatsapp_bot_versions WHERE version = 1;
