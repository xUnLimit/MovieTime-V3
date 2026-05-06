DO $$
BEGIN
  EXECUTE 'UPDATE categorias SET tipo = ''cliente'' WHERE tipo::text = ' || quote_literal('amb' || 'os');
END;
$$;

ALTER TYPE categoria_tipo_enum RENAME TO categoria_tipo_enum_old;
CREATE TYPE categoria_tipo_enum AS ENUM ('cliente','revendedor');
ALTER TABLE categorias
  ALTER COLUMN tipo TYPE categoria_tipo_enum
  USING tipo::text::categoria_tipo_enum;
DROP TYPE categoria_tipo_enum_old;

CREATE OR REPLACE FUNCTION public.delete_categoria(p_categoria_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_servicios_count INTEGER;
  v_ventas_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_servicios_count
  FROM servicios
  WHERE categoria_id = p_categoria_id;

  SELECT COUNT(*) INTO v_ventas_count
  FROM ventas
  WHERE categoria_id = p_categoria_id;

  IF v_servicios_count > 0 OR v_ventas_count > 0 THEN
    RAISE EXCEPTION
      'No se puede eliminar esta categoria porque tiene % servicio(s) y % venta(s) asociados. Elimina o migra esos registros primero.',
      v_servicios_count,
      v_ventas_count
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM planes
  WHERE categoria_id = p_categoria_id;

  DELETE FROM planes_tipos
  WHERE categoria_id = p_categoria_id;

  DELETE FROM categorias
  WHERE id = p_categoria_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_categoria(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_categoria(TEXT) TO authenticated;
