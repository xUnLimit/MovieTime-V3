import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import type { VentaItem } from '@/components/ventas/form/ventas-form-shared';

vi.mock('@/application/use-cases/ventas/create-ventas-from-cart-use-case', () => ({ createCartSession: () => ({ prepared: new Map(), completed: new Map() }) }));
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
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));
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

const saved = { batchId: 'pedido-1', ventaIds: ['venta-1', 'venta-2'], monedas: ['USD'], sinStock: [], warnings: [] };

describe('atomic cart retry', () => {
  it('retries the whole cart with the same intent without reporting partial success', async () => {
    const createCart = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(saved);
    const options = params();
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createCart }));
    await act(() => result.current.handleGuardarVenta(event()));
    expect(options.onSaved).not.toHaveBeenCalled();
    expect(notice.announce).not.toHaveBeenCalled();
    await act(() => result.current.handleGuardarVenta(event()));
    expect(createCart).toHaveBeenCalledTimes(2);
    expect(createCart.mock.calls[0][1].idempotencyKey).toBe(createCart.mock.calls[1][1].idempotencyKey);
    expect(createCart.mock.calls[1][0]).toHaveLength(2);
    expect(options.onSaved).toHaveBeenCalledOnce();
  });
  it('ignores a double submit while the single atomic request is running', async () => {
    let finish!: () => void;
    const createCart = vi.fn().mockImplementation(() => new Promise<typeof saved>(resolve => { finish = () => resolve(saved); }));
    const { result } = renderHook(() => useVentaCreateSubmit({ ...params(), createCart }));
    await act(async () => {
      const first = result.current.handleGuardarVenta(event());
      await result.current.handleGuardarVenta(event());
      expect(createCart).toHaveBeenCalledOnce();
      finish();
      await first;
    });
    expect(result.current.saving).toBe(false);
  });
});

describe('notifying the client on save', () => {
  it('sends the message directly when a chat is already open and skips the pending-WhatsApp toast', async () => {
    const createCart = vi.fn().mockResolvedValue(saved);
    const sendDirectMessage = vi.fn().mockResolvedValue({ ok: true });
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado, sendDirectMessage };
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createCart }));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(sendDirectMessage).toHaveBeenCalledWith('Tu venta quedó activa');
    expect(options.setPendingWhatsApp).not.toHaveBeenCalled();
    expect(options.onSaved).toHaveBeenCalledOnce();
  });

  it('falls back to the pending-WhatsApp toast when the direct send is not possible (e.g. 24h window closed)', async () => {
    const createCart = vi.fn().mockResolvedValue(saved);
    const sendDirectMessage = vi.fn().mockResolvedValue({ ok: false, reason: 'La ventana de 24 h está cerrada' });
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado, sendDirectMessage };
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createCart }));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(sendDirectMessage).toHaveBeenCalledOnce();
    expect(options.setPendingWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tu venta quedó activa' }));
  });

  it('uses the pending-WhatsApp toast as before when no direct sender is provided', async () => {
    const createCart = vi.fn().mockResolvedValue(saved);
    const options = { ...params(), notifyCliente: true, editedMessage: 'Tu venta quedó activa', clienteSeleccionado };
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createCart }));
    await act(() => result.current.handleGuardarVenta(event()));

    expect(options.setPendingWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tu venta quedó activa' }));
  });
});


it.each([true, false])('uses the subscription API rule with automatic sending on (from Chats: %s)', async (fromChat) => {
  notice.announce.mockResolvedValue('sent');
  const options = { ...params(), notifyCliente: true, editedMessage: 'Bienvenido', clienteSeleccionado };
  const sendDirectMessage = vi.fn();
  const createCart = vi.fn().mockResolvedValue(saved);
  const { result } = renderHook(() => useVentaCreateSubmit({
    ...options, createCart, sendDirectMessage: fromChat ? sendDirectMessage : undefined,
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
    const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createCart: vi.fn().mockResolvedValue(saved) }));
    await act(() => result.current.handleGuardarVenta(event()));
    expect(notice.announce).not.toHaveBeenCalled();
    expect(options.setPendingWhatsApp).not.toHaveBeenCalled();
  },
);

it('notifies only applied sales and reports stock per item and currency grouping', async () => {
  const { toast } = await import('sonner');
  const createCart = vi.fn().mockResolvedValue({ ...saved, ventaIds: ['venta-1'], monedas: ['USD', 'COP'], sinStock: ['two (two)'] });
  const { result } = renderHook(() => useVentaCreateSubmit({ ...params(), notifyCliente: true, createCart }));
  await act(() => result.current.handleGuardarVenta(event()));
  expect(notice.announce).toHaveBeenCalledWith(expect.objectContaining({ items: [{ ventaId: 'venta-1', message: null }] }));
  expect(toast.info).toHaveBeenCalledWith('Carrito dividido por moneda', expect.objectContaining({ description: expect.stringContaining('COP') }));
  expect(toast.warning).toHaveBeenCalledWith('Items sin stock', expect.objectContaining({ description: expect.stringContaining('two (two)') }));
});
it('keeps a single item working with its edited data', async () => {
  const createCart = vi.fn().mockResolvedValue({ ...saved, ventaIds: ['venta-1'] });
  const options = { ...params(), items: [{ ...items[0], notas: 'Nota', perfilNombre: 'Perfil', codigo: '1234' }] };
  const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createCart }));
  await act(() => result.current.handleGuardarVenta(event()));
  expect(createCart.mock.calls[0][0]).toEqual([expect.objectContaining({ notas: 'Nota', perfilNombre: 'Perfil', codigo: '1234' })]);
  expect(options.onSaved).toHaveBeenCalledOnce();
});
it.each([{ items: [] }, { clienteId: undefined }])('validates required form data: %j', async invalid => {
  const createCart = vi.fn();
  const { result } = renderHook(() => useVentaCreateSubmit({ ...params(), ...invalid, createCart }));
  await act(() => result.current.handleGuardarVenta(event()));
  expect(createCart).not.toHaveBeenCalled();
});

it('does not repeat announcements or writes after a successful submission', async () => {
  const createCart = vi.fn().mockResolvedValue(saved);
  const options = { ...params(), notifyCliente: true, editedMessage: 'Mensaje editado' };
  const { result } = renderHook(() => useVentaCreateSubmit({ ...options, createCart }));
  await act(() => result.current.handleGuardarVenta(event()));
  await act(() => result.current.handleGuardarVenta(event()));
  expect(createCart).toHaveBeenCalledOnce();
  expect(notice.announce).toHaveBeenCalledOnce();
  expect(options.setPendingWhatsApp).toHaveBeenCalledOnce();
  expect(options.onSaved).toHaveBeenCalledOnce();
});
it('retains per-item currencies in the orchestration input', async () => {
  const createCart = vi.fn().mockResolvedValue({ ...saved, monedas: ['USD', 'COP'] });
  const { result } = renderHook(() => useVentaCreateSubmit({ ...params(), items: [items[0], { ...items[1], moneda: 'COP' }], createCart }));
  await act(() => result.current.handleGuardarVenta(event()));
  expect(createCart.mock.calls[0][0].map((venta: { moneda: string }) => venta.moneda)).toEqual(['USD', 'COP']);
});
