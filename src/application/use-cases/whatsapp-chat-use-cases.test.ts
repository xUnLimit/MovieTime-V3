import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  assertOnlineMutation: vi.fn(),
  postWhatsAppMessage: vi.fn(),
  postMarkConversationRead: vi.fn(),
  uploadWhatsAppMedia: vi.fn(),
  fetchWhatsAppMedia: vi.fn(),
  getCurrentSession: vi.fn(),
  createIdempotencyKey: vi.fn(() => 'generated-key'),
  listWhatsAppConversations: vi.fn(),
  listWhatsAppMessages: vi.fn(),
  markWhatsAppConversationUnread: vi.fn(),
  hideWhatsAppMessage: vi.fn(),
  fetchVentaDetalleQuery: vi.fn(),
}));

vi.mock('@/modules/pwa/offline-copy', () => ({ assertOnlineMutation: deps.assertOnlineMutation }));
vi.mock('@/platform/api/whatsapp-messages-client', () => ({
  postWhatsAppMessage: deps.postWhatsAppMessage,
  postMarkConversationRead: deps.postMarkConversationRead,
  uploadWhatsAppMedia: deps.uploadWhatsAppMedia,
  fetchWhatsAppMedia: deps.fetchWhatsAppMedia,
}));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: deps.getCurrentSession }));
vi.mock('@/platform/supabase/idempotency', () => ({ createIdempotencyKey: deps.createIdempotencyKey }));
vi.mock('@/platform/supabase/whatsapp-chat-repository', () => ({
  listWhatsAppConversations: deps.listWhatsAppConversations,
  listWhatsAppMessages: deps.listWhatsAppMessages,
  markWhatsAppConversationUnread: deps.markWhatsAppConversationUnread,
  hideWhatsAppMessage: deps.hideWhatsAppMessage,
}));
vi.mock('./ventas/venta-detail-query-use-cases', () => ({ fetchVentaDetalleQuery: deps.fetchVentaDetalleQuery }));

import {
  fetchVentaMessageContextUseCase,
  fetchWhatsAppConversationsUseCase,
  fetchWhatsAppMediaUseCase,
  fetchWhatsAppMessagesUseCase,
  hideWhatsAppMessageUseCase,
  markWhatsAppConversationReadUseCase,
  markWhatsAppConversationUnreadUseCase,
  sendWhatsAppMessageUseCase,
  uploadWhatsAppMediaUseCase,
} from './whatsapp-chat-use-cases';

beforeEach(() => {
  vi.clearAllMocks();
  deps.assertOnlineMutation.mockImplementation(() => undefined);
  deps.getCurrentSession.mockResolvedValue({ access_token: 'session-access' });
});

describe('WhatsApp chat use cases', () => {
  it('reads conversations and messages through the repository', async () => {
    deps.listWhatsAppConversations.mockResolvedValue(['c']);
    deps.listWhatsAppMessages.mockResolvedValue(['m']);

    await expect(fetchWhatsAppConversationsUseCase()).resolves.toEqual(['c']);
    await expect(fetchWhatsAppMessagesUseCase('507')).resolves.toEqual(['m']);
    expect(deps.listWhatsAppMessages).toHaveBeenCalledWith('507');
  });

  it('marks a conversation read through the server, with the session token', async () => {
    await markWhatsAppConversationReadUseCase('507', '2026-09-27T12:00:00Z');
    expect(deps.postMarkConversationRead).toHaveBeenCalledWith('session-access', '507', '2026-09-27T12:00:00Z');

    deps.assertOnlineMutation.mockImplementation(() => { throw new Error('offline'); });
    await expect(markWhatsAppConversationReadUseCase('507', 'x')).rejects.toThrow('offline');

    deps.assertOnlineMutation.mockImplementation(() => undefined);
    deps.getCurrentSession.mockResolvedValueOnce(null);
    await expect(markWhatsAppConversationReadUseCase('507', 'x'))
      .rejects.toThrow('No hay una sesión activa para marcar la conversación como leída.');
  });

  it('uploads a file with the session token', async () => {
    deps.uploadWhatsAppMedia.mockResolvedValue({ mediaId: 'm1', mimeType: 'image/jpeg', filename: 'foto.jpg' });

    await expect(uploadWhatsAppMediaUseCase('blob' as unknown as Blob, 'foto.jpg')).resolves.toEqual({
      mediaId: 'm1', mimeType: 'image/jpeg', filename: 'foto.jpg',
    });
    expect(deps.uploadWhatsAppMedia).toHaveBeenCalledWith('session-access', 'blob', 'foto.jpg');

    deps.assertOnlineMutation.mockImplementation(() => { throw new Error('offline'); });
    await expect(uploadWhatsAppMediaUseCase('blob' as unknown as Blob, 'foto.jpg')).rejects.toThrow('offline');
  });

  it('sends with the session token and the caller idempotency key', async () => {
    deps.postWhatsAppMessage.mockResolvedValue({ sendStatus: 'accepted' });

    await sendWhatsAppMessageUseCase({ to: '507', message: { kind: 'text', text: 'Hola' }, idempotencyKey: 'caller-key' });

    expect(deps.postWhatsAppMessage).toHaveBeenCalledWith('session-access', {
      idempotencyKey: 'caller-key', to: '507', message: { kind: 'text', text: 'Hola' },
    });
  });

  it('generates an idempotency key when none is given', async () => {
    await sendWhatsAppMessageUseCase({ to: '507', message: { kind: 'text', text: 'Hola' } });

    expect(deps.postWhatsAppMessage).toHaveBeenCalledWith('session-access', expect.objectContaining({ idempotencyKey: 'generated-key' }));
  });

  it('refuses to send offline or without a session', async () => {
    deps.getCurrentSession.mockResolvedValueOnce(null);
    await expect(sendWhatsAppMessageUseCase({ to: '507', message: { kind: 'text', text: 'x' } }))
      .rejects.toThrow('No hay una sesión activa');

    deps.assertOnlineMutation.mockImplementation(() => { throw new Error('offline'); });
    await expect(sendWhatsAppMessageUseCase({ to: '507', message: { kind: 'text', text: 'x' } })).rejects.toThrow('offline');
    expect(deps.postWhatsAppMessage).not.toHaveBeenCalled();
  });

  it('downloads attachments with the session token', async () => {
    deps.fetchWhatsAppMedia.mockResolvedValue('blob');

    await expect(fetchWhatsAppMediaUseCase('123')).resolves.toBe('blob');
    expect(deps.fetchWhatsAppMedia).toHaveBeenCalledWith('session-access', '123');

    deps.getCurrentSession.mockResolvedValueOnce(null);
    await expect(fetchWhatsAppMediaUseCase('123')).rejects.toThrow('No hay una sesión activa para ver archivos.');
  });

  it('marks a conversation unread only when online', async () => {
    await markWhatsAppConversationUnreadUseCase('507', '2026-09-27T12:00:00Z');
    expect(deps.markWhatsAppConversationUnread).toHaveBeenCalledWith('507', '2026-09-27T12:00:00Z');

    deps.assertOnlineMutation.mockImplementation(() => {
      throw new Error('offline');
    });
    await expect(markWhatsAppConversationUnreadUseCase('507', 'x')).rejects.toThrow('offline');
  });

  it('hides a message from the inbox only, and only when online', async () => {
    await hideWhatsAppMessageUseCase('m1', 'inbound');
    expect(deps.hideWhatsAppMessage).toHaveBeenCalledWith('m1', 'inbound');

    deps.assertOnlineMutation.mockImplementation(() => { throw new Error('offline'); });
    await expect(hideWhatsAppMessageUseCase('m1', 'outbound')).rejects.toThrow('offline');
  });

  it('builds the message context from the sale detail', async () => {
    deps.fetchVentaDetalleQuery.mockResolvedValueOnce({
      venta: {
        clienteNombre: 'María Pérez', categoriaNombre: 'Netflix', servicioNombre: 'Netflix 01', perfilNombre: 'María',
        servicioCorreo: 'c@example.com', servicioContrasena: '', codigo: '12', fechaFin: new Date(2026, 8, 30), precioFinal: 5, precio: 6,
      },
      servicioContrasena: 'clave-servicio',
    });

    await expect(fetchVentaMessageContextUseCase('v1')).resolves.toEqual({
      clienteNombre: 'María Pérez', categoriaNombre: 'Netflix', servicioNombre: 'Netflix 01', perfilNombre: 'María',
      correo: 'c@example.com', contrasena: 'clave-servicio', codigo: '12', fechaVencimiento: new Date(2026, 8, 30), monto: 5,
    });
    expect(deps.fetchVentaDetalleQuery).toHaveBeenCalledWith('v1');
  });

  it('falls back to defaults for sparse sales and returns null when missing', async () => {
    deps.fetchVentaDetalleQuery.mockResolvedValueOnce({ venta: { clienteNombre: 'Juan', servicioNombre: 'Disney 02', precio: 3 }, servicioContrasena: '' });
    await expect(fetchVentaMessageContextUseCase('v2')).resolves.toMatchObject({
      categoriaNombre: 'Disney 02', perfilNombre: '', correo: '', codigo: '', fechaVencimiento: null, monto: 3,
    });

    deps.fetchVentaDetalleQuery.mockResolvedValueOnce({ venta: { clienteNombre: 'X', servicioNombre: 'Y' }, servicioContrasena: '' });
    await expect(fetchVentaMessageContextUseCase('v3')).resolves.toMatchObject({ monto: 0 });

    deps.fetchVentaDetalleQuery.mockResolvedValueOnce({ venta: null, servicioContrasena: '' });
    await expect(fetchVentaMessageContextUseCase('missing')).resolves.toBeNull();
  });

});
