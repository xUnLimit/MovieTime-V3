import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ notices: vi.fn(), respuestas: vi.fn(), post: vi.fn(), session: vi.fn() }));
vi.mock('@/platform/supabase/whatsapp-notices-repository', () => ({
  listVentaNoticeStatusRows: mocks.notices,
  listVentaRespuestaRows: mocks.respuestas,
}));
vi.mock('@/platform/api/whatsapp-notices-client', () => ({ postWhatsAppNotices: mocks.post }));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: mocks.session }));

import {
  getVentaNoticeStatusUseCase, isNoticeDelivered, mapNoticeBadge, notifyCustomerUseCase, sendWhatsAppNoticesUseCase,
} from './whatsapp-notices-use-cases';

describe('mapNoticeBadge', () => {
  it.each([
    ['accepted', 'read', 'read'],
    ['accepted', 'delivered', 'delivered'],
    ['accepted', 'sent', 'sent'],
    ['accepted', null, 'sent'],
    ['accepted', 'failed', 'failed'],
    ['failed', null, 'failed'],
    ['pending', null, 'pending'],
    ['uncertain', null, 'pending'],
  ] as const)('%s + %s -> %s', (notice, delivery, expected) => {
    expect(mapNoticeBadge(notice, delivery)).toBe(expected);
  });

  it('has no badge without notice', () => {
    expect(mapNoticeBadge(null, null)).toBeNull();
    expect(mapNoticeBadge('skipped', null)).toBeNull();
  });
});

describe('getVentaNoticeStatusUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges the latest notice with the no_continuar answer per venta', async () => {
    mocks.notices.mockResolvedValue([
      { venta_id: 'v1', notice_id: 'n1', tipo: 'dia_pago', origin: 'manual', notice_status: 'accepted', delivery_status: 'read', created_at: '2026-09-28T10:00:00Z' },
    ]);
    mocks.respuestas.mockResolvedValue([
      { id: 'v1', respuesta_cliente: 'no_continuar', respuesta_cliente_at: '2026-09-28T11:00:00Z' },
      { id: 'v2', respuesta_cliente: 'no_continuar', respuesta_cliente_at: null },
      { id: 'v3', respuesta_cliente: null, respuesta_cliente_at: null },
    ]);
    const states = await getVentaNoticeStatusUseCase(['v1', 'v2', 'v3']);
    expect(states.v1).toMatchObject({ badge: 'read', noContinuar: true, noticeId: 'n1' });
    expect(states.v2).toMatchObject({ badge: null, noContinuar: true });
    expect(states.v3).toBeUndefined();
  });
});

describe('sendWhatsAppNoticesUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a session', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(sendWhatsAppNoticesUseCase({ tipo: 'dia_pago', ventaIds: ['v'] })).rejects.toThrow('sesión');
  });

  it('sends with the access token and unwraps results', async () => {
    mocks.session.mockResolvedValue({ access_token: 'tok' });
    mocks.post.mockResolvedValue({ results: [{ status: 'accepted' }] });
    await expect(sendWhatsAppNoticesUseCase({ tipo: 'dia_pago', ventaIds: ['v'] })).resolves.toEqual([{ status: 'accepted' }]);
    expect(mocks.post).toHaveBeenCalledWith('tok', { tipo: 'dia_pago', ventaIds: ['v'] });
  });

  it('treats accepted and already_sent as delivered', () => {
    expect(isNoticeDelivered('accepted')).toBe(true);
    expect(isNoticeDelivered('already_sent')).toBe(true);
    expect(isNoticeDelivered('failed')).toBe(false);
    expect(isNoticeDelivered('wa_me')).toBe(false);
  });
});

describe('notifyCustomerUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a session', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(notifyCustomerUseCase({ tipo: 'renovacion', ventaIds: ['v1'] })).rejects.toThrow('sesión');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('asks the server for an automatic notice with the event id and reports it as sent', async () => {
    mocks.session.mockResolvedValue({ access_token: 'tok' });
    mocks.post.mockResolvedValueOnce({ results: [{ status: 'accepted', ventaIds: ['v1', 'v2'] }] });
    await expect(notifyCustomerUseCase({ tipo: 'actualizacion_credenciales', ventaIds: ['v1', 'v2'], eventId: 'e1' }))
      .resolves.toEqual({ status: 'sent', deliveredVentaIds: ['v1', 'v2'] });
    expect(mocks.post).toHaveBeenCalledWith('tok', { tipo: 'actualizacion_credenciales', ventaIds: ['v1', 'v2'], eventId: 'e1', automatic: true });

    mocks.post.mockResolvedValueOnce({ results: [{ status: 'already_sent', ventaIds: ['v1'] }] });
    await expect(notifyCustomerUseCase({ tipo: 'renovacion', ventaIds: ['v1'] })).resolves.toEqual({ status: 'sent', deliveredVentaIds: ['v1'] });
  });

  it('reports not_sent with the ventas that did get the notice', async () => {
    mocks.session.mockResolvedValue({ access_token: 'tok' });
    mocks.post.mockResolvedValueOnce({ results: [
      { status: 'accepted', ventaIds: ['v1'] }, { status: 'wa_me', ventaIds: ['v2'] }, { status: 'skipped', ventaIds: ['v3'] },
    ] });
    await expect(notifyCustomerUseCase({ tipo: 'suscripcion', ventaIds: ['v1', 'v2', 'v3'] }))
      .resolves.toEqual({ status: 'not_sent', deliveredVentaIds: ['v1'] });
    mocks.post.mockResolvedValueOnce({ results: [{ status: 'failed', ventaIds: ['v1'] }] });
    await expect(notifyCustomerUseCase({ tipo: 'transferencia_servicio', ventaIds: ['v1'] }))
      .resolves.toEqual({ status: 'not_sent', deliveredVentaIds: [] });
  });

  it('tells the caller when the automatic switch is off', async () => {
    mocks.session.mockResolvedValue({ access_token: 'tok' });
    mocks.post.mockResolvedValue({ results: [], skipped: 'auto_disabled' });
    await expect(notifyCustomerUseCase({ tipo: 'dia_pago', ventaIds: ['v1'] })).resolves.toEqual({ status: 'auto_disabled', deliveredVentaIds: [] });
  });
});
