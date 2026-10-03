import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@/platform/server/api-errors';

const requireAuthenticatedAdmin = vi.hoisted(() => vi.fn());
const sendNotice = vi.hoisted(() => vi.fn());
const sendOutboundMessage = vi.hoisted(() => vi.fn());
const sendCloudApiMessage = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => ({ whatsappAccessToken: '', whatsappPhoneNumberId: '' }));
const autoConfig = vi.hoisted(() => vi.fn());
vi.mock('@/platform/config', () => ({ env }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin }));
vi.mock('@/application/use-cases/send-notice-use-case', () => ({ sendNotice }));
vi.mock('@/modules/messaging/notice-store', () => ({ createNoticeStore: () => ({}) }));
vi.mock('@/modules/messaging/auto-notice-store', () => ({ createAutoNoticeStore: () => ({ config: autoConfig }) }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => ({}) }));
vi.mock('@/modules/whatsapp/template-catalog', () => ({ createTemplateCatalog: () => ({}) }));
vi.mock('@/modules/whatsapp/outbound-messages', () => ({ sendOutboundMessage }));
vi.mock('@/modules/whatsapp/cloud-api-client', () => ({ sendCloudApiMessage }));

import type { SendNoticeDeps } from '@/application/use-cases/send-notice-use-case';
import { POST } from './route';
const ID = '11111111-1111-4111-8111-111111111111';
function post(body: unknown, size = false) {
  return new Request('https://example.com/api/whatsapp/notices', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer session', ...(size ? { 'content-length': '17000' } : {}) },
    body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  env.whatsappAccessToken = 'configured'; env.whatsappPhoneNumberId = '123';
  requireAuthenticatedAdmin.mockResolvedValue({ user: { id: ID } });
  autoConfig.mockResolvedValue({ enabled: true, sendHour: 9, dailyCap: 200 });
  sendNotice.mockResolvedValue([{ noticeId: ID, clienteNombre: 'Ana', ventaIds: [ID], status: 'accepted', channel: 'template', waId: '50760000000' }]);
});
describe('POST /api/whatsapp/notices', () => {
  it('returns per-group results with request ID and no-store', async () => {
    const response = await POST(post({ tipo: 'dia_pago', ventaIds: [ID] }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({ ok: true, data: { results: [{ status: 'accepted', channel: 'template' }] }, requestId: expect.any(String) });
    expect(sendNotice).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'dia_pago', ventaIds: [ID], origin: 'manual', sentBy: ID }), expect.any(Object));
  });
  it('wires the outbound sender to the configured Cloud API', async () => {
    sendNotice.mockImplementationOnce(async (_input: unknown, deps: SendNoticeDeps) => {
      await deps.send({ idempotencyKey: ID, toWaId: '50760000000', payload: { kind: 'text', text: 'Hola' }, sentBy: ID });
      return [];
    });
    sendOutboundMessage.mockImplementationOnce(async (_message: unknown, deps: { send: (to: string, payload: { kind: 'text'; text: string }) => Promise<unknown> }) => {
      await deps.send('50760000000', { kind: 'text', text: 'Hola' });
      return { id: ID, sendStatus: 'accepted', waMessageId: 'wamid.1', errorTitle: null, replayed: false };
    });
    sendCloudApiMessage.mockResolvedValue({ waMessageId: 'wamid.1' });
    expect((await POST(post({ tipo: 'dia_pago', ventaIds: [ID] }))).status).toBe(200);
    expect(sendCloudApiMessage).toHaveBeenCalledWith(
      { accessToken: 'configured', phoneNumberId: '123' }, '50760000000', { kind: 'text', text: 'Hola' },
    );
  });
  it('requires an admin', async () => {
    requireAuthenticatedAdmin.mockRejectedValue(new UnauthorizedError());
    expect((await POST(post({ tipo: 'dia_pago', ventaIds: [ID] }))).status).toBe(401);
    expect(sendNotice).not.toHaveBeenCalled();
  });
  it('returns 503 when WhatsApp is not configured', async () => {
    env.whatsappAccessToken = '';
    expect((await POST(post({ tipo: 'dia_pago', ventaIds: [ID] }))).status).toBe(503);
  });
  it.each([{ tipo: 'bad', ventaIds: [ID] }, { tipo: 'dia_pago', ventaIds: [] }, { tipo: 'dia_pago', ventaIds: ['bad'] }, { tipo: 'dia_pago', ventaIds: Array(201).fill(ID) }])('rejects invalid input', async (body) => {
    expect((await POST(post(body))).status).toBe(400);
    expect(sendNotice).not.toHaveBeenCalled();
  });
  it('sends an automatic renewal confirmation with the auto origin when the switch is on', async () => {
    const response = await POST(post({ tipo: 'renovacion', ventaIds: [ID], automatic: true }));
    expect(response.status).toBe(200);
    expect(sendNotice).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'renovacion', ventaIds: [ID], origin: 'auto', sentBy: ID }), expect.any(Object));
    expect(sendNotice.mock.calls[0]![0]).not.toHaveProperty('automatic');
  });
  it('sends nothing for an automatic notice while the automatic switch is off', async () => {
    autoConfig.mockResolvedValue({ enabled: false, sendHour: 9, dailyCap: 200 });
    const response = await POST(post({ tipo: 'renovacion', ventaIds: [ID], automatic: true }));
    expect((await response.json()).data).toEqual({ results: [], skipped: 'auto_disabled' });
    expect(sendNotice).not.toHaveBeenCalled();
  });
  it.each([
    { tipo: 'dia_pago', ventaIds: [ID], automatic: true },
    { tipo: 'cancelacion', ventaIds: [ID], automatic: true },
    { tipo: 'renovacion', ventaIds: [ID, '22222222-2222-4222-8222-222222222222'], automatic: true },
  ])('rejects an automatic notice that is not a single renewal confirmation', async (body) => {
    expect((await POST(post(body))).status).toBe(400);
    expect(sendNotice).not.toHaveBeenCalled();
  });
  it('keeps manual notices independent of the automatic switch', async () => {
    autoConfig.mockResolvedValue({ enabled: false, sendHour: 9, dailyCap: 200 });
    expect((await POST(post({ tipo: 'renovacion', ventaIds: [ID] }))).status).toBe(200);
    expect(sendNotice).toHaveBeenCalledWith(expect.objectContaining({ origin: 'manual' }), expect.any(Object));
    expect(autoConfig).not.toHaveBeenCalled();
  });
  it('enforces the 16KB request limit', async () => {
    expect((await POST(post({ tipo: 'dia_pago', ventaIds: [ID] }, true))).status).toBe(413);
  });
  it('hides backend errors', async () => {
    sendNotice.mockRejectedValue(new Error('private details'));
    const response = await POST(post({ tipo: 'dia_pago', ventaIds: [ID] }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private details');
  });
});
