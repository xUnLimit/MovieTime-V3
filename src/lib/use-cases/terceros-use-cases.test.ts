import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/terceros-repository', () => ({
  countTerceros: vi.fn(),
  createTercero: vi.fn(),
  getTerceroById: vi.fn(),
  removeTercero: vi.fn(),
  updateTercero: vi.fn(),
}));

vi.mock('@/lib/supabase/ventas-repository', () => ({
  queryVentas: vi.fn(),
}));

vi.mock('@/lib/services/dashboardStatsService', () => ({
  getDiaKeyFromDate: vi.fn(() => '2026-05-06'),
}));

vi.mock('@/lib/services/notificationSyncService', () => ({
  sincronizarNotificacionesForzado: vi.fn(),
}));

vi.mock('@/lib/utils/activityLogHelpers', () => ({
  detectarCambios: vi.fn(() => []),
}));

import { createTercero, getTerceroById, updateTercero } from '@/lib/supabase/terceros-repository';
import { queryVentas } from '@/lib/supabase/ventas-repository';
import { createTerceroUseCase, resolveTerceroForDelete, updateTerceroUseCase } from './terceros-use-cases';

describe('terceros use cases', () => {
  beforeEach(() => {
    vi.mocked(createTercero).mockReset();
    vi.mocked(getTerceroById).mockReset();
    vi.mocked(updateTercero).mockReset();
    vi.mocked(queryVentas).mockReset();
  });

  it('does not send derived payment or counter fields when creating a user', async () => {
    vi.mocked(createTercero).mockResolvedValue('usuario-1');

    await createTerceroUseCase(
      {
        nombre: 'Juan',
        apellido: 'Perez',
        tipo: 'cliente',
        telefono: '+507 6000-0000',
        metodoPagoId: 'metodo-1',
        metodoPagoNombre: 'Yappy',
        moneda: 'USD',
        notas: '',
        active: true,
        createdBy: 'current-user',
      },
      {
        logContext: {
          usuarioId: 'user-1',
          usuarioEmail: 'user@example.com',
        },
      }
    );

    expect(createTercero).toHaveBeenCalledWith(
      expect.not.objectContaining({
        metodoPagoNombre: expect.anything(),
        moneda: expect.anything(),
        serviciosActivos: expect.anything(),
      })
    );
  });

  it('stores pending user payment method as null when creating a user', async () => {
    vi.mocked(createTercero).mockResolvedValue('usuario-1');

    await createTerceroUseCase(
      {
        nombre: 'Ana',
        apellido: 'Perez',
        tipo: 'cliente',
        telefono: '+507 6000-0000',
        metodoPagoId: 'pendiente',
        metodoPagoNombre: 'Pendiente',
        moneda: 'USD',
        notas: '',
        active: true,
        createdBy: 'current-user',
      },
      {
        logContext: {
          usuarioId: 'user-1',
          usuarioEmail: 'user@example.com',
        },
      }
    );

    expect(createTercero).toHaveBeenCalledWith(
      expect.objectContaining({
        metodoPagoId: null,
      })
    );
  });

  it('does not send derived payment or counter fields when updating a user', async () => {
    vi.mocked(updateTercero).mockResolvedValue(undefined);
    vi.mocked(queryVentas).mockResolvedValue([]);

    await updateTerceroUseCase(
      'usuario-1',
      {
        nombre: 'Juan',
        metodoPagoId: 'metodo-2',
        metodoPagoNombre: 'Banco',
        moneda: 'PAB',
        serviciosActivos: 3,
      },
      {
        logContext: {
          usuarioId: 'user-1',
          usuarioEmail: 'user@example.com',
        },
      }
    );

    expect(updateTercero).toHaveBeenCalledWith(
      'usuario-1',
      expect.not.objectContaining({
        metodoPagoNombre: expect.anything(),
        moneda: expect.anything(),
        serviciosActivos: expect.anything(),
      })
    );
  });

  it('stores pending user payment method as null when updating a user', async () => {
    vi.mocked(updateTercero).mockResolvedValue(undefined);
    vi.mocked(queryVentas).mockResolvedValue([]);

    await updateTerceroUseCase(
      'usuario-1',
      {
        metodoPagoId: 'pendiente',
        metodoPagoNombre: 'Pendiente',
        moneda: 'USD',
      },
      {
        logContext: {
          usuarioId: 'user-1',
          usuarioEmail: 'user@example.com',
        },
      }
    );

    expect(updateTercero).toHaveBeenCalledWith(
      'usuario-1',
      expect.objectContaining({
        metodoPagoId: null,
      })
    );
  });

  it('throws a typed not found error when resolving a missing tercero for deletion', async () => {
    vi.mocked(getTerceroById).mockResolvedValue(null);

    await expect(resolveTerceroForDelete('tercero-missing')).rejects.toMatchObject({
      name: 'NotFoundError',
      code: 'NOT_FOUND',
      message: 'Tercero no encontrado',
    });
  });
});
