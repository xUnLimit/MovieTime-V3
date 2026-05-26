import { beforeEach, describe, expect, it, vi } from 'vitest';

const workflowReactions = vi.hoisted(() => ({
  activateReposoServicioStoreWorkflow: vi.fn(),
  deleteNotificationStoreItem: vi.fn(),
  deleteReposoServicioStoreWorkflow: vi.fn(),
}));

const domainReadAdapters = vi.hoisted(() => ({
  queryNotificationIdsRead: vi.fn(),
}));

const servicioPayments = vi.hoisted(() => ({
  renewServicioUseCase: vi.fn(),
}));

vi.mock('@/lib/store-reactions/notificaciones-workflow-reactions', () => workflowReactions);
vi.mock('@/lib/supabase/domain-read-adapters', () => domainReadAdapters);
vi.mock('@/lib/use-cases/servicios/servicios-payment-use-cases', () => servicioPayments);

import {
  activateAndRenewReposoServicioUseCase,
  activateReposoServicioUseCase,
  clearReposoNotificationsUseCase,
  deleteReposoServicioUseCase,
  getReposoDependenciesInvalidationOutcome,
} from './notificaciones-reposo-use-cases';
import type { Servicio } from '@/types/servicios';

const servicio = {
  id: 'servicio-1',
  nombre: 'Netflix',
  activo: false,
  enReposo: true,
  renovaciones: 2,
} as Servicio;

describe('notificaciones reposo use-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    domainReadAdapters.queryNotificationIdsRead.mockResolvedValue([
      { id: 'notif-1' },
      { id: 'notif-2' },
    ]);
  });

  it('clears reposo notifications and returns a notification invalidation outcome', async () => {
    const outcome = await clearReposoNotificationsUseCase('servicio-1');

    expect(outcome).toEqual({
      type: 'reposoNotificationsCleared',
      servicioId: 'servicio-1',
      deletedNotificationIds: ['notif-1', 'notif-2'],
      notificationInvalidationNeeded: true,
    });
    expect(workflowReactions.deleteNotificationStoreItem).toHaveBeenCalledWith('notif-1');
    expect(workflowReactions.deleteNotificationStoreItem).toHaveBeenCalledWith('notif-2');
  });

  it('describes reposo dependency invalidations without receiving a QueryClient', () => {
    expect(getReposoDependenciesInvalidationOutcome()).toEqual({
      type: 'reposoDependenciesInvalidationNeeded',
      queryTargets: ['categorias', 'servicios'],
    });
  });

  it('activates a reposo servicio and returns UI/cache outcome', async () => {
    const outcome = await activateReposoServicioUseCase({ servicio });

    expect(outcome).toEqual({
      type: 'reposoActivated',
      servicioId: 'servicio-1',
      servicioNombre: 'Netflix',
      queryTargets: ['categorias', 'servicios', 'notificaciones'],
    });
    expect(workflowReactions.activateReposoServicioStoreWorkflow).toHaveBeenCalledWith(
      'servicio-1',
      expect.objectContaining({
        activo: true,
        enReposo: false,
        diasReposo: undefined,
        fechaInicioReposo: undefined,
        fechaFinReposo: undefined,
      }),
    );
  });

  it('activates and renews a reposo servicio through the payment use-case', async () => {
    const pagoData = {
      costo: 20,
      fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
      fechaVencimiento: new Date('2026-06-01T00:00:00.000Z'),
      metodoPagoId: 'metodo-1',
      metodoPagoNombre: 'Tarjeta',
      moneda: 'USD',
      notas: ' Renovacion ',
      periodoRenovacion: 'mensual',
    };

    const outcome = await activateAndRenewReposoServicioUseCase({
      pagoData,
      servicio,
    });

    expect(outcome).toEqual({
      type: 'reposoActivatedAndRenewed',
      servicioId: 'servicio-1',
      servicioNombre: 'Netflix',
      queryTargets: ['categorias', 'servicios', 'notificaciones'],
    });
    expect(servicioPayments.renewServicioUseCase).toHaveBeenCalledWith(
      servicio,
      expect.objectContaining({ notas: 'Renovacion' }),
      { numeroRenovacion: 3 },
    );
  });

  it('deletes a reposo servicio and reports whether payments were deleted', async () => {
    const outcome = await deleteReposoServicioUseCase({
      deletePayments: true,
      servicio,
    });

    expect(outcome).toEqual({
      type: 'reposoServicioDeleted',
      servicioId: 'servicio-1',
      servicioNombre: 'Netflix',
      deletedPayments: true,
      queryTargets: ['categorias', 'servicios', 'notificaciones'],
    });
    expect(workflowReactions.deleteReposoServicioStoreWorkflow).toHaveBeenCalledWith('servicio-1', true);
  });
});
