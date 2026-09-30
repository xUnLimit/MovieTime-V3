import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), getAll: vi.fn(), getById: vi.fn(), query: vi.fn(), count: vi.fn(),
  create: vi.fn(), update: vi.fn(), archive: vi.fn(), createPayment: vi.fn(),
  refund: vi.fn(), createInitial: vi.fn(), deletePayment: vi.fn(), deleteAll: vi.fn(), updatePayment: vi.fn(),
}));
vi.mock('./client', () => ({ supabase: { from: mocks.from } }));
vi.mock('./record-core', () => ({
  getAll: mocks.getAll, getById: mocks.getById, queryDocuments: mocks.query,
  getCount: mocks.count, create: mocks.create, update: mocks.update,
  archiveRecord: mocks.archive,
}));
vi.mock('./payments-repository', () => ({ createPagoVenta: mocks.createPayment }));
vi.mock('./ventas-rpc-adapter', () => ({
  createVentaRefundRpc: mocks.refund, createVentaWithInitialPaymentRpc: mocks.createInitial,
  deleteVentaPaymentRpc: mocks.deletePayment, deleteVentaWithPaymentsRpc: mocks.deleteAll,
  updateVentaPaymentAndPeriodRpc: mocks.updatePayment,
}));

import { countVentas, createPagoVenta, createVenta, createVentaRefund, createVentaWithInitialPayment, getPagoVentaById, getVentaById, queryPagosVenta, queryVentas, removePagoVenta, removeVenta, removeVentaWithPayments, updateLatestVentaPeriodo, updateVenta, updateVentaPaymentAndPeriod, updateVentaPeriodoById, type VentaPeriodoUpdate } from './ventas-repository';

function dbQuery(result: { data?: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };
  for (const method of ['select', 'eq', 'order', 'limit', 'update'] as const) chain[method].mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  return chain;
}

const period: VentaPeriodoUpdate = {
  fechaInicio: new Date(2026, 0, 1), fechaVencimiento: new Date(2026, 1, 1),
  cicloPago: 'mensual', precio: 12, descuento: 2, monto: 10,
  moneda: 'USD', montoUsd: 10, exchangeRate: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReset();
});

describe('sales repository', () => {
  it('delegates every sale and payment facade', async () => {
    mocks.createInitial.mockResolvedValue('v1'); mocks.refund.mockResolvedValue('r1'); await getVentaById('v1'); await queryVentas(); await countVentas();
    await createVenta({ clienteId: 'c1' }); await updateVenta('v1', { notas: 'n' }); await removeVenta('v1');
    await removeVentaWithPayments('v1', true);
    expect(await createVentaWithInitialPayment({} as never)).toBe('v1');
    expect(await createVentaRefund({} as never)).toBe('r1');
    await getPagoVentaById('p1'); await queryPagosVenta();
    await createPagoVenta({} as never); await removePagoVenta('p1');
    expect(mocks.archive).toHaveBeenCalledWith('ventas', 'v1');
    expect(mocks.deleteAll).toHaveBeenCalledWith({ p_venta_id: 'v1', p_delete_payments: true });
    expect(mocks.deletePayment).toHaveBeenCalledWith({ p_pago_id: 'p1' });
  });

  it('updates the latest sale period including plan snapshots', async () => {
    const select = dbQuery({ data: { id: 'period-1' }, error: null });
    const update = dbQuery({ error: null });
    mocks.from.mockReturnValueOnce(select).mockReturnValueOnce(update);
    await updateLatestVentaPeriodo('v1', {
      ...period, planId: 'plan1', planNombre: undefined, planTipoNombre: null,
    });
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      fecha_inicio: '2026-01-01', fecha_fin: '2026-02-01', plan_id: 'plan1',
      plan_nombre_snapshot: '', plan_tipo_nombre_snapshot: '',
    }));
  });

  it('updates a direct sale period without plan fields', async () => {
    const update = dbQuery({ error: null });
    mocks.from.mockReturnValue(update);
    await updateVentaPeriodoById('period-1', period);
    expect(update.update).toHaveBeenCalledWith(expect.not.objectContaining({ plan_id: expect.anything() }));
  });

  it('propagates latest-period selection, missing id and update failures', async () => {
    mocks.from.mockReturnValueOnce(dbQuery({ error: { message: 'select' } }));
    await expect(updateLatestVentaPeriodo('v1', period)).rejects.toThrow('select');
    mocks.from.mockReturnValueOnce(dbQuery({ data: null, error: null }));
    await expect(updateLatestVentaPeriodo('v1', period)).rejects.toThrow('no retorno');
    mocks.from.mockReturnValueOnce(dbQuery({ error: { message: 'update' } }));
    await expect(updateVentaPeriodoById('p1', period)).rejects.toThrow('update');
  });

  it('updates payment and period without plan changes', async () => {
    await updateVentaPaymentAndPeriod('pay1', {
      ...period, metodoPagoId: '', metodoPagoNombre: '', notas: undefined,
    });
    expect(mocks.updatePayment).toHaveBeenCalledWith(expect.objectContaining({
      p_pago_id: 'pay1', p_metodo_pago_id: null,
      p_metodo_pago_nombre_snapshot: null, p_pago_notas: null,
    }));
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('updates plan data by the payment period id', async () => {
    const select = dbQuery({ data: { venta_periodo_id: 'period-1' }, error: null });
    const update = dbQuery({ error: null });
    mocks.from.mockReturnValueOnce(select).mockReturnValueOnce(update);
    await updateVentaPaymentAndPeriod('pay1', {
      ...period, planId: '', planNombre: 'Plan', planTipoNombre: 'Tipo',
    });
    expect(update.update).toHaveBeenCalledWith({
      plan_id: null, plan_nombre_snapshot: 'Plan', plan_tipo_nombre_snapshot: 'Tipo',
    });
  });

  it('rejects plan lookups with query errors, malformed rows and update errors', async () => {
    mocks.from.mockReturnValueOnce(dbQuery({ error: { message: 'payment-select' } }));
    await expect(updateVentaPaymentAndPeriod('p1', { ...period, planId: 'x' })).rejects.toThrow('payment-select');
    for (const invalid of [null, {}, { venta_periodo_id: '' }, { venta_periodo_id: 2 }]) {
      mocks.from.mockReturnValueOnce(dbQuery({ data: invalid, error: null }));
      await expect(updateVentaPaymentAndPeriod('p1', { ...period, planId: 'x' })).rejects.toThrow('venta_periodo_id');
    }
    mocks.from
      .mockReturnValueOnce(dbQuery({ data: { venta_periodo_id: 'period-1' }, error: null }))
      .mockReturnValueOnce(dbQuery({ error: { message: 'plan-update' } }));
    await expect(updateVentaPaymentAndPeriod('p1', { ...period, planId: 'x' })).rejects.toThrow('plan-update');
  });
});
