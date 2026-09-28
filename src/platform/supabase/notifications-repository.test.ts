import { beforeEach, describe, expect, it, vi } from 'vitest';

const aggregateRpcMock = vi.hoisted(() => vi.fn());
const updateEqMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn(() => ({ eq: updateEqMock })));
const fromMock = vi.hoisted(() => vi.fn<(table: string) => unknown>(() => ({ update: updateMock })));
const coreMocks = vi.hoisted(() => ({ getById: vi.fn(), getCount: vi.fn(), remove: vi.fn() }));

vi.mock('./client', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('./notifications-rpc-adapter', () => ({
  upsertNotificationAggregateRpc: aggregateRpcMock,
}));

vi.mock('./record-core', () => ({
  getById: coreMocks.getById,
  getCount: coreMocks.getCount,
  remove: coreMocks.remove,
  logCacheHit: vi.fn(),
}));

import {
  countNotificaciones,
  createNotificacion,
  createNotification,
  getNotificacionById,
  queryNotificaciones,
  queryNotifications,
  removeNotificacion,
  updateNotificacion,
  updateNotification,
} from './notifications-repository';

function readQuery(result: { data: unknown[] | null; error: Error | null }) {
  const chain = {
    select: vi.fn(), eq: vi.fn(), neq: vi.fn(), lt: vi.fn(), lte: vi.fn(),
    gt: vi.fn(), gte: vi.fn(), in: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };
  for (const method of ['select', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in'] as const) {
    chain[method].mockReturnValue(chain);
  }
  return chain;
}

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
    fromMock.mockReset().mockImplementation(() => ({ update: updateMock }));
    aggregateRpcMock.mockResolvedValue('notification-1');
    updateEqMock.mockResolvedValue({ error: null });
  });

  it('delegates public facade operations', async () => {
    coreMocks.getById.mockResolvedValue({ id: 'n1' });
    coreMocks.getCount.mockResolvedValue(3);
    coreMocks.remove.mockResolvedValue(undefined);
    fromMock
      .mockReturnValueOnce(readQuery({ data: [], error: null }))
      .mockReturnValueOnce(readQuery({ data: [], error: null }))
      .mockReturnValueOnce(readQuery({ data: [], error: null }));
    expect(await getNotificacionById('n1')).toEqual({ id: 'n1' });
    expect(await queryNotificaciones()).toEqual([]);
    expect(await countNotificaciones()).toBe(3);
    expect(await createNotificacion(ventaPayload)).toBe('notification-1');
    await updateNotificacion('n1', { leida: true });
    await removeNotificacion('n1');
    expect(coreMocks.remove).toHaveBeenCalledWith('notificaciones', 'n1');
  });

  it('queries all notification views, applies all filters and maps entity details', async () => {
    const venta = readQuery({ data: [{
      entidad: 'venta', id: 'v', created_at: '2026-03-01T00:00:00Z',
      cliente_nombre_snapshot: 'Ana', servicio_nombre_snapshot: 'Netflix',
    }], error: null });
    const servicio = readQuery({ data: [{
      entidad: 'servicio', id: 's', created_at: '2026-02-01T00:00:00Z',
      servicio_nombre_snapshot: 'Max', renovacion_automatica_snapshot: true,
    }], error: null });
    const reposo = readQuery({ data: [{
      entidad: 'reposo', id: 'r', created_at: '2026-01-01T00:00:00Z',
      servicio_nombre_snapshot: 'Prime', dias_reposo_snapshot: 5,
    }], error: null });
    fromMock.mockReturnValueOnce(venta).mockReturnValueOnce(servicio).mockReturnValueOnce(reposo);
    const filters = ['==', '!=', '<', '<=', '>', '>=', 'in'].map((operator) => ({
      field: 'diasRestantes',
      operator: operator as '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in',
      value: operator === 'in' ? [1, 2] : 2,
    }));
    const rows = await queryNotifications<Record<string, unknown>>(filters);
    expect(rows.map((row) => row.id)).toEqual(['v', 's', 'r']);
    expect(rows[0]).toEqual(expect.objectContaining({ clienteNombre: 'Ana', estado: 'activo' }));
    expect(rows[1]).toEqual(expect.objectContaining({ servicioNombre: 'Max', renovacionAutomatica: true }));
    expect(rows[2]).toEqual(expect.objectContaining({ servicioNombre: 'Prime', diasReposo: 5 }));
    for (const method of ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in'] as const) {
      expect(venta[method]).toHaveBeenCalled();
    }
  });

  it('filters to a single entity view and propagates query errors', async () => {
    const one = readQuery({ data: null, error: null });
    fromMock.mockReturnValueOnce(one);
    expect(await queryNotifications([{ field: 'entidad', operator: '==', value: 'venta' }])).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);
    fromMock.mockReturnValueOnce(readQuery({ data: null, error: new Error('vista') }));
    await expect(queryNotifications([{ field: 'entidad', operator: '==', value: 'venta' }]))
      .rejects.toThrow('vista');
  });

  it('validates unsupported, missing and malformed detail values', async () => {
    await expect(createNotification({ entidad: 'otro' })).rejects.toThrow('no soportada');
    await expect(createNotification({ entidad: 'venta' })).rejects.toThrow('ventaId es requerido');
    await expect(createNotification({ entidad: 'servicio', servicioId: '  ' })).rejects.toThrow('servicioId es requerido');
    await expect(createNotification({ entidad: 'reposo', servicioId: 's1', diasReposo: Number.NaN }))
      .rejects.toThrow('valor numerico invalido');
    await expect(createNotification({ entidad: 'servicio', servicioId: 's1', renovacionAutomatica: 'si' }))
      .rejects.toThrow('valor booleano invalido');
  });

  it('normalizes nullable detail fields and defaults in the base payload', async () => {
    await createNotification({
      entidad: 'venta', ventaId: ' v1 ', mensaje: 123, diasRestantes: '4',
      clienteNombre: null, clienteTelefono: ' ', precioFinal: '', metodoPago: 'Efectivo',
    });
    expect(aggregateRpcMock).toHaveBeenCalledWith(expect.objectContaining({
      p_base: expect.objectContaining({
        entidad: 'venta', tipo: 'sistema', prioridad: 'media', titulo: '', mensaje: '123', dias_restantes: 4,
      }),
      p_detail: expect.objectContaining({
        venta_id: 'v1', cliente_nombre_snapshot: '', cliente_telefono_snapshot: null,
        precio_final_snapshot: null, metodo_pago_nombre_snapshot: 'Efectivo',
      }),
    }));
  });

  it('supports a no-op base update and propagates update failures', async () => {
    await updateNotification('n1', {});
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ updated_at: expect.any(String) }));
    updateEqMock.mockResolvedValueOnce({ error: { message: 'actualizar' } });
    await expect(updateNotification('n1', { titulo: 'X' })).rejects.toThrow('actualizar');
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

  it('stores a promised payment as a date-only base update', async () => {
    await updateNotification('notification-1', {
      fechaPrometidaPago: new Date(2026, 7, 24),
      leida: true,
    });

    expect(aggregateRpcMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fecha_prometida_pago: '2026-08-24',
        leida: true,
      }),
    );
  });
});
