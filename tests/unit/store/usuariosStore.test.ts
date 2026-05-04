import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMock = vi.fn();
const queryDocumentsMock = vi.fn();
const getAllMock = vi.fn();
const getCountMock = vi.fn();
const getByIdMock = vi.fn();
const createDocMock = vi.fn();
const removeMock = vi.fn();
const logCacheHitMock = vi.fn();
const sincronizarNotificacionesForzadoMock = vi.fn();
const fetchNotificacionesMock = vi.fn();
const addLogMock = vi.fn();

vi.mock('@/lib/firebase/firestore', () => ({
  getAll: getAllMock,
  getCount: getCountMock,
  getById: getByIdMock,
  create: createDocMock,
  update: updateMock,
  remove: removeMock,
  queryDocuments: queryDocumentsMock,
  logCacheHit: logCacheHitMock,
  COLLECTIONS: {
    USUARIOS: 'usuarios',
    VENTAS: 'ventas',
    PAGOS_VENTA: 'pagosVenta',
  },
}));

vi.mock('@/lib/services/dashboardStatsService', () => ({
  adjustUsuariosPorMes: vi.fn(),
  getDiaKeyFromDate: vi.fn(() => '2026-04-09'),
}));

vi.mock('@/lib/services/notificationSyncService', () => ({
  sincronizarNotificacionesForzado: sincronizarNotificacionesForzadoMock,
}));

vi.mock('@/store/activityLogStore', () => ({
  useActivityLogStore: {
    getState: () => ({
      addLog: addLogMock,
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

vi.mock('@/lib/utils/activityLogHelpers', () => ({
  detectarCambios: vi.fn(() => []),
}));

vi.mock('@/store/notificacionesStore', () => ({
  useNotificacionesStore: {
    getState: () => ({
      fetchNotificaciones: fetchNotificacionesMock,
    }),
  },
}));

describe('useUsuariosStore.updateUsuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    queryDocumentsMock.mockResolvedValue([]);
    updateMock.mockResolvedValue(undefined);
    sincronizarNotificacionesForzadoMock.mockResolvedValue(undefined);
    fetchNotificacionesMock.mockResolvedValue(undefined);
    addLogMock.mockResolvedValue(undefined);
  });

  it('espera la sincronizacion de ventas y notificaciones cuando cambia el telefono', async () => {
    const { useUsuariosStore } = await import('@/store/usuariosStore');

    useUsuariosStore.setState({
      usuarios: [
        {
          id: 'cliente-1',
          nombre: 'Ana',
          apellido: 'Perez',
          tipo: 'cliente',
          telefono: '+507 6000-0000',
          metodoPagoId: 'metodo-1',
          metodoPagoNombre: 'Yappy',
          moneda: 'USD',
          active: true,
          createdBy: 'admin-1',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
          serviciosActivos: 1,
          suscripcionesTotales: 0,
        },
      ],
      totalClientes: 1,
      totalRevendedores: 0,
      totalNuevosHoy: 0,
      totalUsuariosActivos: 1,
      isLoading: false,
      error: null,
      lastFetch: null,
      lastCountsFetch: null,
      selectedUsuario: null,
    });

    queryDocumentsMock
      .mockResolvedValueOnce([{ id: 'venta-1' }])
      .mockResolvedValueOnce([]);

    await useUsuariosStore.getState().updateUsuario('cliente-1', {
      telefono: '+507 6999-1111',
    });

    expect(updateMock).toHaveBeenCalledWith('usuarios', 'cliente-1', {
      telefono: '+507 6999-1111',
    });
    expect(updateMock).toHaveBeenCalledWith('ventas', 'venta-1', {
      clienteTelefono: '+507 6999-1111',
    });
    expect(sincronizarNotificacionesForzadoMock).toHaveBeenCalledTimes(1);
    expect(fetchNotificacionesMock).toHaveBeenCalledWith(true);
  });
});
