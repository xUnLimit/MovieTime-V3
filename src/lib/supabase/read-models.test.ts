import { describe, expect, it } from 'vitest';

import type { PagoVenta } from '@/types';
import { ENTITIES } from './entities';
import { mapReadRow } from './read-models';

describe('mapReadRow pagosVenta', () => {
  it('derives renewal descriptions from the venta period number', () => {
    const pago = mapReadRow<PagoVenta>(ENTITIES.PAGOS_VENTA, {
      id: 'pago-2',
      venta_id: 'venta-1',
      cliente_id: 'cliente-1',
      cliente_nombre: 'Cliente Demo',
      fecha_pago: '2026-05-05T12:00:00.000Z',
      monto_original: 12,
      moneda_original: 'USD',
      metodo_pago_nombre_snapshot: 'Yappy',
      numero_periodo: 3,
      periodo_inicio: '2026-06-01',
      periodo_fin: '2026-07-01',
    });

    expect(pago.descripcion).toBe('Renovación #2');
    expect(pago.numeroPeriodo).toBe(3);
    expect(pago.isPagoInicial).toBe(false);
  });

  it('keeps the initial payment description for period one', () => {
    const pago = mapReadRow<PagoVenta>(ENTITIES.PAGOS_VENTA, {
      id: 'pago-1',
      venta_id: 'venta-1',
      cliente_id: 'cliente-1',
      cliente_nombre: 'Cliente Demo',
      fecha_pago: '2026-05-05T12:00:00.000Z',
      monto_original: 10,
      moneda_original: 'USD',
      metodo_pago_nombre_snapshot: 'Yappy',
      numero_periodo: 1,
      periodo_inicio: '2026-05-01',
      periodo_fin: '2026-06-01',
    });

    expect(pago.descripcion).toBe('Pago inicial');
    expect(pago.isPagoInicial).toBe(true);
  });
});
