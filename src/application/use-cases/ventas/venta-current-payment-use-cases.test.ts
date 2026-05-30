import { describe, expect, it, vi } from 'vitest';

import { getVentaConUltimoPagoUseCase as getVentaConUltimoPago } from './venta-current-payment-use-cases';
import type { PagoVenta, VentaDoc } from '@/types';

vi.mock('@/platform/supabase/ventas-repository', () => ({
  queryPagosVenta: vi.fn(),
}));

const ventaBase: VentaDoc = {
  id: 'venta-1',
  clienteNombre: 'Cliente Test',
  servicioId: 'servicio-1',
  servicioNombre: 'Servicio Test',
  categoriaId: 'categoria-1',
  estado: 'activo',
};

function pago(overrides: Partial<PagoVenta>): PagoVenta {
  return {
    id: 'pago-1',
    ventaId: 'venta-1',
    clienteId: 'cliente-1',
    clienteNombre: 'Cliente Test',
    fecha: new Date('2026-05-01T00:00:00'),
    monto: 10,
    metodoPago: 'Yappy',
    isPagoInicial: false,
    createdAt: new Date('2026-05-01T00:00:00'),
    ...overrides,
  };
}

describe('venta-current-payment-use-cases', () => {
  it('ignora reembolsos al derivar el pago vigente de la venta', async () => {
    const result = await getVentaConUltimoPago(ventaBase, [
      pago({
        id: 'refund-1',
        estado: 'reembolsado',
        monto: 8,
        metodoPago: 'Banco',
        fechaVencimiento: new Date('2026-07-01T00:00:00'),
      }),
      pago({
        id: 'registered-1',
        estado: 'registrado',
        monto: 12,
        metodoPago: 'Yappy',
        fechaInicio: new Date('2026-05-01T00:00:00'),
        fechaVencimiento: new Date('2026-06-01T00:00:00'),
      }),
    ]);

    expect(result.precioFinal).toBe(12);
    expect(result.metodoPagoNombre).toBe('Yappy');
    expect(result.fechaFin).toEqual(new Date('2026-06-01T00:00:00'));
  });
});
