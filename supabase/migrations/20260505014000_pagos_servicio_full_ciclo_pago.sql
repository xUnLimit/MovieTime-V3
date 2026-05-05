-- Expose servicio period billing cycle in payment history views.

CREATE OR REPLACE VIEW v_pagos_servicio_full
WITH (security_invoker = true)
AS
SELECT
  ps.*,
  s.nombre AS servicio_nombre,
  s.categoria_id,
  c.nombre AS categoria_nombre,
  sp.numero_periodo,
  sp.fecha_inicio AS periodo_inicio,
  sp.fecha_vencimiento AS periodo_vencimiento,
  sp.ciclo_pago
FROM pagos_servicio ps
JOIN servicio_periodos sp ON sp.id = ps.servicio_periodo_id
JOIN servicios s ON s.id = ps.servicio_id
LEFT JOIN categorias c ON c.id = s.categoria_id;
