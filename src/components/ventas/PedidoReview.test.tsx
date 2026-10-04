import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pedido } from '@/modules/orders/contracts';
import { PedidoReview } from './PedidoReview';

const state = vi.hoisted(() => ({ retry: vi.fn(), cancel: vi.fn(), reconcile: vi.fn(), delivery: vi.fn(), pending: false, error: null as Error | null }));
vi.mock('@/hooks/use-pedidos', () => ({ usePedidoActions: () => ({ retry: { mutate: state.retry, isPending: state.pending, error: state.error }, delivery: { mutate: state.delivery, isPending: false, error: null }, cancel: { mutate: state.cancel, isPending: false, error: null }, reconcile: { mutate: state.reconcile, isPending: false, error: null } }) }));
vi.mock('./PedidoExcessResolution', () => ({ PedidoExcessResolution: () => <p>Resolver exceso de pago</p> }));
vi.mock('./PedidoAllocationResolution', () => ({ PedidoAllocationResolution: () => <p>Revisar saldo sin asignar</p> }));
const base: Pedido = { id: '00000000-0000-4000-8000-000000000001', terceroId: null, contactId: null, moneda: 'USD', total: 12, estado: 'confirmado', paymentState: 'parcial', deliveryState: 'pendiente', receivedAmount: 8, missingAmount: 4, excessAmount: 0, expiraAt: '2100-10-03T12:00:00Z', items: [{ id: '00000000-0000-4000-8000-000000000002', tipo: 'renovacion', servicioId: 's1', ventaId: 'v1', planNombre: 'Netflix', total: 12, estado: 'pendiente', ventaIdResultante: null }] };
beforeEach(() => { vi.clearAllMocks(); state.pending = false; state.error = null; });

describe('PedidoReview', () => {
  it('separa cobro, faltante y entrega; verifica una referencia sin pedir teléfono del pagador', () => {
    render(<PedidoReview pedido={base} />);
    expect(screen.getByText('Pago incompleto')).toBeTruthy();
    expect(screen.getByText('Sin asignar')).toBeTruthy();
    expect(screen.getByText(/El teléfono del pagador puede ser diferente/)).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Verificar y aplicar ingreso' });
    expect(button).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Referencia del comprobante Yappy'), { target: { value: ' REF-123 ' } });
    fireEvent.click(button);
    expect(state.reconcile).toHaveBeenCalledWith({ id: base.id, code: 'REF-123' }, expect.any(Object));
    act(() => state.reconcile.mock.calls[0][1].onSuccess());
    expect(screen.getByText(/Ingreso conciliado/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).toBeNull();
  });
  it('reintenta asignación pagada y conserva el cobro registrado', () => {
    render(<PedidoReview pedido={{ ...base, receivedAmount: 12, missingAmount: 0, paymentState: 'cubierto' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar asignación' }));
    expect(state.retry).toHaveBeenCalledWith(base.id, expect.any(Object));
    act(() => state.retry.mock.calls[0][1].onSuccess());
    expect(screen.getByText(/Asignación revisada/)).toBeTruthy();
  });
  it('solo cancela un pedido sin dinero recibido tras mostrar su consecuencia', () => {
    render(<PedidoReview pedido={{ ...base, receivedAmount: 0, missingAmount: 12, paymentState: 'pendiente' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    expect(state.cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('button', { name: 'Confirmar cancelación' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    act(() => state.cancel.mock.calls[0][1].onSuccess());
    expect(screen.getByText(/Pedido cancelado/)).toBeTruthy();
  });
  it('reintenta solo la entrega de una asignación existente sin repetir el cobro', () => {
    render(<PedidoReview pedido={{ ...base, receivedAmount: 12, missingAmount: 0, paymentState: 'cubierto', deliveryState: 'asignado' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar envío de acceso' }));
    expect(state.delivery).toHaveBeenCalledWith(base.id, expect.any(Object));
    expect(state.retry).not.toHaveBeenCalled();
    expect(state.reconcile).not.toHaveBeenCalled();
    act(() => state.delivery.mock.calls[0][1].onSuccess({ processed: 1, failed: 1 }));
    expect(screen.getByRole('status').textContent).toContain('1 solicitudes procesadas, 1 fallos');
    expect(screen.getByRole('status').textContent).toContain('revísalo desde Chats');
  });
  it('explica exceso, expiración y acceso enviado; muestra error seguro', () => {
    state.error = new Error('SQL interno privado');
    const { rerender } = render(<PedidoReview pedido={{ ...base, moneda: 'EUR', estado: 'expirado', excessAmount: 2, paymentState: 'exceso' }} />);
    expect(screen.getByText('Resolver exceso de pago')).toBeTruthy();
    expect(screen.getByText(/reserva vigente/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).not.toContain('SQL interno');
    rerender(<PedidoReview pedido={{ ...base, missingAmount: 0, deliveryState: 'asignado' }} />);
    expect(screen.getByText(/El envío del acceso se procesa por separado/)).toBeTruthy();
    rerender(<PedidoReview pedido={{ ...base, missingAmount: 0, deliveryState: 'enviado', items: [{ ...base.items[0], estado: 'aplicado', tipo: 'nueva', ventaId: null, ventaIdResultante: 'v2' }] }} />);
    expect(screen.getByText(/Asignación completada/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver venta' }).getAttribute('href')).toBe('/ventas/v2');
    expect(screen.getByText(/operación y el envío del acceso están completos/)).toBeTruthy();
  });
  it('revisa precio antes de asignar una reserva vencida y distingue asignación parcial y devolución', () => {
    const { rerender } = render(<PedidoReview pedido={{ ...base, expiraAt: '2000-01-01T00:00:00Z', missingAmount: 0 }} />);
    expect(screen.getByText(/registra el total acordado/)).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Reintentar asignación' })).toBeNull();
    rerender(<PedidoReview pedido={{ ...base, deliveryState: 'parcial', paymentState: 'parcialmente_reembolsado', missingAmount: 0 }} />);
    expect(screen.getByText('Devolución parcial')).toBeTruthy(); expect(screen.getByText(/Algunos servicios están asignados/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar asignación' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Reintentar envío de acceso' })).toBeTruthy();
    rerender(<PedidoReview pedido={{ ...base, estado: 'cancelado', paymentState: 'reembolsado' }} />); expect(screen.getByText('Devuelto')).toBeTruthy();
  });
  it('muestra el pago candidato ya cruzado y lo confirma con un clic por la misma conciliación', () => {
    const pedido = { ...base, estado: 'pago_en_revision', reviewCandidate: { code: 'VAEIZ-93839238', amount: 4, paidAt: '2026-10-04T12:00:00Z', reason: 'Coincide en monto; confirmar manualmente' } };
    render(<PedidoReview pedido={pedido} />);
    expect(screen.getByText('Pago candidato del correo de Yappy')).toBeTruthy();
    expect(screen.getByText(/Coincide en monto/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar con este pago' }));
    expect(state.reconcile).toHaveBeenCalledWith({ id: base.id, code: 'VAEIZ-93839238' }, expect.any(Object));
    act(() => state.reconcile.mock.calls[0][1].onSuccess());
    expect(screen.getByText(/Ingreso conciliado/)).toBeTruthy();
  });
  it('no ofrece el candidato si el pedido está cancelado o no tiene faltante', () => {
    const reviewCandidate = { code: 'ABCDE-12345678', amount: 4, paidAt: 'fecha inválida', reason: null };
    const { rerender } = render(<PedidoReview pedido={{ ...base, estado: 'cancelado', reviewCandidate }} />);
    expect(screen.queryByRole('button', { name: 'Confirmar con este pago' })).toBeNull();
    rerender(<PedidoReview pedido={{ ...base, missingAmount: 0, paymentState: 'cubierto', reviewCandidate }} />);
    expect(screen.queryByRole('button', { name: 'Confirmar con este pago' })).toBeNull();
    rerender(<PedidoReview pedido={{ ...base, reviewCandidate }} />);
    expect(screen.getByRole('button', { name: 'Confirmar con este pago' })).toBeTruthy();
  });
});
