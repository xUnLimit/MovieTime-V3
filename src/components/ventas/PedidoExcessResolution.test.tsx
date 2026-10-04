import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PedidoExcessResolution } from './PedidoExcessResolution';

const state = vi.hoisted(() => ({ mutate: vi.fn(), pending: false, error: null as Error | null }));
vi.mock('@/hooks/use-pedidos', () => ({ usePedidoActions: () => ({ excess: { mutate: state.mutate, isPending: state.pending, error: state.error } }) }));
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.clearAllMocks(); state.pending = false; state.error = null; });
describe('resolución de exceso', () => {
  it('exige referencia válida y confirmación antes de registrar el crédito completo', () => {
    render(<PedidoExcessResolution id="order-1" amount={2} currency="USD" />);
    const submit = screen.getByRole('button', { name: 'Registrar crédito' });
    fireEvent.submit(submit.closest('form')!); expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Referencia del crédito'), { target: { value: 'invalid@email' } });
    fireEvent.click(screen.getByRole('checkbox')); expect(submit).toHaveProperty('disabled', true);
    fireEvent.submit(submit.closest('form')!); expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Referencia del crédito'), { target: { value: ' LEDGER-01 ' } });
    expect(screen.getByRole('checkbox').getAttribute('data-state')).toBe('unchecked');
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(submit);
    expect(state.mutate).toHaveBeenCalledWith({ id: 'order-1', action: 'credito', reference: 'LEDGER-01', amount: 2 }, expect.any(Object));
    act(() => state.mutate.mock.calls[0][1].onSuccess());
    expect(screen.getByRole('status').textContent).toContain('Resolución registrada'); expect(submit).toHaveProperty('disabled', true);
  });
  it('registra una devolución externa comprobada sin prometer una transferencia', () => {
    const { rerender } = render(<PedidoExcessResolution id="order-2" amount={3} currency="EUR" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Devolución comprobada' }));
    expect(screen.getByText(/no transfiere dinero/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Referencia de la transferencia'), { target: { value: 'BANK/2026-01' } });
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }));
    expect(state.mutate).toHaveBeenCalledWith({ id: 'order-2', action: 'reembolsado', reference: 'BANK/2026-01', amount: 3 }, expect.any(Object));
    state.pending = true; state.error = new Error('SQL privado'); rerender(<PedidoExcessResolution id="order-2" amount={3} currency="EUR" />);
    expect(screen.getByRole('button', { name: 'Registrar devolución' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('alert').textContent).not.toContain('SQL privado');
    fireEvent.click(screen.getByRole('radio', { name: 'Crédito al cliente' }));
    expect(screen.getByRole('checkbox').getAttribute('data-state')).toBe('unchecked');
  });
});
