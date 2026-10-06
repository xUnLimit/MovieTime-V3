import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pedido } from '@/modules/orders/contracts';
import { PedidoManualActions } from './PedidoManualActions';

const state = vi.hoisted(() => ({ payment: vi.fn(), delivered: vi.fn(), remove: vi.fn(), error: null as Error | null }));
vi.mock('@/hooks/use-pedidos', () => ({
  usePedidoActions: () => ({
    payment: { mutate: state.payment, isPending: false, error: state.error }, delivered: { mutate: state.delivered, isPending: false, error: null },
    remove: { mutate: state.remove, isPending: false, error: null },
  }),
}));
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }

const item = { id: '00000000-0000-4000-8000-000000000002', tipo: 'nueva' as const, servicioId: 's1', ventaId: null, planNombre: 'Netflix', total: 12, estado: 'pendiente', ventaIdResultante: null };
const base: Pedido = { id: '00000000-0000-4000-8000-000000000001', terceroId: null, contactId: null, moneda: 'USD', total: 12, estado: 'esperando_pago', paymentState: 'pendiente', deliveryState: 'pendiente', receivedAmount: 0, missingAmount: 12, excessAmount: 0, expiraAt: '2100-10-03T12:00:00Z', items: [item] };
beforeEach(() => { vi.clearAllMocks(); state.error = null; vi.stubGlobal('ResizeObserver', ResizeObserverStub); });

describe('PedidoManualActions', () => {
  it('registra un pago manual solo con monto válido, referencia y confirmación', async () => {
    const user = userEvent.setup();
    render(<PedidoManualActions pedido={base} />);
    const submit = screen.getByRole('button', { name: 'Registrar pago' });
    expect(screen.getByLabelText(/Monto recibido/)).toHaveProperty('value', '12.00');
    expect(submit).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Referencia o medio de pago'), { target: { value: ' Efectivo 5-oct ' } });
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que recibí/ }));
    fireEvent.change(screen.getByLabelText(/Monto recibido/), { target: { value: '5.123' } });
    expect(screen.getByRole('alert').textContent).toContain('hasta dos decimales');
    expect(submit).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText(/Monto recibido/), { target: { value: '5.50' } });
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que recibí/ }));
    await user.click(submit);
    expect(state.payment).toHaveBeenCalledWith({ id: base.id, amount: 5.5, reference: 'Efectivo 5-oct' }, expect.any(Object));
    state.payment.mock.calls[0][1].onSuccess();
    expect(await screen.findByText(/Pago registrado/)).toBeTruthy();
  });

  it('marca el acceso como entregado solo tras confirmar y solo si está cobrado y asignado', async () => {
    const user = userEvent.setup();
    const assigned: Pedido = { ...base, paymentState: 'cubierto', deliveryState: 'asignado', receivedAmount: 12, missingAmount: 0, items: [{ ...item, estado: 'aplicado' }] };
    const { rerender } = render(<PedidoManualActions pedido={assigned} />);
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Marcar acceso como entregado' }));
    expect(state.delivered).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar entrega' }));
    expect(state.delivered).toHaveBeenCalledWith(base.id, expect.any(Object));
    rerender(<PedidoManualActions pedido={{ ...assigned, paymentState: 'parcial' }} />);
    expect(screen.queryByRole('button', { name: /entregado/ })).toBeNull();
  });

  it('elimina tras confirmar, también cuando el pedido tiene dinero', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PedidoManualActions pedido={base} />);
    await user.click(screen.getByRole('button', { name: 'Eliminar pedido' }));
    expect(state.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar pedido' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    expect(state.remove).toHaveBeenCalledWith(base.id, expect.any(Object));
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    rerender(<PedidoManualActions pedido={{ ...base, receivedAmount: 5, missingAmount: 7 }} />);
    expect(screen.getByRole('button', { name: 'Eliminar pedido' })).toBeTruthy();
  });

  it('permite eliminar un pedido cancelado con historial y muestra un error seguro', () => {
    const { rerender } = render(<PedidoManualActions pedido={{ ...base, estado: 'cancelado', receivedAmount: 12, missingAmount: 0, paymentState: 'cubierto', deliveryState: 'asignado', items: [{ ...item, estado: 'aplicado' }] }} />);
    expect(screen.getByRole('button', { name: 'Eliminar pedido' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).toBeNull();
    state.error = new Error('SQL detail');
    rerender(<PedidoManualActions pedido={base} />);
    expect(screen.getByRole('alert').textContent).not.toContain('SQL detail');
  });
});
