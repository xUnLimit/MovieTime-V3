import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pedido } from '@/modules/orders/contracts';
import { canCancelPedido, canRetryPedido, PedidoRowActions } from './PedidoRowActions';

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), retry: vi.fn(), remove: vi.fn() }));
vi.mock('@/hooks/use-pedidos', () => ({
  usePedidoActions: () => ({ cancel: { mutate: mocks.cancel, isPending: false, error: null }, retry: { mutate: mocks.retry, isPending: false, error: null }, remove: { mutate: mocks.remove, isPending: false, error: null } }),
}));

function pedido(overrides: Partial<Pedido> = {}): Pedido {
  return { id: 'order-1', terceroId: null, contactId: null, moneda: 'USD', total: 12, estado: 'confirmado', paymentState: 'pendiente', deliveryState: 'pendiente',
    receivedAmount: 0, missingAmount: 12, excessAmount: 0, expiraAt: '2026-10-03', items: [], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

describe('reglas de acciones del pedido', () => {
  it('solo cancela pedidos abiertos, sin dinero recibido ni entrega', () => {
    expect(canCancelPedido(pedido())).toBe(true);
    expect(canCancelPedido(pedido({ receivedAmount: 5 }))).toBe(false);
    expect(canCancelPedido(pedido({ estado: 'cancelado' }))).toBe(false);
    expect(canCancelPedido(pedido({ deliveryState: 'asignado' }))).toBe(false);
  });
  it('reintenta la asignación solo con el cobro cubierto y entrega incompleta', () => {
    expect(canRetryPedido(pedido({ missingAmount: 0, receivedAmount: 12 }))).toBe(true);
    expect(canRetryPedido(pedido())).toBe(false);
    expect(canRetryPedido(pedido({ missingAmount: 0, deliveryState: 'enviado' }))).toBe(false);
    expect(canRetryPedido(pedido({ missingAmount: 0, estado: 'expirado' }))).toBe(false);
  });
});

describe('PedidoRowActions', () => {
  it('cancela tras confirmar', async () => {
    const user = userEvent.setup();
    render(<PedidoRowActions pedido={pedido()} onReview={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Acciones del pedido' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancelar pedido' }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    expect(mocks.cancel).toHaveBeenCalledWith('order-1', expect.anything());
  });
  it('revisa y reintenta desde el menú; oculta lo que no aplica', async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<PedidoRowActions pedido={pedido({ missingAmount: 0, receivedAmount: 12 })} onReview={onReview} />);
    await user.click(screen.getByRole('button', { name: 'Acciones del pedido' }));
    expect(screen.queryByRole('menuitem', { name: 'Cancelar pedido' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Reintentar asignación' }));
    expect(mocks.retry).toHaveBeenCalledWith('order-1');
    await user.click(screen.getByRole('button', { name: 'Acciones del pedido' }));
    await user.click(screen.getByRole('menuitem', { name: 'Revisar pedido' }));
    expect(onReview).toHaveBeenCalled();
  });

  it('lleva al chat y al cliente cuando el pedido los tiene y copia el número de pedido', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<PedidoRowActions pedido={pedido({ id: 'order-9', contactId: '50761112222', terceroId: 't1' })} client={{ name: 'Ana Pérez', phone: '50761112222' }} onReview={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Acciones del pedido' }));
    expect(screen.getByRole('menuitem', { name: 'Abrir chat con Ana' }).getAttribute('href')).toBe('/chats?wa=50761112222');
    expect(screen.getByRole('menuitem', { name: 'Ver cliente' }).getAttribute('href')).toBe('/terceros/t1');
    await user.click(screen.getByRole('menuitem', { name: 'Copiar número de pedido' }));
    expect(writeText).toHaveBeenCalledWith('order-9');
  });
  it('sin chat ni cliente solo ofrece revisar y copiar', async () => {
    const user = userEvent.setup();
    render(<PedidoRowActions pedido={pedido()} onReview={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Acciones del pedido' }));
    expect(screen.queryByRole('menuitem', { name: /Abrir chat/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Ver cliente' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Copiar número de pedido' })).toBeTruthy();
  });
  it('elimina solo pedidos sin dinero ni servicios asignados y tras confirmar', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PedidoRowActions pedido={pedido({ estado: 'cancelado' })} onReview={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Acciones del pedido' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar pedido' }));
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Eliminar pedido' }));
    expect(mocks.remove).toHaveBeenCalledWith('order-1', expect.any(Object));
    unmount();
    render(<PedidoRowActions pedido={pedido({ receivedAmount: 5, missingAmount: 7 })} onReview={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Acciones del pedido' }));
    expect(screen.queryByRole('menuitem', { name: 'Eliminar pedido' })).toBeNull();
  });
});
