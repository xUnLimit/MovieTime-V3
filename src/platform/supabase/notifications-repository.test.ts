import { beforeEach, describe, expect, it, vi } from 'vitest';

const aggregateRpcMock = vi.hoisted(() => vi.fn());
const updateEqMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn(() => ({ eq: updateEqMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ update: updateMock })));

vi.mock('./client', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('./notifications-rpc-adapter', () => ({
  upsertNotificationAggregateRpc: aggregateRpcMock,
}));

vi.mock('@/modules/pwa/offline-copy', () => ({
  assertOnlineMutation: vi.fn(),
  readOfflineCollection: vi.fn(),
  shouldUseOfflineRead: vi.fn().mockResolvedValue(false),
}));

vi.mock('./record-core', () => ({
  getById: vi.fn(),
  getCount: vi.fn(),
  remove: vi.fn(),
  logCacheHit: vi.fn(),
}));

import { createNotification, updateNotification } from './notifications-repository';

const ventaPayload = {
  entidad: 'venta',
  tipo: 'sistema',
  prioridad: 'alta',
  titulo: 'Venta por vencer',
  diasRestantes: 2,
  leida: false,
  resaltada: false,
  ventaId: 'venta-1',
  clienteId: 'cliente-1',
  servicioId: 'servicio-1',
  categoriaId: 'categoria-1',
  clienteNombre: 'Cliente Uno',
  servicioNombre: 'Netflix',
  fechaFin: new Date(2026, 7, 25),
};

describe('notifications repository aggregate writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aggregateRpcMock.mockResolvedValue('notification-1');
    updateEqMock.mockResolvedValue({ error: null });
  });

  it('creates a venta base and detail with one atomic RPC call', async () => {
    await expect(createNotification(ventaPayload)).resolves.toBe('notification-1');

    expect(aggregateRpcMock).toHaveBeenCalledTimes(1);
    expect(aggregateRpcMock).toHaveBeenCalledWith({
      p_base: expect.objectContaining({
        dedupe_key: 'venta:venta-1',
        entidad: 'venta',
        scheduled_for: '2026-08-25',
      }),
      p_detail: expect.objectContaining({
        venta_id: 'venta-1',
        cliente_id: 'cliente-1',
        servicio_id: 'servicio-1',
        cliente_nombre_snapshot: 'Cliente Uno',
        servicio_nombre_snapshot: 'Netflix',
      }),
      p_preserve_existing_state: true,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('maps a servicio base and detail into the same atomic RPC', async () => {
    await createNotification({
      entidad: 'servicio',
      tipo: 'sistema',
      prioridad: 'media',
      titulo: 'Servicio por vencer',
      diasRestantes: 5,
      servicioId: 'servicio-2',
      categoriaId: 'categoria-2',
      servicioNombre: 'Disney+',
      correo: 'cuenta@example.com',
      contrasena: 'secreto',
      fechaVencimiento: new Date(2026, 8, 1),
      costoServicio: 12.5,
      renovacionAutomatica: true,
    });

    expect(aggregateRpcMock).toHaveBeenCalledWith({
      p_base: expect.objectContaining({
        dedupe_key: 'servicio:servicio-2',
        entidad: 'servicio',
        scheduled_for: '2026-09-01',
      }),
      p_detail: expect.objectContaining({
        servicio_id: 'servicio-2',
        categoria_id: 'categoria-2',
        servicio_nombre_snapshot: 'Disney+',
        servicio_correo_snapshot: 'cuenta@example.com',
        costo_servicio_snapshot: 12.5,
        renovacion_automatica_snapshot: true,
      }),
      p_preserve_existing_state: true,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('maps a reposo base and detail into the same atomic RPC', async () => {
    await createNotification({
      entidad: 'reposo',
      tipo: 'sistema',
      prioridad: 'baja',
      titulo: 'Reposo completado',
      servicioId: 'servicio-3',
      categoriaId: 'categoria-3',
      servicioNombre: 'HBO',
      diasReposo: 7,
      fechaInicioReposo: new Date(2026, 7, 15),
      fechaFinReposo: new Date(2026, 7, 22),
    });

    expect(aggregateRpcMock).toHaveBeenCalledWith({
      p_base: expect.objectContaining({
        dedupe_key: 'reposo:servicio-3',
        entidad: 'reposo',
        scheduled_for: '2026-08-22',
      }),
      p_detail: expect.objectContaining({
        servicio_id: 'servicio-3',
        categoria_id: 'categoria-3',
        servicio_nombre_snapshot: 'HBO',
        dias_reposo_snapshot: 7,
        fecha_inicio_reposo_snapshot: '2026-08-15',
        fecha_fin_reposo_snapshot: '2026-08-22',
      }),
      p_preserve_existing_state: true,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('updates a complete aggregate atomically while preserving user-managed state', async () => {
    await updateNotification('notification-1', {
      ...ventaPayload,
      leida: true,
      resaltada: true,
    });

    expect(aggregateRpcMock).toHaveBeenCalledWith({
      p_base: expect.objectContaining({
        id: 'notification-1',
        dedupe_key: 'venta:venta-1',
        leida: false,
        resaltada: false,
      }),
      p_detail: expect.objectContaining({ venta_id: 'venta-1' }),
      p_preserve_existing_state: true,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('keeps read/highlight-only changes on the base table', async () => {
    await updateNotification('notification-1', { leida: true, resaltada: true });

    expect(aggregateRpcMock).not.toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith('notificaciones');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ leida: true, resaltada: true }),
    );
    expect(updateEqMock).toHaveBeenCalledWith('id', 'notification-1');
  });
});
