import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Servicio } from '@/types/servicios';

const getServiciosMock = vi.fn();
const logCacheHitMock = vi.fn();
const countVentasActivasByServicioUseCaseMock = vi.fn();

vi.mock('@/lib/supabase/servicios-repository', () => ({
  ENTITIES: { SERVICIOS: 'servicios' },
  getServicios: getServiciosMock,
  logCacheHit: logCacheHitMock,
}));

vi.mock('@/lib/use-cases/ventas-use-cases', () => ({
  countVentasActivasByServicioUseCase: countVentasActivasByServicioUseCaseMock,
}));

vi.mock('@/lib/use-cases/servicios-use-cases', () => ({
  createServicioUseCase: vi.fn(),
  deleteServicioUseCase: vi.fn(),
  fetchServiciosCountsUseCase: vi.fn(),
  resyncServicioReferenciasUseCase: vi.fn(),
  updateServicioUseCase: vi.fn(),
}));

vi.mock('@/lib/commands/client-cache', () => ({
  syncServicioPronosticoLocal: vi.fn(),
}));

vi.mock('@/store/activityLogStore', () => ({
  useActivityLogStore: {
    getState: () => ({
      addLog: vi.fn(),
    }),
  },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      user: {
        id: 'admin-1',
        email: 'admin@test.com',
      },
    }),
  },
}));

const baseServicio: Servicio = {
  id: 'servicio-1',
  categoriaId: 'categoria-1',
  categoriaNombre: 'Streaming',
  nombre: 'Netflix',
  tipo: 'premium',
  correo: 'netflix@test.com',
  contrasena: 'secret',
  perfilesDisponibles: 4,
  perfilesOcupados: 2,
  costoServicio: 10,
  gastosTotal: 0,
  activo: true,
  renovacionAutomatica: false,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  createdBy: 'admin-1',
};

describe('useServiciosStore.updatePerfilOcupado', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useServiciosStore } = await import('./serviciosStore');
    useServiciosStore.setState({
      servicios: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      lastCountsFetch: null,
      selectedServicio: null,
      totalServicios: 0,
      serviciosActivos: 0,
      totalCategoriasActivas: 0,
    });
  });

  it('does nothing when the service is not loaded or selected', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { useServiciosStore } = await import('./serviciosStore');

    await useServiciosStore.getState().updatePerfilOcupado('servicio-archivado', false);

    expect(countVentasActivasByServicioUseCaseMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(useServiciosStore.getState().servicios).toEqual([]);

    consoleErrorSpy.mockRestore();
  });

  it('updates loaded service profile count from active sales count', async () => {
    countVentasActivasByServicioUseCaseMock.mockResolvedValueOnce(1);
    const { useServiciosStore } = await import('./serviciosStore');
    useServiciosStore.setState({
      servicios: [baseServicio],
      selectedServicio: baseServicio,
    });

    await useServiciosStore.getState().updatePerfilOcupado('servicio-1', false);

    expect(countVentasActivasByServicioUseCaseMock).toHaveBeenCalledWith('servicio-1');
    expect(useServiciosStore.getState().servicios[0].perfilesOcupados).toBe(1);
    expect(useServiciosStore.getState().selectedServicio?.perfilesOcupados).toBe(1);
  });
});
