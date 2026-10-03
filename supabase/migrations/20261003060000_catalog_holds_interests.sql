-- Additive catalog. planes.precio is current, venta_periodos is historical.
-- IDs of existing entities are TEXT; only new hold/interest IDs are UUID.
CREATE TABLE public.catalogo_ajustes (
  id text PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  reserva_ttl_minutos integer NOT NULL DEFAULT 30 CHECK (reserva_ttl_minutos BETWEEN 1 AND 1440),
  moneda text NOT NULL DEFAULT 'USD' REFERENCES public.currencies(code),
  resumen_template text NOT NULL DEFAULT '{{disponibles}}' || E'\n' || '{{agotados}}'
    CHECK (length(resumen_template) BETWEEN 1 AND 4096)
);
INSERT INTO public.catalogo_ajustes (id) VALUES ('global');

CREATE TABLE public.catalogo_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id text NOT NULL REFERENCES public.categorias(id),
  plan_id text REFERENCES public.planes(id),
  visible_en_bot boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  umbral_stock_bajo integer NOT NULL DEFAULT 2 CHECK (umbral_stock_bajo >= 0),
  alternativa_categoria_id text REFERENCES public.categorias(id),
  alternativa_plan_id text REFERENCES public.planes(id),
  reserva_ttl_minutos integer CHECK (reserva_ttl_minutos BETWEEN 1 AND 1440),
  moneda text REFERENCES public.currencies(code),
  CHECK (alternativa_plan_id IS NULL OR alternativa_categoria_id IS NOT NULL)
);
CREATE UNIQUE INDEX catalogo_config_categoria_uq ON public.catalogo_config(categoria_id) WHERE plan_id IS NULL;
CREATE UNIQUE INDEX catalogo_config_plan_uq ON public.catalogo_config(categoria_id, plan_id) WHERE plan_id IS NOT NULL;

CREATE TABLE public.reservas_perfil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id text NOT NULL REFERENCES public.servicios(id),
  perfil_numero integer NOT NULL CHECK (perfil_numero > 0),
  owner_ref text NOT NULL CHECK (length(btrim(owner_ref)) BETWEEN 1 AND 200),
  expira_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cerrada_at timestamptz,
  CHECK (expira_at > created_at)
);
-- Time cannot appear in an index predicate. RPC closes expired rows under the
-- service lock before reuse; all reads additionally check expira_at live.
CREATE UNIQUE INDEX reservas_perfil_abierta_uq ON public.reservas_perfil(servicio_id, perfil_numero) WHERE cerrada_at IS NULL;
CREATE UNIQUE INDEX reservas_perfil_owner_uq ON public.reservas_perfil(servicio_id, owner_ref) WHERE cerrada_at IS NULL;
CREATE INDEX reservas_perfil_expira_idx ON public.reservas_perfil(expira_at) WHERE cerrada_at IS NULL;

CREATE TABLE public.intereses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id text NOT NULL CHECK (contact_id ~ '^[0-9]{1,32}$'),
  categoria_id text NOT NULL REFERENCES public.categorias(id),
  plan_id text REFERENCES public.planes(id),
  origen text NOT NULL CHECK (origen IN ('catalogo_agotado', 'manual')),
  estado text NOT NULL DEFAULT 'esperando' CHECK (estado IN ('esperando', 'avisado', 'convertido', 'descartado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  avisado_at timestamptz
);
CREATE UNIQUE INDEX intereses_activo_uq ON public.intereses(contact_id, categoria_id, (coalesce(plan_id, '')))
  WHERE estado IN ('esperando', 'avisado');
CREATE INDEX intereses_fifo_idx ON public.intereses(categoria_id, plan_id, created_at, id) WHERE estado = 'esperando';
CREATE INDEX servicios_catalogo_idx ON public.servicios(categoria_id, plan_tipo_id, id)
  WHERE activo AND NOT en_reposo AND cortado_at IS NULL AND archivado_at IS NULL;

ALTER TABLE public.catalogo_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intereses ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalogo_ajustes_admin ON public.catalogo_ajustes FOR ALL TO authenticated
  USING ((SELECT private.auth_role()) = 'admin') WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY catalogo_config_admin ON public.catalogo_config FOR ALL TO authenticated
  USING ((SELECT private.auth_role()) = 'admin') WITH CHECK ((SELECT private.auth_role()) = 'admin');
CREATE POLICY reservas_perfil_admin_read ON public.reservas_perfil FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');
CREATE POLICY intereses_admin_read ON public.intereses FOR SELECT TO authenticated
  USING ((SELECT private.auth_role()) = 'admin');
REVOKE ALL ON public.catalogo_ajustes, public.catalogo_config, public.reservas_perfil, public.intereses
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.catalogo_ajustes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_config TO authenticated;
GRANT SELECT ON public.catalogo_ajustes, public.catalogo_config, public.reservas_perfil, public.intereses TO service_role;
GRANT SELECT ON public.reservas_perfil, public.intereses TO authenticated;
GRANT INSERT, UPDATE ON public.intereses TO service_role;

-- Enforce category/plan consistency without modifying existing unique keys.
CREATE FUNCTION private.catalogo_validar_plan() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.planes WHERE id = NEW.plan_id AND categoria_id = NEW.categoria_id
  ) THEN RAISE EXCEPTION 'invalid category/plan' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'catalogo_config' THEN
    IF NEW.alternativa_plan_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.planes WHERE id = NEW.alternativa_plan_id AND categoria_id = NEW.alternativa_categoria_id
    ) THEN RAISE EXCEPTION 'invalid alternative' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER catalogo_config_validar BEFORE INSERT OR UPDATE ON public.catalogo_config
  FOR EACH ROW EXECUTE FUNCTION private.catalogo_validar_plan();
CREATE TRIGGER intereses_validar BEFORE INSERT OR UPDATE ON public.intereses
  FOR EACH ROW EXECUTE FUNCTION private.catalogo_validar_plan();
REVOKE ALL ON FUNCTION private.catalogo_validar_plan() FROM PUBLIC, anon, authenticated, service_role;

-- Existing sales also acquire the service lock before assigning a profile.
-- A checkout must release its hold in the SAME transaction that creates a sale.
CREATE FUNCTION private.catalogo_proteger_reserva() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.estado <> 'activo' OR NEW.archivado_at IS NOT NULL OR NEW.perfil_numero IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.servicio_id = NEW.servicio_id AND OLD.perfil_numero IS NOT DISTINCT FROM NEW.perfil_numero
      AND OLD.estado = 'activo' AND OLD.archivado_at IS NULL THEN RETURN NEW; END IF;
  END IF;
  PERFORM 1 FROM public.servicios WHERE id = NEW.servicio_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.reservas_perfil r WHERE r.servicio_id = NEW.servicio_id
    AND r.perfil_numero = NEW.perfil_numero AND r.cerrada_at IS NULL AND r.expira_at > clock_timestamp())
    THEN RAISE EXCEPTION 'profile held' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER catalogo_proteger_reserva BEFORE INSERT OR UPDATE ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION private.catalogo_proteger_reserva();
REVOKE ALL ON FUNCTION private.catalogo_proteger_reserva() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.catalogo_disponible()
RETURNS TABLE (categoria_id text, categoria_nombre text, plan_id text, plan_nombre text,
  plan_tipo_id text, precio numeric, moneda text, ciclos public.ciclo_pago_enum[],
  perfiles_libres bigint, estado text, orden integer, alternativa_categoria_id text, alternativa_plan_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' AND (SELECT private.auth_role()) IS DISTINCT FROM 'admin'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH holds AS (
    SELECT r.servicio_id, count(*) AS cantidad FROM public.reservas_perfil r
    WHERE r.cerrada_at IS NULL AND r.expira_at > statement_timestamp() GROUP BY r.servicio_id
  ), stock AS (
    SELECT s.categoria_id, s.plan_tipo_id,
      sum(greatest(s.perfiles_disponibles - s.perfiles_ocupados - coalesce(h.cantidad, 0), 0))::bigint AS libres
    FROM public.servicios s LEFT JOIN holds h ON h.servicio_id = s.id
    WHERE s.activo AND NOT s.en_reposo AND s.cortado_at IS NULL AND s.archivado_at IS NULL
    GROUP BY s.categoria_id, s.plan_tipo_id
  )
  SELECT c.id, c.nombre, p.id, p.nombre, p.plan_tipo_id, p.precio,
    coalesce(cp.moneda, cc.moneda, a.moneda), ARRAY[p.ciclo_pago], coalesce(s.libres, 0),
    CASE WHEN coalesce(s.libres, 0) = 0 THEN 'agotado'
      WHEN s.libres <= coalesce(cp.umbral_stock_bajo, cc.umbral_stock_bajo, 2) THEN 'ultimos'
      ELSE 'disponible' END,
    coalesce(cp.orden, cc.orden, p.orden, 0),
    coalesce(cp.alternativa_categoria_id, cc.alternativa_categoria_id),
    CASE WHEN cp.alternativa_categoria_id IS NOT NULL THEN cp.alternativa_plan_id ELSE cc.alternativa_plan_id END
  FROM public.planes p JOIN public.categorias c ON c.id = p.categoria_id
  JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id AND pt.categoria_id = c.id
  CROSS JOIN public.catalogo_ajustes a
  LEFT JOIN public.catalogo_config cc ON cc.categoria_id = c.id AND cc.plan_id IS NULL
  LEFT JOIN public.catalogo_config cp ON cp.categoria_id = c.id AND cp.plan_id = p.id
  LEFT JOIN stock s ON s.categoria_id = c.id AND s.plan_tipo_id = p.plan_tipo_id
  WHERE p.activo AND c.activo AND pt.activo AND coalesce(cp.visible_en_bot, cc.visible_en_bot, true)
  ORDER BY coalesce(cp.orden, cc.orden, p.orden, 0), c.nombre, p.nombre, p.id;
END;
$$;

CREATE FUNCTION public.reservar_perfil(p_servicio_id text, p_owner_ref text, p_plan_id text DEFAULT NULL)
RETURNS SETOF public.reservas_perfil
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.servicios%ROWTYPE;
  v_perfil integer;
  v_ttl integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' AND (SELECT private.auth_role()) IS DISTINCT FROM 'admin'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_servicio_id IS NULL OR p_owner_ref IS NULL OR length(btrim(p_owner_ref)) NOT BETWEEN 1 AND 200
    THEN RAISE EXCEPTION 'invalid hold input' USING ERRCODE = '22023'; END IF;
  SELECT * INTO s FROM public.servicios WHERE id = p_servicio_id FOR UPDATE;
  IF NOT FOUND OR NOT s.activo OR s.en_reposo OR s.cortado_at IS NOT NULL OR s.archivado_at IS NOT NULL
    THEN RETURN; END IF;
  v_now := clock_timestamp(); -- after waiting for the service lock
  IF p_plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.planes p
    JOIN public.planes_tipos pt ON pt.id = p.plan_tipo_id
    JOIN public.categorias c ON c.id = p.categoria_id
    WHERE p.id = p_plan_id AND p.categoria_id = s.categoria_id AND p.plan_tipo_id = s.plan_tipo_id
      AND p.activo AND pt.activo AND c.activo)
    THEN RAISE EXCEPTION 'invalid hold plan' USING ERRCODE = '22023'; END IF;
  UPDATE public.reservas_perfil SET cerrada_at = v_now
    WHERE servicio_id = s.id AND cerrada_at IS NULL AND expira_at <= v_now;
  IF EXISTS (SELECT 1 FROM public.reservas_perfil WHERE servicio_id = s.id AND owner_ref = btrim(p_owner_ref) AND cerrada_at IS NULL) THEN
    RETURN QUERY SELECT * FROM public.reservas_perfil WHERE servicio_id = s.id AND owner_ref = btrim(p_owner_ref) AND cerrada_at IS NULL;
    RETURN;
  END IF;
  IF s.perfiles_disponibles - s.perfiles_ocupados <= (
    SELECT count(*) FROM public.reservas_perfil WHERE servicio_id = s.id AND cerrada_at IS NULL
  ) THEN RETURN; END IF;
  SELECT n INTO v_perfil FROM generate_series(1, s.perfiles_disponibles) n
  WHERE NOT EXISTS (SELECT 1 FROM public.ventas v WHERE v.servicio_id = s.id AND v.perfil_numero = n
    AND v.estado = 'activo' AND v.archivado_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM public.reservas_perfil r WHERE r.servicio_id = s.id AND r.perfil_numero = n AND r.cerrada_at IS NULL)
  ORDER BY n LIMIT 1;
  IF v_perfil IS NULL THEN RETURN; END IF;
  SELECT coalesce(cp.reserva_ttl_minutos, cc.reserva_ttl_minutos, a.reserva_ttl_minutos) INTO v_ttl
  FROM public.catalogo_ajustes a
  LEFT JOIN public.catalogo_config cc ON cc.categoria_id = s.categoria_id AND cc.plan_id IS NULL
  LEFT JOIN public.catalogo_config cp ON cp.categoria_id = s.categoria_id AND cp.plan_id = p_plan_id;
  RETURN QUERY INSERT INTO public.reservas_perfil(servicio_id, perfil_numero, owner_ref, expira_at, created_at)
    VALUES (s.id, v_perfil, btrim(p_owner_ref), v_now + make_interval(mins => coalesce(v_ttl, 30)), v_now) RETURNING *;
END;
$$;

CREATE FUNCTION public.liberar_reserva(p_reserva_id uuid, p_owner_ref text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' AND (SELECT private.auth_role()) IS DISTINCT FROM 'admin'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_reserva_id IS NULL OR p_owner_ref IS NULL OR length(btrim(p_owner_ref)) NOT BETWEEN 1 AND 200
    THEN RAISE EXCEPTION 'invalid hold input' USING ERRCODE = '22023'; END IF;
  UPDATE public.reservas_perfil SET cerrada_at = clock_timestamp()
    WHERE id = p_reserva_id AND owner_ref = btrim(p_owner_ref) AND cerrada_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.expirar_reservas() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' AND (SELECT private.auth_role()) IS DISTINCT FROM 'admin'
    THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.reservas_perfil SET cerrada_at = clock_timestamp()
    WHERE cerrada_at IS NULL AND expira_at <= clock_timestamp();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE FUNCTION public.registrar_interes(p_contact_id text, p_categoria_id text, p_plan_id text DEFAULT NULL,
  p_origen text DEFAULT 'catalogo_agotado') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_contact_id IS NULL OR p_contact_id !~ '^[0-9]{1,32}$' OR p_categoria_id IS NULL
    OR p_origen IS NULL OR p_origen NOT IN ('catalogo_agotado', 'manual')
    THEN RAISE EXCEPTION 'invalid interest input' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.intereses(contact_id, categoria_id, plan_id, origen)
  VALUES (p_contact_id, p_categoria_id, p_plan_id, p_origen)
  ON CONFLICT (contact_id, categoria_id, (coalesce(plan_id, ''))) WHERE estado IN ('esperando', 'avisado')
    DO UPDATE SET contact_id = EXCLUDED.contact_id RETURNING id INTO v_id;
  RETURN v_id; -- do not reset FIFO date, state or origin on retries
END;
$$;

-- Claims one exact category/plan bucket, marks avisado atomically; no message is sent here.
CREATE FUNCTION public.siguiente_interesado(p_categoria_id text, p_plan_id text DEFAULT NULL)
RETURNS SETOF public.intereses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_categoria_id IS NULL THEN RAISE EXCEPTION 'invalid interest input' USING ERRCODE = '22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_categoria_id || ':' || coalesce(p_plan_id, ''), 0));
  SELECT id INTO v_id FROM public.intereses WHERE categoria_id = p_categoria_id AND plan_id IS NOT DISTINCT FROM p_plan_id
    AND estado = 'esperando' ORDER BY created_at, id LIMIT 1 FOR UPDATE;
  RETURN QUERY UPDATE public.intereses SET estado = 'avisado', avisado_at = clock_timestamp() WHERE id = v_id RETURNING *;
END;
$$;

CREATE VIEW public.v_demanda_sin_stock WITH (security_invoker = true) AS
SELECT categoria_id, plan_id, count(*) AS cantidad_esperando, min(created_at) AS esperando_desde
FROM public.intereses WHERE estado = 'esperando' GROUP BY categoria_id, plan_id;
REVOKE ALL ON public.v_demanda_sin_stock FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_demanda_sin_stock TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.catalogo_disponible(), public.reservar_perfil(text, text, text),
  public.liberar_reserva(uuid, text), public.expirar_reservas(), public.registrar_interes(text, text, text, text),
  public.siguiente_interesado(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.catalogo_disponible(), public.reservar_perfil(text, text, text),
  public.liberar_reserva(uuid, text), public.expirar_reservas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_interes(text, text, text, text), public.siguiente_interesado(text, text) TO service_role;
