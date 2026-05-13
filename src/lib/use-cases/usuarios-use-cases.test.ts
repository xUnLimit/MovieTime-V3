import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/usuarios-repository', () => ({
  countUsuarios: vi.fn(),
  createUsuario: vi.fn(),
  getUsuarioById: vi.fn(),
  removeUsuario: vi.fn(),
  updateUsuario: vi.fn(),
}));

vi.mock('@/lib/supabase/ventas-repository', () => ({
  queryVentas: vi.fn(),
}));

vi.mock('@/lib/services/dashboardStatsService', () => ({
  adjustUsuariosPorMes: vi.fn(() => Promise.resolve()),
  getDiaKeyFromDate: vi.fn(() => '2026-05-06'),
}));

vi.mock('@/lib/services/notificationSyncService', () => ({
  sincronizarNotificacionesForzado: vi.fn(),
}));

vi.mock('@/lib/utils/activityLogHelpers', () => ({
  detectarCambios: vi.fn(() => []),
}));

import { createUsuario, updateUsuario } from '@/lib/supabase/usuarios-repository';
import { queryVentas } from '@/lib/supabase/ventas-repository';
import { createUsuarioUseCase, updateUsuarioUseCase } from './usuarios-use-cases';

describe('usuarios use cases', () => {
  beforeEach(() => {
    vi.mocked(createUsuario).mockReset();
    vi.mocked(updateUsuario).mockReset();
    vi.mocked(queryVentas).mockReset();
  });

  it('does not send derived payment or counter fields when creating a user', async () => {
    vi.mocked(createUsuario).mockResolvedValue('usuario-1');

    await createUsuarioUseCase(
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

    expect(createUsuario).toHaveBeenCalledWith(
      expect.not.objectContaining({
        metodoPagoNombre: expect.anything(),
        moneda: expect.anything(),
        serviciosActivos: expect.anything(),
      })
    );
  });

  it('stores pending user payment method as null when creating a user', async () => {
    vi.mocked(createUsuario).mockResolvedValue('usuario-1');

    await createUsuarioUseCase(
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

    expect(createUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        metodoPagoId: null,
      })
    );
  });

  it('does not send derived payment or counter fields when updating a user', async () => {
    vi.mocked(updateUsuario).mockResolvedValue(undefined);
    vi.mocked(queryVentas).mockResolvedValue([]);

    await updateUsuarioUseCase(
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

    expect(updateUsuario).toHaveBeenCalledWith(
      'usuario-1',
      expect.not.objectContaining({
        metodoPagoNombre: expect.anything(),
        moneda: expect.anything(),
        serviciosActivos: expect.anything(),
      })
    );
  });

  it('stores pending user payment method as null when updating a user', async () => {
    vi.mocked(updateUsuario).mockResolvedValue(undefined);
    vi.mocked(queryVentas).mockResolvedValue([]);

    await updateUsuarioUseCase(
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

    expect(updateUsuario).toHaveBeenCalledWith(
      'usuario-1',
      expect.objectContaining({
        metodoPagoId: null,
      })
    );
  });
});
