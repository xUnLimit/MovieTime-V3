import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), getAll: vi.fn(), getById: vi.fn(), query: vi.fn(), count: vi.fn(),
  create: vi.fn(), update: vi.fn(), archive: vi.fn(),
  deleteAll: vi.fn(), createInitial: vi.fn(), deletePayment: vi.fn(), updatePayment: vi.fn(),
}));
vi.mock('./client', () => ({ supabase: { from: mocks.from } }));
vi.mock('./record-core', () => ({
  getAll: mocks.getAll, getById: mocks.getById, queryDocuments: mocks.query,
  getCount: mocks.count, create: mocks.create, update: mocks.update,
  archiveRecord: mocks.archive, logCacheHit: vi.fn(),
}));
vi.mock('./servicios-rpc-adapter', () => ({
  deleteServicioWithPaymentsRpc: mocks.deleteAll,
  createServicioWithInitialPaymentRpc: mocks.createInitial,
  deleteServicioPaymentRpc: mocks.deletePayment,
  updateServicioPaymentAndPeriodRpc: mocks.updatePayment,
}));

import {
  countServicios, createServicio, createServicioWithInitialPayment, getPagoServicioById,
  getServicioById, getServicios, queryPagosServicio, queryServicios, removePagoServicio,
  removeServicio, removeServicioWithPayments, updateLatestServicioPeriodo, updatePagoServicio,
  updateServicio, updateServicioPaymentAndPeriod, updateServicioPeriodoById,
  type ServicioPeriodoUpdate,
} from './servicios-repository';

function dbQuery(result: { data?: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };
  for (const method of ['select', 'eq', 'order', 'limit', 'update'] as const) chain[method].mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  return chain;
}

const period: ServicioPeriodoUpdate = {
  fechaInicio: new Date(2026, 0, 1), fechaVencimiento: new Date(2026, 1, 1),
  cicloPago: 'mensual', costo: 10, moneda: 'USD', costoUsd: 10, exchangeRate: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReset();
});

describe('service repository', () => {
  it('delegates service and payment facades', async () => {
    mocks.createInitial.mockResolvedValue('s1');
    await getServicios(); await getServicioById('s1'); await queryServicios(); await countServicios();
    await createServicio({ nombre: 'S' }); await updateServicio('s1', { nombre: 'N' }); await removeServicio('s1');
    await removeServicioWithPayments('s1', true);
    expect(await createServicioWithInitialPayment({} as never)).toBe('s1');
    await queryPagosServicio(); await getPagoServicioById('p1'); await updatePagoServicio('p1', { notas: 'n' });
    await removePagoServicio('p1');
    expect(mocks.archive).toHaveBeenCalledWith('servicios', 's1');
    expect(mocks.deleteAll).toHaveBeenCalledWith({ p_servicio_id: 's1', p_delete_payments: true });
    expect(mocks.deletePayment).toHaveBeenCalledWith({ p_pago_id: 'p1' });
  });

  it('updates the latest period and includes optional automatic renewal', async () => {
    const select = dbQuery({ data: { id: 'period-1' }, error: null });
    const update = dbQuery({ error: null });
    mocks.from.mockReturnValueOnce(select).mockReturnValueOnce(update);
    await updateLatestServicioPeriodo('s1', { ...period, renovacionAutomatica: true });
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      fecha_inicio: '2026-01-01', fecha_vencimiento: '2026-02-01', renovacion_automatica: true,
    }));
  });

  it('updates a period directly without optional renewal', async () => {
    const update = dbQuery({ error: null });
    mocks.from.mockReturnValue(update);
    await updateServicioPeriodoById('period-1', period);
    expect(update.update).toHaveBeenCalledWith(expect.not.objectContaining({ renovacion_automatica: expect.anything() }));
  });

  it('propagates period selection, missing-id and update errors', async () => {
    mocks.from.mockReturnValueOnce(dbQuery({ error: { message: 'select' } }));
    await expect(updateLatestServicioPeriodo('s1', period)).rejects.toThrow('select');
    mocks.from.mockReturnValueOnce(dbQuery({ data: null, error: null }));
    await expect(updateLatestServicioPeriodo('s1', period)).rejects.toThrow('no retorno');
    mocks.from.mockReturnValueOnce(dbQuery({ error: { message: 'update' } }));
    await expect(updateServicioPeriodoById('p1', period)).rejects.toThrow('update');
  });

  it('maps payment-and-period RPC values and defaults', async () => {
    await updateServicioPaymentAndPeriod('pay1', {
      ...period, renovacionAutomatica: undefined, metodoPagoId: '', metodoPagoNombre: '', notas: undefined,
    });
    expect(mocks.updatePayment).toHaveBeenCalledWith(expect.objectContaining({
      p_pago_id: 'pay1', p_renovacion_automatica: false,
      p_metodo_pago_id: null, p_metodo_pago_nombre_snapshot: null, p_pago_notas: null,
    }));
  });
});
