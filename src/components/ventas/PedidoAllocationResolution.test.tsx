import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pedido } from '@/modules/orders/contracts';
import { PedidoAllocationResolution } from './PedidoAllocationResolution';

const state = vi.hoisted(() => ({ accept: vi.fn(), assign: vi.fn(), refund: vi.fn(), refetch: vi.fn(), loading: false, failed: false, hasQuote: true, busy: false, error: null as Error | null }));
vi.mock('@/hooks/use-pedido-resolution', () => ({ usePedidoResolution: () => ({ quote: { data: state.hasQuote ? { total: 14, difference: 2, items: [{ id: 'i1', oldTotal: 6, newTotal: 8 }, { id: 'unknown', oldTotal: 6, newTotal: 6 }] } : null, isLoading: state.loading, isError: state.failed, refetch: state.refetch }, accept: { mutate: state.accept, isPending: state.busy, error: state.error }, assign: { mutate: state.assign, isPending: false, error: null }, refund: { mutate: state.refund, isPending: false, error: null } }) }));
const base: Pedido = { id: 'order-1', terceroId: null, contactId: null, moneda: 'USD', total: 12, estado: 'esperando_pago', paymentState: 'cubierto', deliveryState: 'pendiente', receivedAmount: 12, missingAmount: 0, excessAmount: 0, allocatedAmount: 0, refundedAmount: 0, unallocatedAmount: 12, expiraAt: '2100-10-03T12:00:00Z', items: [{ id: 'i1', tipo: 'nueva', servicioId: 's1', ventaId: null, planNombre: 'Netflix', total: 6, estado: 'pendiente', ventaIdResultante: null }, { id: 'i2', tipo: 'nueva', servicioId: 's2', ventaId: null, planNombre: 'Disney+', total: 6, estado: 'pendiente', ventaIdResultante: null }] };
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.clearAllMocks(); state.loading = false; state.failed = false; state.hasQuote = true; state.busy = false; state.error = null; });
describe('revisión de asignación y dinero pendiente', () => {
  it('confirma un subconjunto y su importe sin repetir el cobro ni asignar todo', () => {
    render(<PedidoAllocationResolution pedido={base} />); fireEvent.click(screen.getByRole('button', { name: 'Asignar servicios elegidos' }));
    const confirm = screen.getByRole('button', { name: 'Confirmar asignación parcial' }); expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Netflix/ })); fireEvent.click(screen.getByRole('checkbox', { name: /El cliente acepta/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Disney/ })); expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Disney/ })); fireEvent.click(screen.getByRole('checkbox', { name: /El cliente acepta/ })); fireEvent.click(confirm);
    expect(state.assign).toHaveBeenCalledWith({ itemIds: ['i1'], amount: 6 }, expect.any(Object));
    act(() => state.assign.mock.calls[0][1].onSuccess()); expect(screen.getByRole('status').textContent).toContain('Servicios elegidos asignados');
  });
  it('exige nueva aceptación del precio cuando vence la reserva y maneja la consulta', () => {
    const expired = { ...base, expiraAt: '2000-10-03T12:00:00Z' }; state.loading = true;
    const { rerender } = render(<PedidoAllocationResolution pedido={expired} />); fireEvent.click(screen.getByRole('button', { name: 'Revisar precio vigente' })); expect(screen.getByRole('status').textContent).toContain('Consultando');
    state.loading = false; state.failed = true; rerender(<PedidoAllocationResolution pedido={expired} />); fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' })); expect(state.refetch).toHaveBeenCalled();
    state.failed = false; state.hasQuote = false; rerender(<PedidoAllocationResolution pedido={expired} />); expect(screen.queryByRole('button', { name: 'Aceptar total acordado' })).toBeNull();
    state.hasQuote = true; rerender(<PedidoAllocationResolution pedido={expired} />); expect(screen.getByText(/Nuevo total/).textContent).toContain('14.00'); expect(screen.getByText(/Servicio:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /El cliente aceptó/ })); fireEvent.click(screen.getByRole('button', { name: 'Aceptar total acordado' })); expect(state.accept).toHaveBeenCalledWith(14, expect.any(Object));
    act(() => state.accept.mock.calls[0][1].onSuccess()); expect(screen.getByRole('status').textContent).toContain('Precio acordado registrado');
  });
  it('devuelve únicamente principal sin asignar, exige comprobación y permite volver', () => {
    render(<PedidoAllocationResolution pedido={{ ...base, deliveryState: 'parcial', allocatedAmount: 6, unallocatedAmount: 6 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución sin asignar' })); expect(screen.getByText(/cancela los servicios todavía pendientes/)).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Confirmar devolución registrada' }); fireEvent.submit(button.closest('form')!); expect(state.refund).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Referencia de la devolución'), { target: { value: 'bad@email' } }); fireEvent.click(screen.getByRole('checkbox')); expect(button).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Referencia de la devolución'), { target: { value: 'BANK-01' } }); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button);
    expect(state.refund).toHaveBeenCalledWith({ reference: 'BANK-01', amount: 6 }, expect.any(Object)); act(() => state.refund.mock.calls[0][1].onSuccess()); expect(screen.getByRole('status').textContent).toContain('Devolución registrada');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución sin asignar' })); fireEvent.click(screen.getByRole('button', { name: 'Volver a revisión del pedido' })); expect(screen.queryByLabelText('Referencia de la devolución')).toBeNull();
  });
  it('impide selección descubierta, omite operaciones en cancelados y conserva errores seguros', () => {
    const { rerender } = render(<PedidoAllocationResolution pedido={{ ...base, unallocatedAmount: 2 }} />); fireEvent.click(screen.getByRole('button', { name: 'Asignar servicios elegidos' })); fireEvent.click(screen.getByRole('checkbox', { name: /Netflix/ })); expect(screen.getByRole('alert').textContent).toContain('no cubre');
    state.error = new Error('SQL secreto'); state.busy = true; rerender(<PedidoAllocationResolution pedido={{ ...base, unallocatedAmount: 2 }} />); expect(screen.getAllByRole('alert').at(-1)?.textContent).not.toContain('SQL secreto');
    rerender(<PedidoAllocationResolution pedido={{ ...base, estado: 'cancelado', unallocatedAmount: undefined, allocatedAmount: undefined, refundedAmount: undefined }} />); expect(screen.queryByRole('button', { name: 'Asignar servicios elegidos' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Registrar devolución sin asignar' })).toBeNull();
  });
});
