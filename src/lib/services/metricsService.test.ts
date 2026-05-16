import { describe, expect, it } from 'vitest';

import { calculateVentasMetrics } from './metricsService';
import type { PagoVenta, VentaDoc } from '@/types';

function pago(overrides: Partial<PagoVenta>): PagoVenta {
  return {
    id: 'pago-1',
    ventaId: 'venta-1',
    clienteId: 'cliente-1',
    clienteNombre: 'Cliente Test',
    fecha: new Date('2026-05-01T00:00:00'),
    monto: 0,
    metodoPago: 'Yappy',
    moneda: 'USD',
    isPagoInicial: false,
    createdAt: new Date('2026-05-01T00:00:00'),
    ...overrides,
  };
}

const venta: VentaDoc = {
  id: 'venta-1',
  clienteNombre: 'Cliente Test',
  servicioId: 'servicio-1',
  servicioNombre: 'Servicio Test',
  categoriaId: 'categoria-1',
  estado: 'activo',
};

describe('calculateVentasMetrics', () => {
  it('resta pagos reembolsados del ingreso total', async () => {
    const metrics = await calculateVentasMetrics([venta], [
      pago({ id: 'registered-1', estado: 'registrado', monto: 20 }),
      pago({ id: 'refund-1', estado: 'reembolsado', monto: 7 }),
      pago({ id: 'void-1', estado: 'anulado', monto: 5 }),
    ]);

    expect(metrics.ingresoTotal).toBe(13);
  });
});
