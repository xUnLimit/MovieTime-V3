-- Data repair for two Prime Video ventas that referenced a missing legacy
-- servicio in Firestore. The placeholder servicio is archived so it does not
-- inflate operational service counters, while the ventas and pagos remain
-- visible in sales/category metrics.

BEGIN;

UPDATE servicios
SET archivado_at = NULL
WHERE id IN ('PS7p6DnmtLjlrLaXleuu', 'zANr1PpFgnkeXVuWej0v');

INSERT INTO servicios (
  id,
  categoria_id,
  plan_tipo_id,
  nombre,
  correo,
  contrasena,
  perfiles_disponibles,
  perfiles_ocupados,
  activo,
  en_reposo,
  motivo_archivado,
  notas,
  created_at,
  updated_at
)
VALUES
  (
    'PS7p6DnmtLjlrLaXleuu',
    '4FpAlsN6AElwj3w1HZmC',
    NULL,
    'Prime Video legacy missing service PS7p6DnmtLjlrLaXleuu',
    'legacy-missing-service@example.invalid',
    'legacy-missing-service',
    2,
    0,
    false,
    false,
    'Servicio placeholder creado para preservar ventas legacy migradas desde Firebase',
    'Este servicio no existia en la coleccion servicios de Firebase, pero dos ventas activas lo referencian.',
    '2026-04-06T01:13:14Z',
    now()
  ),
  (
    'zANr1PpFgnkeXVuWej0v',
    '4FpAlsN6AElwj3w1HZmC',
    NULL,
    'Prime Video legacy missing service zANr1PpFgnkeXVuWej0v',
    'legacy-missing-service@example.invalid',
    'legacy-missing-service',
    2,
    0,
    false,
    false,
    'Servicio placeholder creado para preservar pagos legacy migrados desde Firebase',
    'Este servicio no existia en la coleccion servicios de Firebase, pero dos ventas inactivas con pagos lo referencian.',
    '2025-02-16T05:00:00Z',
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO ventas (
  id,
  cliente_id,
  servicio_id,
  categoria_id,
  estado,
  perfil_numero,
  created_at,
  updated_at
)
VALUES
  (
    'X7pke60jiPUahz3wFz0V',
    'UYXirwxjQKzyFzEoU9SH',
    'PS7p6DnmtLjlrLaXleuu',
    '4FpAlsN6AElwj3w1HZmC',
    'activo',
    2,
    '2026-04-06T01:13:14Z',
    now()
  ),
  (
    'kLZbOaXAzqhmTbfyFQjZ',
    'xGj69xNmUJ0KpYMavYvI',
    'PS7p6DnmtLjlrLaXleuu',
    '4FpAlsN6AElwj3w1HZmC',
    'activo',
    1,
    '2026-04-19T05:00:00Z',
    now()
  ),
  (
    'OORyT0zsbOFwRfIDIEAH',
    'QSnPCZtmc2K7sXqPClUx',
    'zANr1PpFgnkeXVuWej0v',
    '4FpAlsN6AElwj3w1HZmC',
    'inactivo',
    2,
    '2025-06-11T05:00:00Z',
    now()
  ),
  (
    'oZzD0T6qtwRzARy0Rxkb',
    'rKBWzdc8ysU3uw1dAfU0',
    'zANr1PpFgnkeXVuWej0v',
    '4FpAlsN6AElwj3w1HZmC',
    'inactivo',
    1,
    '2025-02-16T05:00:00Z',
    now()
  )
ON CONFLICT (id) DO NOTHING;

UPDATE ventas
SET
  cortada_at = COALESCE(cortada_at, updated_at),
  motivo_corte = COALESCE(motivo_corte, 'Migrado como inactivo desde Firestore')
WHERE id IN ('OORyT0zsbOFwRfIDIEAH', 'oZzD0T6qtwRzARy0Rxkb');

INSERT INTO venta_periodos (
  id,
  venta_id,
  numero_periodo,
  tipo,
  fecha_inicio,
  fecha_fin,
  ciclo_pago,
  precio_original,
  descuento,
  total_original,
  moneda_original,
  total_usd,
  exchange_rate,
  created_at
)
VALUES
  (
    'X7pke60jiPUahz3wFz0V_periodo_1',
    'X7pke60jiPUahz3wFz0V',
    1,
    'inicial',
    '2026-04-06',
    '2026-05-06',
    'mensual',
    1.80,
    0,
    1.80,
    'USD',
    1.80,
    1,
    '2026-04-06T01:13:14Z'
  ),
  (
    'kLZbOaXAzqhmTbfyFQjZ_periodo_1',
    'kLZbOaXAzqhmTbfyFQjZ',
    1,
    'inicial',
    '2026-04-19',
    '2026-05-19',
    'mensual',
    2.00,
    0,
    2.00,
    'USD',
    2.00,
    1,
    '2026-04-19T05:00:00Z'
  ),
  (
    'OORyT0zsbOFwRfIDIEAH_periodo_1',
    'OORyT0zsbOFwRfIDIEAH',
    1,
    'inicial',
    '2025-06-11',
    '2026-06-11',
    'anual',
    9.00,
    0,
    9.00,
    'USD',
    9.00,
    1,
    '2025-06-11T05:00:00Z'
  ),
  (
    'oZzD0T6qtwRzARy0Rxkb_periodo_1',
    'oZzD0T6qtwRzARy0Rxkb',
    1,
    'inicial',
    '2025-02-16',
    '2026-02-16',
    'anual',
    9.00,
    0,
    9.00,
    'USD',
    9.00,
    1,
    '2025-02-16T05:00:00Z'
  )
ON CONFLICT (venta_id, numero_periodo) DO NOTHING;

INSERT INTO pagos_venta (
  id,
  venta_periodo_id,
  venta_id,
  fecha_pago,
  estado,
  monto_original,
  moneda_original,
  monto_usd,
  exchange_rate,
  created_at
)
VALUES
  (
    'OUJrzjK0zVKignHI2Uey',
    'X7pke60jiPUahz3wFz0V_periodo_1',
    'X7pke60jiPUahz3wFz0V',
    '2026-04-06T01:13:14Z',
    'registrado',
    1.80,
    'USD',
    1.80,
    1,
    '2026-04-06T01:13:14Z'
  ),
  (
    'Zjmb5sPFDT1pBYswHai1',
    'kLZbOaXAzqhmTbfyFQjZ_periodo_1',
    'kLZbOaXAzqhmTbfyFQjZ',
    '2026-04-19T05:00:00Z',
    'registrado',
    2.00,
    'USD',
    2.00,
    1,
    '2026-04-19T05:00:00Z'
  ),
  (
    'ruTkPRPVfuORsSKQWGZP',
    'OORyT0zsbOFwRfIDIEAH_periodo_1',
    'OORyT0zsbOFwRfIDIEAH',
    '2026-02-17T22:23:44Z',
    'registrado',
    9.00,
    'USD',
    9.00,
    1,
    '2026-02-17T22:23:45Z'
  ),
  (
    'vLOpnDTugFEWMgmU9V9n',
    'oZzD0T6qtwRzARy0Rxkb_periodo_1',
    'oZzD0T6qtwRzARy0Rxkb',
    '2026-02-17T22:22:10Z',
    'registrado',
    9.00,
    'USD',
    9.00,
    1,
    '2026-02-17T22:22:10Z'
  )
ON CONFLICT (id) DO NOTHING;

UPDATE servicios
SET
  archivado_at = now(),
  motivo_archivado = 'Servicio placeholder creado para preservar ventas legacy migradas desde Firebase',
  updated_at = now()
WHERE id IN ('PS7p6DnmtLjlrLaXleuu', 'zANr1PpFgnkeXVuWej0v');

COMMIT;
