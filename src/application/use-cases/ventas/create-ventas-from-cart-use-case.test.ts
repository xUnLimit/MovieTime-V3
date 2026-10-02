import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VentaInput } from './ventas-shared';
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), read: vi.fn(), rate: vi.fn(), sync: vi.fn(), emit: vi.fn(), log: vi.fn() }));
vi.mock('@/platform/supabase/pedidos-repository', () => ({ confirmarPedidoPanel: mocks.confirm, getPedidoPanelItems: mocks.read }));
vi.mock('./ventas-shared', () => ({ getUsdValues: mocks.rate, nullableMetodoPagoId: (id: string) => id }));
vi.mock('../terceros/tercero-metodo-pago-use-cases', () => ({ syncTerceroMetodoPagoUseCase: mocks.sync }));
vi.mock('@/platform/events/store-event-bus', () => ({ storeEventBus: { emit: mocks.emit } }));
vi.mock('@/platform/observability/logger', () => ({ reportError: vi.fn() }));
import { createCartSession, createVentasFromCartUseCase } from './create-ventas-from-cart-use-case';
const id = '10000000-0000-4000-8000-000000000001';
const key = '10000000-0000-4000-8000-000000000002';
const venta = (itemId = 'one', moneda = 'USD'): VentaInput => ({
  itemId, clienteId: id, clienteNombre: 'Cliente', servicioId: id, servicioNombre: itemId,
  categoriaId: id, planId: id, planNombre: 'Plan', precio: 12, descuento: 25, precioFinal: 9,
  moneda, metodoPagoId: id, metodoPagoNombre: 'Banco', fechaInicio: new Date('2026-10-01T12:00:00Z'),
  fechaFin: new Date('2026-11-01T12:00:00Z'), cicloPago: 'mensual', estado: 'activo',
  perfilNumero: 3, perfilNombre: 'Perfil', codigo: '1234', notas: 'Nota del operador',
});
const options = () => ({ idempotencyKey: key, session: createCartSession(), logContext: { usuarioId: id, usuarioEmail: 'test@example.test' }, recordActivityLog: mocks.log });
const item = (itemId: string, estado = 'aplicado') => ({
  pedido_id: id, estado, venta_id_resultante: estado === 'aplicado' ? `venta-${itemId}` : null,
  panel_snapshot: { item_id: itemId }, total: 9, ciclo_pago: 'mensual',
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.confirm.mockResolvedValue(id);
  mocks.rate.mockResolvedValue({ rate: 1, usd: 9 });
  mocks.read.mockResolvedValue({ pedidos: [{ id, moneda: 'USD' }], items: [item('one')] });
});
describe('createVentasFromCartUseCase', () => {
  it.each([1, 3])('confirms %i items in one atomic request with frozen form data', async count => {
    const ventas = Array.from({ length: count }, (_, i) => venta(`item-${i}`));
    mocks.read.mockResolvedValue({ pedidos: [{ id, moneda: 'USD' }], items: ventas.map(v => item(v.itemId ?? '')) });
    const result = await createVentasFromCartUseCase(ventas, options());
    expect(result.ventaIds).toHaveLength(count);
    expect(mocks.confirm).toHaveBeenCalledOnce();
    const group = mocks.confirm.mock.calls[0][0].p_panel_pedidos[0];
    expect(group.monto).toBe(count * 9);
    expect(group.items).toHaveLength(count);
    expect(group.items[0]).toMatchObject({ descuento: 25, perfil_numero: 3, ciclo_pago: 'mensual',
      panel: { precio: 12, total: 9, perfil_nombre: 'Perfil', codigo: '1234', notas: 'Nota del operador',
        fecha_inicio: '2026-10-01', fecha_fin: '2026-11-01', metodo_pago_id: id, metodo_pago_nombre: 'Banco' } });
    expect(mocks.log).toHaveBeenCalledTimes(count);
    expect(mocks.log.mock.calls[0][0]).toMatchObject({ detalles: expect.stringContaining('Venta creada:'), metadata: { pedidoId: id, precioFinal: 9 } });
    expect(mocks.emit.mock.calls.filter(([event]) => event.type === 'VENTA_CREATED')).toHaveLength(count);
    expect(mocks.emit).toHaveBeenCalledWith({ type: 'DASHBOARD_INVALIDATED' });
    expect(mocks.emit).toHaveBeenCalledWith({ type: 'NOTIFICACIONES_INVALIDATED', entity: 'venta' });
  });
  it('groups mixed currencies in the same transaction', async () => {
    mocks.rate.mockResolvedValueOnce({ rate: 1 }).mockResolvedValueOnce({ rate: 4000 });
    mocks.read.mockResolvedValue({ pedidos: [{ id, moneda: 'USD' }, { id: key, moneda: 'COP' }], items: [item('one'), item('two')] });
    const result = await createVentasFromCartUseCase([venta(), venta('two', 'COP')], options());
    expect(result.monedas).toEqual(['USD', 'COP']);
    expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(mocks.confirm.mock.calls[0][0].p_panel_pedidos).toEqual([
      expect.objectContaining({ moneda: 'USD', monto: 9, exchange_rate: 1 }),
      expect.objectContaining({ moneda: 'COP', monto: 9, exchange_rate: 4000 }),
    ]);
  });
  it('reports sin_stock per item without emitting a creation for it', async () => {
    mocks.read.mockResolvedValue({ pedidos: [{ id, moneda: 'USD' }], items: [item('one'), item('two', 'sin_stock')] });
    const result = await createVentasFromCartUseCase([venta(), venta('two')], options());
    expect(result.sinStock).toEqual(['two (two)']);
    expect(result.ventaIds).toEqual(['venta-one']);
    expect(mocks.log).toHaveBeenCalledOnce();
  });
  it('preserves inactive state and zero totals', async () => {
    await createVentasFromCartUseCase([{ ...venta(), estado: 'inactivo', precio: 0, precioFinal: 0 }], options());
    expect(mocks.confirm.mock.calls[0][0].p_panel_pedidos[0]).toMatchObject({ monto: 0, items: [{ panel: { estado: 'inactivo', total: 0 } }] });
  });
  it('does not run postcommit effects on failure, retries the exact frozen payload, and deduplicates success', async () => {
    const opts = options();
    mocks.confirm.mockRejectedValueOnce(new Error('rollback'));
    await expect(createVentasFromCartUseCase([venta()], opts)).rejects.toThrow('rollback');
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
    const first = mocks.confirm.mock.calls[0][0];
    const result = await createVentasFromCartUseCase([venta()], opts);
    expect(mocks.confirm.mock.calls[1][0]).toBe(first);
    await expect(createVentasFromCartUseCase([venta()], opts)).resolves.toBe(result);
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(mocks.rate).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledOnce();
  });
  it('recovers a committed response when the follow-up read fails without duplicating the intent', async () => {
    const opts = options();
    mocks.read.mockRejectedValueOnce(new Error('read timeout'));
    await expect(createVentasFromCartUseCase([venta()], opts)).rejects.toThrow('read timeout');
    await createVentasFromCartUseCase([venta()], opts);
    expect(mocks.confirm.mock.calls[0][0]).toBe(mocks.confirm.mock.calls[1][0]);
    expect(mocks.emit.mock.calls.filter(([event]) => event.type === 'VENTA_CREATED')).toHaveLength(1);
  });
  it('keeps confirmed results when activity or payment-method synchronization fails', async () => {
    mocks.log.mockRejectedValue(new Error('log error'));
    mocks.sync.mockRejectedValue(new Error('sync error'));
    const result = await createVentasFromCartUseCase([venta()], options());
    expect(result.ventaIds).toEqual(['venta-one']);
    expect(result.warnings).toHaveLength(2);
  });
  it.each([
    [], [{ ...venta(), clienteId: undefined }], [venta(), { ...venta('two'), clienteId: key }], [{ ...venta(), planId: undefined }], [{ ...venta(), precioFinal: 8 }],
    [{ ...venta(), itemId: undefined }], [venta(), venta()], [{ ...venta(), fechaFin: new Date('2026-09-01') }],
  ].map(ventas => ({ ventas })))('rejects malformed carts before RPC: %j', async ({ ventas }) => {
    await expect(createVentasFromCartUseCase(ventas, options())).rejects.toThrow();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});

it.each([
  [], [item('other')], [{ ...item('one'), venta_id_resultante: null }], [{ ...item('one'), estado: 'pendiente' }],
].map(items => ({ items })))('validates recovered outcomes before any postcommit effect: %j', async ({ items }) => {
  mocks.read.mockResolvedValue({ pedidos: [{ id, moneda: 'USD' }], items });
  await expect(createVentasFromCartUseCase([venta()], options())).rejects.toThrow();
  expect(mocks.emit).not.toHaveBeenCalled();
  expect(mocks.log).not.toHaveBeenCalled();
});
it('rejects duplicate recovered items before emitting any creation', async () => {
  mocks.read.mockResolvedValue({ pedidos: [{ id, moneda: 'USD' }], items: [item('one'), item('one')] });
  await expect(createVentasFromCartUseCase([venta(), venta('two')], options())).rejects.toThrow();
  expect(mocks.emit).not.toHaveBeenCalled();
});

it('accepts the form rounding at a half-cent boundary', async () => {
  mocks.read.mockResolvedValue({ pedidos: [{ id, moneda: 'USD' }], items: [{ ...item('one'), total: 0.81 }] });
  await createVentasFromCartUseCase([{ ...venta(), precio: 1.15, descuento: 30, precioFinal: 0.81 }], options());
  expect(mocks.confirm.mock.calls[0][0].p_panel_pedidos[0].items[0].panel.total).toBe(0.81);
});

it('keeps committed results and warns if an event listener fails', async () => {
  mocks.emit.mockImplementationOnce(() => { throw new Error('listener error'); });
  const opts = options();
  const result = await createVentasFromCartUseCase([venta()], opts);
  expect(result.ventaIds).toEqual(['venta-one']);
  expect(result.warnings).toHaveLength(1);
  await createVentasFromCartUseCase([venta()], opts);
  expect(mocks.confirm).toHaveBeenCalledOnce();
  expect(mocks.log).toHaveBeenCalledOnce();
});
