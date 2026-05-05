-- Data repair for Spotify ventas whose legacy servicios were missing from
-- Firebase's servicios collection. The placeholder servicios are archived
-- after inserting the historical ventas/pagos, so operational service counts
-- remain unchanged while historical income matches Firebase.

BEGIN;

UPDATE servicios
SET archivado_at = NULL
WHERE id IN (
  'nfoboLTM89Ru6qRiK1kg',
  '7KqxH5lYc1qvcooym0pm',
  'YL5bzI79gmAZlAqWJpnr'
);

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
    'nfoboLTM89Ru6qRiK1kg',
    'OJFNyGW4LEogn7cgB3xC',
    NULL,
    'Spotify legacy missing service nfoboLTM89Ru6qRiK1kg',
    'legacy-missing-service@example.invalid',
    'legacy-missing-service',
    1,
    0,
    false,
    false,
    'Servicio placeholder creado para preservar pagos legacy migrados desde Firebase',
    'Este servicio no existia en la coleccion servicios de Firebase, pero una venta inactiva con pago lo referencia.',
    '2025-12-28T05:00:00Z',
    now()
  ),
  (
    '7KqxH5lYc1qvcooym0pm',
    'OJFNyGW4LEogn7cgB3xC',
    NULL,
    'Spotify legacy missing service 7KqxH5lYc1qvcooym0pm',
    'legacy-missing-service@example.invalid',
    'legacy-missing-service',
    1,
    0,
    false,
    false,
    'Servicio placeholder creado para preservar pagos legacy migrados desde Firebase',
    'Este servicio no existia en la coleccion servicios de Firebase, pero una venta inactiva con pago lo referencia.',
    '2026-01-19T05:00:00Z',
    now()
  ),
  (
    'YL5bzI79gmAZlAqWJpnr',
    'OJFNyGW4LEogn7cgB3xC',
    NULL,
    'Spotify legacy missing service YL5bzI79gmAZlAqWJpnr',
    'legacy-missing-service@example.invalid',
    'legacy-missing-service',
    1,
    0,
    false,
    false,
    'Servicio placeholder creado para preservar pagos legacy migrados desde Firebase',
    'Este servicio no existia en la coleccion servicios de Firebase, pero una venta inactiva con pago lo referencia.',
    '2025-12-30T05:00:00Z',
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
    'PJ7HZv87UFRSTJcfVOz7',
    '6obuL8E87CCKAwp5NdzM',
    'nfoboLTM89Ru6qRiK1kg',
    'OJFNyGW4LEogn7cgB3xC',
    'inactivo',
    5,
    '2025-12-28T05:00:00Z',
    now()
  ),
  (
    'SJtgG0Ljntz8zdCKmjK6',
    'IeItAZKiKK6M3VnPZxmb',
    '7KqxH5lYc1qvcooym0pm',
    'OJFNyGW4LEogn7cgB3xC',
    'inactivo',
    6,
    '2026-01-19T05:00:00Z',
    now()
  ),
  (
    'dxYy0M08UD4DHVDGes1c',
    'XBP2k4BVPAY4Jhx9oOnK',
    'YL5bzI79gmAZlAqWJpnr',
    'OJFNyGW4LEogn7cgB3xC',
    'inactivo',
    1,
    '2025-12-30T05:00:00Z',
    now()
  )
ON CONFLICT (id) DO NOTHING;

UPDATE ventas
SET
  cortada_at = COALESCE(cortada_at, updated_at),
  motivo_corte = COALESCE(motivo_corte, 'Migrado como inactivo desde Firestore')
WHERE id IN (
  'PJ7HZv87UFRSTJcfVOz7',
  'SJtgG0Ljntz8zdCKmjK6',
  'dxYy0M08UD4DHVDGes1c'
);

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
    'PJ7HZv87UFRSTJcfVOz7_periodo_1',
    'PJ7HZv87UFRSTJcfVOz7',
    1,
    'inicial',
    '2025-12-28',
    '2026-03-28',
    'trimestral',
    9.00,
    0,
    9.00,
    'USD',
    9.00,
    1,
    '2025-12-28T05:00:00Z'
  ),
  (
    'SJtgG0Ljntz8zdCKmjK6_periodo_1',
    'SJtgG0Ljntz8zdCKmjK6',
    1,
    'inicial',
    '2026-01-19',
    '2026-02-24',
    'mensual',
    4.00,
    0,
    4.00,
    'USD',
    4.00,
    1,
    '2026-01-19T05:00:00Z'
  ),
  (
    'dxYy0M08UD4DHVDGes1c_periodo_1',
    'dxYy0M08UD4DHVDGes1c',
    1,
    'inicial',
    '2025-12-30',
    '2026-03-30',
    'trimestral',
    9.00,
    0,
    9.00,
    'USD',
    9.00,
    1,
    '2025-12-30T05:00:00Z'
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
    'Ww8i6a7aBZyCEWOjwk4n',
    'PJ7HZv87UFRSTJcfVOz7_periodo_1',
    'PJ7HZv87UFRSTJcfVOz7',
    '2026-02-17T22:46:10Z',
    'registrado',
    9.00,
    'USD',
    9.00,
    1,
    '2026-02-17T22:46:10Z'
  ),
  (
    'Z09RGOaRBHPCLUWvAZxu',
    'SJtgG0Ljntz8zdCKmjK6_periodo_1',
    'SJtgG0Ljntz8zdCKmjK6',
    '2026-02-17T23:45:45Z',
    'registrado',
    4.00,
    'USD',
    4.00,
    1,
    '2026-02-17T23:45:46Z'
  ),
  (
    'QhsKY5ZytaOGiVkUrtPh',
    'dxYy0M08UD4DHVDGes1c_periodo_1',
    'dxYy0M08UD4DHVDGes1c',
    '2026-02-17T23:34:55Z',
    'registrado',
    9.00,
    'USD',
    9.00,
    1,
    '2026-02-17T23:34:56Z'
  )
ON CONFLICT (id) DO NOTHING;

UPDATE servicios
SET
  archivado_at = now(),
  motivo_archivado = 'Servicio placeholder creado para preservar pagos legacy migrados desde Firebase',
  updated_at = now()
WHERE id IN (
  'nfoboLTM89Ru6qRiK1kg',
  '7KqxH5lYc1qvcooym0pm',
  'YL5bzI79gmAZlAqWJpnr'
);

COMMIT;
