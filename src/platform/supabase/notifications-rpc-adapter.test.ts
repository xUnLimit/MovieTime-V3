import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const assertOnlineMutationMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock('@/modules/pwa/offline-copy', () => ({
  assertOnlineMutation: assertOnlineMutationMock,
}));

import {
  upsertNotificationAggregateRpc,
  type NotificationAggregateRpcPayload,
} from './notifications-rpc-adapter';

const payload: NotificationAggregateRpcPayload = {
  p_base: {
    id: 'notification-1',
    dedupe_key: 'venta:venta-1',
    entidad: 'venta',
    tipo: 'sistema',
    prioridad: 'alta',
    titulo: 'Venta por vencer',
    mensaje: null,
    dias_restantes: 2,
    scheduled_for: '2026-08-25',
    leida: false,
    resaltada: false,
  },
  p_detail: {
    venta_id: 'venta-1',
    cliente_nombre_snapshot: 'Cliente',
    servicio_nombre_snapshot: 'Servicio',
  },
  p_preserve_existing_state: true,
};

describe('upsertNotificationAggregateRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the complete aggregate in one RPC and returns the authoritative id', async () => {
    rpcMock.mockResolvedValue({ data: 'notification-existing', error: null });

    await expect(upsertNotificationAggregateRpc(payload)).resolves.toBe('notification-existing');

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('upsert_notification_aggregate', payload);
  });

  it('preserves structured PostgreSQL diagnostics in the thrown error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'insert violates foreign key',
        code: '23503',
        details: 'Key is not present',
        hint: 'Verify source entity',
      },
    });

    await expect(upsertNotificationAggregateRpc(payload)).rejects.toMatchObject({
      message: expect.stringContaining('insert violates foreign key'),
      code: '23503',
      details: 'Key is not present',
      hint: 'Verify source entity',
    });
  });

  it('rejects an invalid RPC response id', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(upsertNotificationAggregateRpc(payload)).rejects.toThrow(
      'upsert_notification_aggregate no retorno un id valido',
    );
  });
});
