import { describe, expect, it } from 'vitest';
import type { Pedido } from '@/modules/orders/contracts';
import { canDeletePedido, canMarkDelivered, canRegisterPayment, isClosedPedido, matchesPedidoFilter, needsReview, pedidoClient, pedidoSearchText, pedidoStage, reservationHint } from './pedido-status';

const pedido = (over: Partial<Pedido> = {}): Pedido => ({
  id: '8faf2421-0000-4000-8000-000000000000', terceroId: null, contactId: null, moneda: 'USD', total: 12, estado: 'esperando_pago', paymentState: 'pendiente',
  deliveryState: 'pendiente', receivedAmount: 0, missingAmount: 12, excessAmount: 0, expiraAt: '2100-10-03T13:00:00Z', items: [], ...over,
});

describe('estado de los pedidos', () => {
  it('los cancelados y vencidos salen de las colas de cobro y entrega', () => {
    const closed = pedido({ estado: 'cancelado' });
    expect(isClosedPedido(closed)).toBe(true);
    expect(matchesPedidoFilter(closed, 'payment')).toBe(false);
    expect(matchesPedidoFilter(closed, 'delivery')).toBe(false);
    expect(matchesPedidoFilter(closed, 'closed')).toBe(true);
    expect(matchesPedidoFilter(pedido({ estado: 'expirado' }), 'closed')).toBe(true);
    expect(matchesPedidoFilter(pedido(), 'payment')).toBe(true);
    expect(matchesPedidoFilter(pedido({ deliveryState: 'enviado' }), 'complete')).toBe(true);
    expect(matchesPedidoFilter(pedido(), 'otro')).toBe(true);
  });
  it('por revisar: exceso, pago candidato o revisión marcada', () => {
    expect(needsReview(pedido())).toBe(false);
    expect(needsReview(pedido({ excessAmount: 2 }))).toBe(true);
    expect(needsReview(pedido({ reviewCandidate: { code: 'ABCD', amount: 12, paidAt: '2026-10-03T12:00:00Z', reason: null } }))).toBe(true);
    expect(needsReview(pedido({ estado: 'pago_en_revision' }))).toBe(true);
    expect(needsReview(pedido({ estado: 'cancelado', excessAmount: 2 }))).toBe(false);
  });
  it('nombra la etapa del ciclo de vida', () => {
    expect(['cancelado', 'expirado', 'esperando_pago', 'pago_en_revision', 'pagado', 'entregado', 'borrador', 'confirmado'].map(estado => pedidoStage(pedido({ estado })).label))
      .toEqual(['Cancelado', 'Vencido', 'Reservado', 'En revisión', 'Pagado', 'Entregado', 'Borrador', 'En curso']);
  });
  it('avisa cuándo vence o venció la reserva abierta y calla en los demás casos', () => {
    expect(reservationHint(pedido())).toMatch(/^Vence /);
    expect(reservationHint(pedido({ expiraAt: '2000-10-03T13:00:00Z' }))).toMatch(/^Venció /);
    expect(reservationHint(pedido({ estado: 'pagado' }))).toBe('');
    expect(reservationHint(pedido({ expiraAt: 'no es fecha' }))).toBe('');
  });
  it('resuelve el cliente por tercero o, si no, por su teléfono', () => {
    const names = new Map([['t1', 'Ana Pérez']]);
    expect(pedidoClient(pedido({ terceroId: 't1', contactId: '50761112222' }), names)).toEqual({ name: 'Ana Pérez', phone: '50761112222' });
    expect(pedidoClient(pedido({ contactId: '50761112222' }), names)).toEqual({ name: '+50761112222', phone: null });
    expect(pedidoClient(pedido({ terceroId: 'desconocido' }), names)).toBeNull();
    const item = { id: 'i', tipo: 'nueva' as const, servicioId: 's', ventaId: null, planNombre: 'Netflix', total: 12, estado: 'pendiente', ventaIdResultante: null };
    expect(pedidoSearchText(pedido({ items: [item] }), { name: 'Ana', phone: '507' })).toContain('netflix');
  });
});

describe('acciones manuales permitidas', () => {
  const applied = { id: 'i', tipo: 'nueva' as const, servicioId: 's', ventaId: null, planNombre: 'Netflix', total: 12, estado: 'aplicado', ventaIdResultante: 'v1' };
  it('eliminar exige no tener dinero ni servicios asignados', () => {
    expect(canDeletePedido(pedido())).toBe(true);
    expect(canDeletePedido(pedido({ estado: 'cancelado' }))).toBe(true);
    expect(canDeletePedido(pedido({ receivedAmount: 1 }))).toBe(false);
    expect(canDeletePedido(pedido({ deliveryState: 'asignado' }))).toBe(false);
    expect(canDeletePedido(pedido({ items: [applied] }))).toBe(false);
  });
  it('registrar pago solo en pedidos abiertos con faltante', () => {
    expect(canRegisterPayment(pedido())).toBe(true);
    expect(canRegisterPayment(pedido({ missingAmount: 0 }))).toBe(false);
    expect(canRegisterPayment(pedido({ estado: 'cancelado' }))).toBe(false);
  });
  it('marcar entregado solo si está cobrado, asignado y sin servicios pendientes', () => {
    const ready = pedido({ paymentState: 'cubierto', deliveryState: 'asignado', missingAmount: 0, items: [applied] });
    expect(canMarkDelivered(ready)).toBe(true);
    expect(canMarkDelivered({ ...ready, paymentState: 'parcial' })).toBe(false);
    expect(canMarkDelivered({ ...ready, deliveryState: 'enviado' })).toBe(false);
    expect(canMarkDelivered({ ...ready, estado: 'cancelado' })).toBe(false);
    expect(canMarkDelivered({ ...ready, items: [{ ...applied, estado: 'pendiente' }] })).toBe(false);
  });
});
