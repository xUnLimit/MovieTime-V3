import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import type { VentaItem } from '@/components/ventas/form/ventas-form-shared';
import { MutationCommittedError } from '@/platform/errors/mutation-committed-error';
const notice = vi.hoisted(() => ({ announce: vi.fn() }));
vi.mock('@/components/shared/announce-notice', () => ({ announceNotice: notice.announce }));
beforeEach(() => {
  vi.clearAllMocks();
  notice.announce.mockImplementation(async (input) => {
    await input.onAutoDisabled();
    return 'auto_disabled';
  });
});

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
  notifyCliente: false, onSaved: vi.fn(), setPendingWhatsApp: vi.fn(), totalFinal: 20, updatePerfilOcupado: vi.fn(),
});
const clienteSeleccionado = {
  id: 'client', nombre: 'María', apellido: 'Pérez', tipo: 'cliente' as const, telefono: '+507 6000-0000',
  metodoPagoId: 'method', metodoPagoNombre: 'Banco', active: true, createdAt: new Date(), updatedAt: new Date(), createdBy: 'u1',
};

describe('venta create batch retry', () => {
  it('retries only failed items with the same intent and does not replay saved items', async () => {
    const createVenta = vi.fn().mockResolvedValueOnce('venta-1').mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('venta-2');
    const options = params();
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createVenta }));
    await act(() => result.current.handleGuardarVenta(event()));
    expect(options.onSaved).not.toHaveBeenCalled();
    const failedKey = createVenta.mock.calls[1][1];
    await act(() => result.current.handleGuardarVenta(event()));
    expect(createVenta).toHaveBeenCalledTimes(3);
    expect(createVenta.mock.calls[2][1]).toBe(failedKey);
    expect(createVenta.mock.calls[2][0].servicioId).toBe('two');
    expect(options.onSaved).toHaveBeenCalledOnce();
  });

  it('waits for all requests before allowing retry and ignores a double submit', async () => {
    let finish!: () => void;
    const createVenta = vi.fn().mockRejectedValueOnce(new Error('timeout'))
      .mockImplementationOnce(() => new Promise<string>(resolve => { finish = () => resolve('venta-2'); }));
    const { result } = renderHook(() => useVentaCreateSubmit({ ...params(), createVenta }));
    await act(async () => {
      const first = result.current.handleGuardarVenta(event());
      await result.current.handleGuardarVenta(event());
      expect(createVenta).toHaveBeenCalledTimes(2);
      finish();
      await first;
    });
    expect(result.current.saving).toBe(false);
  });

  it('counts committed transactions as saved despite secondary errors', async () => {
    const createVenta = vi.fn().mockRejectedValueOnce(new MutationCommittedError('venta-one', new Error('log failed')))
      .mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('venta-2');
    const options = params();
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createVenta }));
    await act(() => result.current.handleGuardarVenta(event()));
    await act(() => result.current.handleGuardarVenta(event()));
    expect(createVenta).toHaveBeenCalledTimes(3);
    expect(options.onSaved).toHaveBeenCalledOnce();
  });
});

describe('notifying the client on save', () => {
  it('sends the message directly when a chat is already open and skips the pending-WhatsApp toast', async () => {
    const createVenta = vi.fn().mockResolvedValue('venta-2');
    const sendDirectMessage = vi.fn().mockResolvedValue({ ok: true });
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado, sendDirectMessage };
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createVenta }));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(sendDirectMessage).toHaveBeenCalledWith('Tu venta quedó activa');
    expect(options.setPendingWhatsApp).not.toHaveBeenCalled();
    expect(options.onSaved).toHaveBeenCalledOnce();
  });

  it('falls back to the pending-WhatsApp toast when the direct send is not possible (e.g. 24h window closed)', async () => {
    const createVenta = vi.fn().mockResolvedValue('venta-2');
    const sendDirectMessage = vi.fn().mockResolvedValue({ ok: false, reason: 'La ventana de 24 h está cerrada' });
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado, sendDirectMessage };
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createVenta }));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(sendDirectMessage).toHaveBeenCalledOnce();
    expect(options.setPendingWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tu venta quedó activa' }));
  });

  it('uses the pending-WhatsApp toast as before when no direct sender is provided', async () => {
    const createVenta = vi.fn().mockResolvedValue('venta-2');
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado };
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createVenta }));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(options.setPendingWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tu venta quedó activa' }));
  });
});


it.each([true, false])('uses the subscription API rule with automatic sending on (from Chats: %s)', async (fromChat) => {
  notice.announce.mockResolvedValue('sent');
  const options = { ...params(), notifyCliente: true, editedMessage: 'Bienvenido', clienteSeleccionado };
  const sendDirectMessage = vi.fn();
  const createVenta = vi.fn().mockResolvedValueOnce('venta-1').mockResolvedValueOnce('venta-2');
  const { result } = renderHook(() => useVentaCreateSubmit({
    ...options, createVenta, sendDirectMessage: fromChat ? sendDirectMessage : undefined,
  }));
  await act(() => result.current.handleGuardarVenta(event()));
  expect(notice.announce).toHaveBeenCalledWith(expect.objectContaining({
    tipo: 'suscripcion', items: [
      { ventaId: 'venta-1', message: expect.objectContaining({ message: 'Bienvenido' }) },
      { ventaId: 'venta-2', message: expect.objectContaining({ message: 'Bienvenido' }) },
    ],
  }));
  expect(sendDirectMessage).not.toHaveBeenCalled();
  expect(options.setPendingWhatsApp).not.toHaveBeenCalled();
});

it.each([{ notifyCliente: false, estadoVenta: 'activo' }, { notifyCliente: true, estadoVenta: 'inactivo' }])(
  'sends nothing when notification is unchecked or the sale is inactive: %j', async (flags) => {
    const options = { ...params(), ...flags, editedMessage: 'Bienvenido' };
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createVenta: vi.fn().mockResolvedValue('venta-1') }));
    await act(() => result.current.handleGuardarVenta(event()));
    expect(notice.announce).not.toHaveBeenCalled();
    expect(options.setPendingWhatsApp).not.toHaveBeenCalled();
  },
);

it('preserves saved IDs across batch retries including committed secondary errors', async () => {
  notice.announce.mockResolvedValue('sent');
  const createVenta = vi.fn().mockRejectedValueOnce(new MutationCommittedError('venta-1', new Error('secondary')))
    .mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('venta-2');
  const { result } = renderHook(() => useVentaCreateSubmit({ ...params(), notifyCliente: true, createVenta }));
  await act(() => result.current.handleGuardarVenta(event()));
  expect(notice.announce).not.toHaveBeenCalled();
  await act(() => result.current.handleGuardarVenta(event()));
  expect(notice.announce).toHaveBeenCalledWith(expect.objectContaining({
    items: [{ ventaId: 'venta-1', message: null }, { ventaId: 'venta-2', message: null }],
  }));
});
