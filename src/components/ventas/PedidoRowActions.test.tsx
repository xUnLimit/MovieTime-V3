import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pedido } from '@/modules/orders/contracts';
import { canCancelPedido, canRetryPedido, PedidoRowActions } from './PedidoRowActions';

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), retry: vi.fn() }));
vi.mock('@/hooks/use-pedidos', () => ({
  usePedidoActions: () => ({ cancel: { mutate: mocks.cancel, isPending: false, error: null }, retry: { mutate: mocks.retry, isPending: false, error: null } }),
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
});
