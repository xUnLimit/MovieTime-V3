import { beforeEach, expect, it, vi } from 'vitest';
import { createVentaBatchUseCase } from './venta-batch-use-case';
import { createPedidoPanelUseCase } from '@/application/use-cases/pedidos-use-cases';
import { getUsdValues, type VentaInput } from './ventas-shared';

vi.mock('@/application/use-cases/pedidos-use-cases', () => ({ createPedidoPanelUseCase: vi.fn() }));
vi.mock('./ventas-shared', () => ({ getUsdValues: vi.fn() }));
const id = '11111111-1111-4111-8111-111111111111';
const input: VentaInput = { clienteId: id, planId: id, servicioId: id, categoriaId: id,
  clienteNombre: 'Fixture', servicioNombre: 'Streaming',
  fechaInicio: new Date('2026-10-01T12:00:00Z'), fechaFin: new Date('2026-11-01T12:00:00Z'), precio: 10,
};
beforeEach(() => { vi.clearAllMocks(); vi.mocked(createPedidoPanelUseCase).mockResolvedValue(id); vi.mocked(getUsdValues).mockResolvedValue({ usd: 1, rate: 1 }); });
it('groups all items by currency in one transaction and gets one exchange rate per currency', async () => {
  const configured = { ...input, moneda: 'EUR', perfilNumero: 2, descuento: 5, cicloPago: 'anual' as const,
    estado: 'inactivo' as const, perfilNombre: 'Familia', codigo: 'fixture', notas: 'Nota', metodoPagoId: id, metodoPagoNombre: 'Banco' };
  expect(await createVentaBatchUseCase([input, input, configured], id)).toBe(id);
  expect(getUsdValues).toHaveBeenCalledTimes(2);
  const groups = vi.mocked(createPedidoPanelUseCase).mock.calls[0][0];
  expect(groups[0].items).toHaveLength(2);
  expect(groups[1].moneda).toBe('EUR');
  expect(groups[1].items[0]).toMatchObject({ perfilNumero: 2, cicloPago: 'anual' });
});
it('rejects missing customer or plan before checkout and keeps a retry key', async () => {
  await expect(createVentaBatchUseCase([{ ...input, clienteId: undefined }], id)).rejects.toThrow('cliente y plan');
  await expect(createVentaBatchUseCase([{ ...input, planId: undefined }], id)).rejects.toThrow('cliente y plan');
  expect(createPedidoPanelUseCase).not.toHaveBeenCalled();
});
it('free carts preserve a zero amount without requiring a fictitious receipt', async () => {
  await createVentaBatchUseCase([{ ...input, precio: undefined }], id);
  expect(vi.mocked(createPedidoPanelUseCase).mock.calls[0][0][0].exchangeRate).toBe(1);
  expect(vi.mocked(createPedidoPanelUseCase).mock.calls[0][0][0].items[0].precio).toBe(0);
});
