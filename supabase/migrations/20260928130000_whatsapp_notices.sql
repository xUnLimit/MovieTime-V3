-- Notices are reserved before an outbound call. Only the service role may mutate them.
CREATE TABLE public.whatsapp_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  tipo tipo_template_enum NOT NULL,
  tercero_id text NOT NULL REFERENCES public.terceros(id),
  wa_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('template', 'text')),
  meta_template_name text,
  fecha_vencimiento date,
  origin text NOT NULL CHECK (origin IN ('manual', 'auto')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'failed', 'skipped')),
  skip_reason text,
  idempotency_key uuid NOT NULL UNIQUE,
  outbound_message_id uuid REFERENCES public.whatsapp_outbound_messages(id),
  wa_message_id text,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_notices_tercero_created_idx ON public.whatsapp_notices (tercero_id, created_at DESC);
CREATE INDEX whatsapp_notices_wa_message_idx ON public.whatsapp_notices (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE TRIGGER set_whatsapp_notices_updated_at BEFORE UPDATE ON public.whatsapp_notices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.whatsapp_notice_ventas (
  notice_id uuid NOT NULL REFERENCES public.whatsapp_notices(id) ON DELETE CASCADE,
  venta_id text NOT NULL REFERENCES public.ventas(id),
  PRIMARY KEY (notice_id, venta_id)
);
CREATE INDEX whatsapp_notice_ventas_venta_idx ON public.whatsapp_notice_ventas (venta_id, notice_id);

ALTER TABLE public.ventas
  ADD COLUMN respuesta_cliente text CHECK (respuesta_cliente IN ('no_continuar')),
  ADD COLUMN respuesta_cliente_at timestamptz;

ALTER TABLE public.whatsapp_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_notice_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_notices_admin_read ON public.whatsapp_notices
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active));
CREATE POLICY whatsapp_notice_ventas_admin_read ON public.whatsapp_notice_ventas
  FOR SELECT TO authenticated USING ((SELECT private.auth_role()) = 'admin'
    AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.active));
REVOKE ALL ON public.whatsapp_notices, public.whatsapp_notice_ventas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_notices, public.whatsapp_notice_ventas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_notices TO service_role;
GRANT SELECT, INSERT ON public.whatsapp_notice_ventas TO service_role;

-- A single DB transaction reserves the dedupe key and links the exact sales.
-- A manual retry may reclaim only a failed notice; pending remains uncertain.
CREATE FUNCTION public.reserve_whatsapp_notice(
  p_dedupe_key text, p_tipo tipo_template_enum, p_tercero_id text,
  p_wa_id text, p_channel text, p_meta_template_name text,
  p_fecha_vencimiento date, p_origin text, p_idempotency_key uuid,
  p_created_by uuid, p_venta_ids text[]
) RETURNS public.whatsapp_notices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE reserved public.whatsapp_notices;
BEGIN
  INSERT INTO public.whatsapp_notices
    (dedupe_key, tipo, tercero_id, wa_id, channel, meta_template_name,
     fecha_vencimiento, origin, idempotency_key, created_by)
  VALUES
    (p_dedupe_key, p_tipo, p_tercero_id, p_wa_id, p_channel, p_meta_template_name,
     p_fecha_vencimiento, p_origin, p_idempotency_key, p_created_by)
  ON CONFLICT (dedupe_key) DO UPDATE SET
    status = 'pending', idempotency_key = EXCLUDED.idempotency_key,
    outbound_message_id = NULL, wa_message_id = NULL, skip_reason = NULL,
    wa_id = EXCLUDED.wa_id, channel = EXCLUDED.channel,
    meta_template_name = EXCLUDED.meta_template_name,
    origin = EXCLUDED.origin, created_by = EXCLUDED.created_by,
    created_at = now(), updated_at = now()
  WHERE public.whatsapp_notices.status IN ('failed', 'skipped') AND p_origin = 'manual'
  RETURNING * INTO reserved;

  IF reserved.id IS NULL THEN
    SELECT * INTO reserved FROM public.whatsapp_notices WHERE dedupe_key = p_dedupe_key;
  END IF;
  INSERT INTO public.whatsapp_notice_ventas (notice_id, venta_id)
    SELECT reserved.id, unnest(p_venta_ids)
    ON CONFLICT DO NOTHING;
  RETURN reserved;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_whatsapp_notice(text, tipo_template_enum, text, text, text, text, date, text, uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_whatsapp_notice(text, tipo_template_enum, text, text, text, text, date, text, uuid, uuid, text[]) TO service_role;

CREATE VIEW public.v_venta_whatsapp_notice_status WITH (security_invoker = true) AS
SELECT DISTINCT ON (nv.venta_id)
  nv.venta_id, n.id AS notice_id, n.tipo, n.origin,
  n.status AS notice_status, s.status AS delivery_status, n.created_at
FROM public.whatsapp_notice_ventas nv
JOIN public.whatsapp_notices n ON n.id = nv.notice_id
LEFT JOIN LATERAL (
  SELECT ms.status FROM public.whatsapp_message_statuses ms
  WHERE ms.wa_message_id = n.wa_message_id
  ORDER BY ms.status_at DESC, ms.received_at DESC LIMIT 1
) s ON true
ORDER BY nv.venta_id, n.created_at DESC, n.id DESC;
REVOKE ALL ON public.v_venta_whatsapp_notice_status FROM PUBLIC, anon;
GRANT SELECT ON public.v_venta_whatsapp_notice_status TO authenticated, service_role;
