-- ============================================================================
-- 006_triggers.sql
-- Triggers para invariantes:
--   * touch updated_at
--   * snapshot ventas.categoria_id desde servicios al crear
--   * bloquear creacion de ventas sobre servicios archivados
--   * recalcular servicios.perfiles_ocupados desde ventas activas
--   * crear profile cuando se crea auth.user
-- ============================================================================

-- ----------------------------------------------------------------------------
-- touch_updated_at: aplica a toda tabla con columna updated_at.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_metodos_pago BEFORE UPDATE ON metodos_pago
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_categorias BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_planes_tipos BEFORE UPDATE ON planes_tipos
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_planes BEFORE UPDATE ON planes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_usuarios BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_servicios BEFORE UPDATE ON servicios
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_ventas BEFORE UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_tipos_gasto BEFORE UPDATE ON tipos_gasto
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_gastos BEFORE UPDATE ON gastos
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_notificaciones BEFORE UPDATE ON notificaciones
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_templates BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_config BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_touch_dashboard_stats BEFORE UPDATE ON dashboard_stats
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ----------------------------------------------------------------------------
-- set_venta_categoria_snapshot: ventas.categoria_id es snapshot de
-- servicios.categoria_id al momento de crear. Tambien bloquea ventas
-- sobre servicios archivados.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_venta_categoria_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_categoria_id TEXT;
  v_archivado_at TIMESTAMPTZ;
BEGIN
  SELECT categoria_id, archivado_at
    INTO v_categoria_id, v_archivado_at
  FROM servicios
  WHERE id = NEW.servicio_id;

  IF v_categoria_id IS NULL THEN
    RAISE EXCEPTION 'servicio_id invalido: %', NEW.servicio_id;
  END IF;

  IF v_archivado_at IS NOT NULL THEN
    RAISE EXCEPTION 'no se puede crear venta sobre servicio archivado: %', NEW.servicio_id;
  END IF;

  NEW.categoria_id = v_categoria_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_venta_categoria_snapshot
  BEFORE INSERT ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION set_venta_categoria_snapshot();

-- ----------------------------------------------------------------------------
-- recalc_perfiles_ocupados: recalcula servicios.perfiles_ocupados desde
-- ventas activas no archivadas con perfil_numero. Se dispara por cualquier
-- cambio en ventas que pueda afectar el conteo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalc_perfiles_ocupados()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_servicio_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_servicio_ids := ARRAY[NEW.servicio_id];
  ELSIF (TG_OP = 'DELETE') THEN
    v_servicio_ids := ARRAY[OLD.servicio_id];
  ELSE
    -- UPDATE: incluir ambos por si cambio servicio_id (raro pero posible)
    IF NEW.servicio_id <> OLD.servicio_id THEN
      v_servicio_ids := ARRAY[NEW.servicio_id, OLD.servicio_id];
    ELSE
      v_servicio_ids := ARRAY[NEW.servicio_id];
    END IF;
  END IF;

  UPDATE servicios s
  SET perfiles_ocupados = sub.real_count
  FROM (
    SELECT
      s2.id,
      COALESCE(COUNT(v.id), 0)::INTEGER AS real_count
    FROM servicios s2
    LEFT JOIN ventas v
      ON v.servicio_id = s2.id
      AND v.estado = 'activo'
      AND v.archivado_at IS NULL
      AND v.perfil_numero IS NOT NULL
    WHERE s2.id = ANY(v_servicio_ids)
    GROUP BY s2.id
  ) sub
  WHERE s.id = sub.id
    AND s.perfiles_ocupados IS DISTINCT FROM sub.real_count;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recalc_perfiles_ocupados
  AFTER INSERT OR UPDATE OR DELETE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION recalc_perfiles_ocupados();

-- ----------------------------------------------------------------------------
-- handle_new_auth_user: cuando se crea un usuario en auth.users, crear
-- automaticamente su profile.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, ''),
    'operador'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();
