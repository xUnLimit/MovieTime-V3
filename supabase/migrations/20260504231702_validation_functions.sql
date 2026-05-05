-- ============================================================================
-- 010_validation_functions.sql
-- Funciones SQL helper para validar el estado del sistema post-migracion.
-- Estos checks vienen de Parte 8 del plan. Cada funcion devuelve filas con
-- registros que violan invariantes; un sistema sano devuelve cero filas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- check_ventas_sin_servicio: ventas con servicio_id roto.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_ventas_sin_servicio()
RETURNS TABLE (venta_id TEXT, servicio_id TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT v.id, v.servicio_id
  FROM ventas v
  LEFT JOIN servicios s ON s.id = v.servicio_id
  WHERE s.id IS NULL;
$$;

-- ----------------------------------------------------------------------------
-- check_ventas_categoria_inconsistente: categoria_id de venta no coincide
-- con categoria_id del servicio. Se permite porque categoria_id es snapshot
-- historico, pero util para auditoria.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_ventas_categoria_inconsistente()
RETURNS TABLE (
  venta_id TEXT,
  venta_categoria_id TEXT,
  servicio_categoria_id TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT v.id, v.categoria_id, s.categoria_id
  FROM ventas v
  JOIN servicios s ON s.id = v.servicio_id
  WHERE v.categoria_id <> s.categoria_id;
$$;

-- ----------------------------------------------------------------------------
-- check_perfiles_ocupados_inconsistentes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_perfiles_ocupados_inconsistentes()
RETURNS TABLE (
  servicio_id TEXT,
  perfiles_ocupados_actual INTEGER,
  perfiles_ocupados_real BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id,
    s.perfiles_ocupados,
    COUNT(v.id)
  FROM servicios s
  LEFT JOIN ventas v
    ON v.servicio_id = s.id
    AND v.estado = 'activo'
    AND v.archivado_at IS NULL
    AND v.perfil_numero IS NOT NULL
  GROUP BY s.id
  HAVING s.perfiles_ocupados <> COUNT(v.id);
$$;

-- ----------------------------------------------------------------------------
-- check_doble_venta_perfil: dos ventas activas en el mismo perfil.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_doble_venta_perfil()
RETURNS TABLE (
  servicio_id TEXT,
  perfil_numero INTEGER,
  conteo BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT v.servicio_id, v.perfil_numero, COUNT(*)
  FROM ventas v
  WHERE v.estado = 'activo'
    AND v.archivado_at IS NULL
    AND v.perfil_numero IS NOT NULL
  GROUP BY v.servicio_id, v.perfil_numero
  HAVING COUNT(*) > 1;
$$;

-- ----------------------------------------------------------------------------
-- check_pagos_venta_sin_periodo
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_pagos_venta_sin_periodo()
RETURNS TABLE (pago_id TEXT, venta_periodo_id TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT pv.id, pv.venta_periodo_id
  FROM pagos_venta pv
  LEFT JOIN venta_periodos vp ON vp.id = pv.venta_periodo_id
  WHERE vp.id IS NULL;
$$;

-- ----------------------------------------------------------------------------
-- check_pagos_servicio_sin_periodo
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_pagos_servicio_sin_periodo()
RETURNS TABLE (pago_id TEXT, servicio_periodo_id TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT ps.id, ps.servicio_periodo_id
  FROM pagos_servicio ps
  LEFT JOIN servicio_periodos sp ON sp.id = ps.servicio_periodo_id
  WHERE sp.id IS NULL;
$$;

-- ----------------------------------------------------------------------------
-- check_periodos_venta_saldo_distinto: pagado != total.
-- Reporte de revision: filas no son error si hay pagos parciales o pendientes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_periodos_venta_saldo_distinto()
RETURNS TABLE (
  venta_periodo_id TEXT,
  venta_id TEXT,
  total_usd NUMERIC,
  pagado_usd NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    vp.id,
    vp.venta_id,
    vp.total_usd,
    COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0)
  FROM venta_periodos vp
  LEFT JOIN pagos_venta pv ON pv.venta_periodo_id = vp.id
  GROUP BY vp.id
  HAVING COALESCE(SUM(pv.monto_usd) FILTER (WHERE pv.estado = 'registrado'), 0) <> vp.total_usd;
$$;

-- ----------------------------------------------------------------------------
-- check_periodos_servicio_saldo_distinto
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_periodos_servicio_saldo_distinto()
RETURNS TABLE (
  servicio_periodo_id TEXT,
  servicio_id TEXT,
  costo_usd NUMERIC,
  pagado_usd NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sp.id,
    sp.servicio_id,
    sp.costo_usd,
    COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0)
  FROM servicio_periodos sp
  LEFT JOIN pagos_servicio ps ON ps.servicio_periodo_id = sp.id
  GROUP BY sp.id
  HAVING COALESCE(SUM(ps.monto_usd) FILTER (WHERE ps.estado = 'registrado'), 0) <> sp.costo_usd;
$$;

-- ----------------------------------------------------------------------------
-- check_archivados_inconsistentes:
-- ventas archivadas activas y servicios archivados activos. No es error
-- (es estado historico permitido), pero la UI no debe mostrarlas como
-- operativas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_ventas_archivadas_activas()
RETURNS TABLE (venta_id TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM ventas
  WHERE archivado_at IS NOT NULL
    AND estado = 'activo';
$$;

CREATE OR REPLACE FUNCTION check_servicios_archivados_activos()
RETURNS TABLE (servicio_id TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM servicios
  WHERE archivado_at IS NOT NULL
    AND activo = true;
$$;

-- ----------------------------------------------------------------------------
-- run_all_validations: agregador para cutover. Devuelve un resumen JSON.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION run_all_validations()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'ventas_sin_servicio', (SELECT COUNT(*) FROM check_ventas_sin_servicio()),
    'ventas_categoria_inconsistente', (SELECT COUNT(*) FROM check_ventas_categoria_inconsistente()),
    'perfiles_ocupados_inconsistentes', (SELECT COUNT(*) FROM check_perfiles_ocupados_inconsistentes()),
    'doble_venta_perfil', (SELECT COUNT(*) FROM check_doble_venta_perfil()),
    'pagos_venta_sin_periodo', (SELECT COUNT(*) FROM check_pagos_venta_sin_periodo()),
    'pagos_servicio_sin_periodo', (SELECT COUNT(*) FROM check_pagos_servicio_sin_periodo()),
    'periodos_venta_saldo_distinto', (SELECT COUNT(*) FROM check_periodos_venta_saldo_distinto()),
    'periodos_servicio_saldo_distinto', (SELECT COUNT(*) FROM check_periodos_servicio_saldo_distinto()),
    'ventas_archivadas_activas', (SELECT COUNT(*) FROM check_ventas_archivadas_activas()),
    'servicios_archivados_activos', (SELECT COUNT(*) FROM check_servicios_archivados_activos())
  );
$$;
