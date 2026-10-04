import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import type { VentaItem } from '@/components/ventas/form/ventas-form-shared';
import { createVentaBatchUseCase } from '@/application/use-cases/ventas/venta-batch-use-case';
vi.mock('@/application/use-cases/ventas/venta-batch-use-case', () => ({ createVentaBatchUseCase: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(createVentaBatchUseCase).mockResolvedValue('pedido-id'); });

vi.mock('@/application/use-cases/terceros/tercero-metodo-pago-use-cases', () => ({ syncTerceroMetodoPagoUseCase: vi.fn() }));
vi.mock('@/platform/observability/logger', () => ({ reportError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));
import { useVentaCreateSubmit } from './useVentaCreateSubmit';

const items: VentaItem[] = ['one', 'two'].map(id => ({
  id, itemId: id, tipo: 'cuenta', planId: 'plan', planNombre: 'Mensual', categoriaId: 'cat', categoriaNombre: 'Streaming',
  servicioId: id, servicioNombre: id, precio: 10, descuento: 0, precioFinal: 10,
}));
const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
const params = () => ({
  clienteId: 'client', clienteSeleccionado: undefined, editedMessage: '', estadoVenta: 'activo',
  fechaFin: new Date('2026-10-05'), fechaInicio: new Date('2026-09-05'), items,
  metodoPagoId: 'method', metodoPagoSeleccionado: { nombre: 'Banco', moneda: 'USD' },
  notifyCliente: false, onSaved: vi.fn(), setPendingWhatsApp: vi.fn(), totalFinal: 20,
});
const clienteSeleccionado = {
  id: 'client', nombre: 'María', apellido: 'Pérez', tipo: 'cliente' as const, telefono: '+507 6000-0000',
  metodoPagoId: 'method', metodoPagoNombre: 'Banco', active: true, createdAt: new Date(), updatedAt: new Date(), createdBy: 'u1',
};

describe('atomic venta cart', () => {
  it('retries the complete cart with the same intent without client-side partial sales', async () => {
    vi.mocked(createVentaBatchUseCase).mockRejectedValueOnce(new Error('timeout'));
    const options = params();
    const { result } = renderHook(() => useVentaCreateSubmit(options));
    await act(() => result.current.handleGuardarVenta(event()));
    expect(options.onSaved).not.toHaveBeenCalled();
    const failedKey = vi.mocked(createVentaBatchUseCase).mock.calls[0][1];
    await act(() => result.current.handleGuardarVenta(event()));
    expect(createVentaBatchUseCase).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createVentaBatchUseCase).mock.calls[1][1]).toBe(failedKey);
    expect(vi.mocked(createVentaBatchUseCase).mock.calls[1][0]).toHaveLength(2);
    expect(options.onSaved).toHaveBeenCalledOnce();
  });

  it('does not release the submit lock until the atomic request completes', async () => {
    let finish!: (id: string) => void;
    vi.mocked(createVentaBatchUseCase).mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useVentaCreateSubmit(params()));
    await act(async () => {
      const first = result.current.handleGuardarVenta(event());
      await result.current.handleGuardarVenta(event());
      expect(createVentaBatchUseCase).toHaveBeenCalledOnce();
      finish('pedido-id');
      await first;
    });
    expect(result.current.saving).toBe(false);
  });

  it('keeps a committed cart saved when customer notification fails', async () => {
    const options = { ...params(), notifyCliente: true, editedMessage: 'Mensaje',
      sendDirectMessage: vi.fn().mockRejectedValue(new Error('network')) };
    const { result } = renderHook(() => useVentaCreateSubmit(options));
    await act(() => result.current.handleGuardarVenta(event()));
    expect(createVentaBatchUseCase).toHaveBeenCalledOnce();
    expect(options.onSaved).toHaveBeenCalledOnce();
  });
});
describe('notifying the client on save', () => {
  it('sends the message directly when a chat is already open and skips the pending-WhatsApp toast', async () => {
    const sendDirectMessage = vi.fn().mockResolvedValue({ ok: true });
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado, sendDirectMessage };
    const { result } = renderHook(() => useVentaCreateSubmit(options));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(sendDirectMessage).toHaveBeenCalledWith('Tu venta quedó activa');
    expect(options.setPendingWhatsApp).not.toHaveBeenCalled();
    expect(options.onSaved).toHaveBeenCalledOnce();
  });

  it('falls back to the pending-WhatsApp toast when the direct send is not possible (e.g. 24h window closed)', async () => {
    const sendDirectMessage = vi.fn().mockResolvedValue({ ok: false, reason: 'La ventana de 24 h está cerrada' });
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado, sendDirectMessage };
    const { result } = renderHook(() => useVentaCreateSubmit(options));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(sendDirectMessage).toHaveBeenCalledOnce();
    expect(options.setPendingWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tu venta quedó activa' }));
  });

  it('uses the pending-WhatsApp toast as before when no direct sender is provided', async () => {
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado };
    const { result } = renderHook(() => useVentaCreateSubmit(options));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(options.setPendingWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tu venta quedó activa' }));
  });
});
