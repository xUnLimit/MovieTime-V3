import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/supabase/terceros-repository', () => ({
  countTerceros: vi.fn(),
  createTercero: vi.fn(),
  getTerceroById: vi.fn(),
  removeTercero: vi.fn(),
  updateTercero: vi.fn(),
}));

vi.mock('@/platform/supabase/ventas-repository', () => ({
  queryVentas: vi.fn(),
}));

vi.mock('@/modules/dashboard-read-models', () => ({
  getDiaKeyFromDate: vi.fn(() => '2026-05-06'),
}));

vi.mock('@/modules/notifications', () => ({
  sincronizarNotificacionesForzado: vi.fn(),
}));

vi.mock('@/platform/utils/activityLogHelpers', () => ({
  detectarCambios: vi.fn(() => []),
}));

import { countTerceros, createTercero, getTerceroById, removeTercero, updateTercero } from '@/platform/supabase/terceros-repository';
import { queryVentas } from '@/platform/supabase/ventas-repository';
import { storeEventBus } from '@/platform/events/store-event-bus';
import type { Tercero } from '@/types';
import {
  createTerceroUseCase, deleteTerceroUseCase, fetchTercerosCountsUseCase,
  resolveTerceroForDelete, updateTerceroUseCase,
} from './terceros-use-cases';

const tercero: Tercero = {
  id: 'usuario-1', nombre: 'Ana', apellido: 'Perez', tipo: 'cliente',
  telefono: '+507 6000-0000', metodoPagoId: 'metodo-1', metodoPagoNombre: 'Yappy',
  active: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), createdBy: 'admin',
};

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

  it('consulta los cuatro conteos de terceros', async () => {
    vi.mocked(countTerceros).mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    await expect(fetchTercerosCountsUseCase()).resolves.toEqual({
      totalClientes: 1, totalRevendedores: 2, totalNuevosHoy: 3, totalTercerosActivos: 4,
    });
    expect(countTerceros).toHaveBeenCalledTimes(4);
  });

  it('prioriza datos locales al resolver la eliminacion', async () => {
    expect(await resolveTerceroForDelete(tercero.id, undefined, tercero)).toBe(tercero);
    expect(await resolveTerceroForDelete(tercero.id, { tipo: 'cliente', nombre: 'Local' }, tercero)).toMatchObject({ nombre: 'Local' });
    expect(getTerceroById).not.toHaveBeenCalled();
  });

  it('notifica cambios de nombre si existen ventas del cliente', async () => {
    vi.mocked(updateTercero).mockResolvedValue(undefined);
    vi.mocked(queryVentas).mockResolvedValue([{ id: 'venta-1' }]);
    const emit = vi.spyOn(storeEventBus, 'emit');
    const recordActivityLog = vi.fn();
    const result = await updateTerceroUseCase(tercero.id, { nombre: 'Nueva' }, {
      oldTercero: tercero, logContext: { usuarioId: 'admin', usuarioEmail: 'admin@example.test' }, recordActivityLog,
    });
    expect(result.shouldRefreshNotificaciones).toBe(true);
    expect(result.shouldDispatchTerceroNombreUpdated).toBe(true);
    expect(emit).toHaveBeenCalledWith({ type: 'NOTIFICACIONES_INVALIDATED', entity: 'venta' });
    expect(emit).toHaveBeenCalledWith({ type: 'TERCERO_NOMBRE_UPDATED', terceroId: tercero.id });
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({ entidad: 'cliente' }));
    emit.mockRestore();
  });

  it('no notifica por actualizaciones que no alteran identidad', async () => {
    vi.mocked(updateTercero).mockResolvedValue(undefined);
    const result = await updateTerceroUseCase(tercero.id, { notas: 'actualizada' }, {
      oldTercero: tercero, logContext: { usuarioId: 'admin', usuarioEmail: 'admin@example.test' },
    });
    expect(result.shouldRefreshNotificaciones).toBe(false);
    expect(result.shouldDispatchTerceroNombreUpdated).toBe(false);
    expect(queryVentas).not.toHaveBeenCalled();
  });

  it('emite el evento de eliminacion despues de borrar', async () => {
    const emit = vi.spyOn(storeEventBus, 'emit');
    const recordActivityLog = vi.fn();
    await deleteTerceroUseCase(tercero.id, tercero, {
      logContext: { usuarioId: 'admin', usuarioEmail: 'admin@example.test' }, recordActivityLog,
    });
    expect(removeTercero).toHaveBeenCalledWith(tercero.id);
    expect(emit).toHaveBeenCalledWith({ type: 'TERCERO_DELETED', terceroId: tercero.id });
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({ entidad: 'cliente' }));
    emit.mockRestore();
  });
});
