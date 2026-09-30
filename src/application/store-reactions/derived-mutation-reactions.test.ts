import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  forecastVenta: vi.fn(), forecastServicio: vi.fn(), deleteVenta: vi.fn(), deleteServicio: vi.fn(),
  safe: vi.fn(), invalidate: vi.fn(), dashboard: vi.fn(), context: vi.fn(() => ({ usuarioId: 'u1' })),
  record: vi.fn().mockResolvedValue(undefined), changes: vi.fn(),
}));
vi.mock('@/modules/forecasting', () => ({
  syncVentaForecastReadModels: mocks.forecastVenta,
  syncServicioForecastReadModels: mocks.forecastServicio,
}));
vi.mock('./notification-cache-reactions', () => ({
  deleteVentaNotificationStoreCache: mocks.deleteVenta,
  deleteServicioNotificationStoreCache: mocks.deleteServicio,
}));
vi.mock('@/platform/utils/safety', () => ({ safeAsyncSideEffect: mocks.safe }));
vi.mock('@/platform/cache/store-query-invalidation', () => ({ invalidateStoreQueries: mocks.invalidate }));
vi.mock('@/platform/commands/client-cache', () => ({ invalidateDashboardCache: mocks.dashboard }));
vi.mock('@/platform/activity/activity-log-adapter', () => ({
  getActivityLogContext: mocks.context, recordActivityLog: mocks.record,
}));
vi.mock('@/platform/utils/activityLogHelpers', () => ({ detectarCambios: mocks.changes }));

import { afterVentaCreated, afterVentaDeleted, afterVentaUpdated } from './ventas-mutation-reactions';
import { afterServicioCreated, afterServicioDeleted, afterServicioUpdated } from './servicios-mutation-reactions';
import { afterGastoCreated, afterGastoDeleted, afterGastoUpdated } from './gastos-mutation-reactions';
import { afterTemplateCreated, afterTemplateUpdated } from './templates-mutation-reactions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changes.mockReturnValue([]);
});

describe('derived mutation reactions', () => {
  it('updates sale forecast and optional profile invalidations', async () => {
    await afterVentaCreated('v1');
    await afterVentaUpdated('v1', null);
    await afterVentaUpdated('v1', { servicioId: 's1', shouldIncrement: true });
    await afterVentaDeleted('v1', { servicioId: 's1', shouldIncrement: false });
    expect(mocks.forecastVenta).toHaveBeenCalledTimes(4);
    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
    expect(mocks.safe).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      operation: 'deleteNotificacionesPorVenta', critical: true,
    }));
  });

  it('updates service forecasts and schedules notification cleanup on delete', async () => {
    await afterServicioCreated('s1');
    await afterServicioUpdated('s1');
    await afterServicioDeleted('s1');
    expect(mocks.forecastServicio).toHaveBeenCalledTimes(3);
    expect(mocks.safe).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      operation: 'deleteNotificacionesPorServicio', critical: true,
    }));
  });

  it('records expense create, conditional update and delete reactions', async () => {
    const expense = {
      id: 'g1', tipoGastoNombre: 'Hosting', monto: 12.5, fecha: new Date(2026, 0, 2),
    } as never;
    await afterGastoCreated(expense);
    await afterGastoUpdated({ gastoId: 'g1', gastoAnterior: expense, gastoActualizado: expense, shouldInvalidateDashboard: false });
    mocks.changes.mockReturnValue([{ campo: 'Monto' }]);
    await afterGastoUpdated({ gastoId: 'g1', gastoAnterior: expense, gastoActualizado: expense, shouldInvalidateDashboard: true });
    await afterGastoDeleted(expense);
    expect(mocks.dashboard).toHaveBeenCalledTimes(3);
    expect(mocks.record).toHaveBeenCalledTimes(4);
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ cambios: [{ campo: 'Monto' }] }));
  });

  it('records template create/update with snapshot and fallback paths', async () => {
    const template = { id: 't1', nombre: 'Renovación', tipo: 'renovacion', contenido: 'Hola' } as never;
    await afterTemplateCreated(template);
    mocks.changes.mockReturnValue([{ campo: 'Contenido' }]);
    await afterTemplateUpdated({ templateId: 't1', oldTemplate: template, updates: { contenido: 'Nuevo' } });
    mocks.changes.mockReturnValue([]);
    await afterTemplateUpdated({ templateId: 't2', updates: { contenido: 'Nuevo' } });
    expect(mocks.record).toHaveBeenCalledTimes(3);
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ cambios: [{ campo: 'Contenido' }] }));
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ entidadNombre: 't2' }));
  });
});
