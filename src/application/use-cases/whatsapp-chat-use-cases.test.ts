import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
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
  setWhatsAppConversationPinned: vi.fn(),
  setWhatsAppConversationArchived: vi.fn(),
  fetchVentaDetalleQuery: vi.fn(),
  subscribeToWhatsAppChanges: vi.fn(),
}));

vi.mock('@/platform/api/whatsapp-messages-client', () => ({
  postWhatsAppMessage: deps.postWhatsAppMessage,
  postMarkConversationRead: deps.postMarkConversationRead,
  uploadWhatsAppMedia: deps.uploadWhatsAppMedia,
  fetchWhatsAppMedia: deps.fetchWhatsAppMedia,
}));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: deps.getCurrentSession }));
vi.mock('@/platform/supabase/idempotency', () => ({ createIdempotencyKey: deps.createIdempotencyKey }));
vi.mock('@/platform/supabase/whatsapp-realtime', () => ({ subscribeToWhatsAppChanges: deps.subscribeToWhatsAppChanges }));
vi.mock('@/platform/supabase/whatsapp-chat-repository', () => ({
  listWhatsAppConversations: deps.listWhatsAppConversations,
  listWhatsAppMessages: deps.listWhatsAppMessages,
  markWhatsAppConversationUnread: deps.markWhatsAppConversationUnread,
  hideWhatsAppMessage: deps.hideWhatsAppMessage,
  setWhatsAppConversationPinned: deps.setWhatsAppConversationPinned,
  setWhatsAppConversationArchived: deps.setWhatsAppConversationArchived,
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
  subscribeToWhatsAppChatChangesUseCase,
  setWhatsAppConversationArchivedUseCase,
  setWhatsAppConversationPinnedUseCase,
  uploadWhatsAppMediaUseCase,
} from './whatsapp-chat-use-cases';

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentSession.mockResolvedValue({ access_token: 'session-access' });
});

describe('WhatsApp chat use cases', () => {
  it('delega la suscripcion y devuelve su cancelacion', () => {
    const cancel = vi.fn();
    const listener = { onEvent: vi.fn(), onStatus: vi.fn() };
    deps.subscribeToWhatsAppChanges.mockReturnValue(cancel);

    const unsubscribe = subscribeToWhatsAppChatChangesUseCase(listener);

    expect(deps.subscribeToWhatsAppChanges).toHaveBeenCalledWith(listener);
    unsubscribe();
    expect(cancel).toHaveBeenCalledOnce();
  });
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

  it('refuses to send without a session', async () => {
    deps.getCurrentSession.mockResolvedValueOnce(null);
    await expect(sendWhatsAppMessageUseCase({ to: '507', message: { kind: 'text', text: 'x' } }))
      .rejects.toThrow('No hay una sesión activa');
    expect(deps.postWhatsAppMessage).not.toHaveBeenCalled();
  });

  it('downloads attachments with the session token', async () => {
    deps.fetchWhatsAppMedia.mockResolvedValue('blob');

    await expect(fetchWhatsAppMediaUseCase('123')).resolves.toBe('blob');
    expect(deps.fetchWhatsAppMedia).toHaveBeenCalledWith('session-access', '123');

    deps.getCurrentSession.mockResolvedValueOnce(null);
    await expect(fetchWhatsAppMediaUseCase('123')).rejects.toThrow('No hay una sesión activa para ver archivos.');
  });

  it('marks a conversation unread', async () => {
    await markWhatsAppConversationUnreadUseCase('507', '2026-09-27T12:00:00Z');
    expect(deps.markWhatsAppConversationUnread).toHaveBeenCalledWith('507', '2026-09-27T12:00:00Z');
  });

  it('pins and archives with a timestamp, and clears the flag with null', async () => {
    await setWhatsAppConversationPinnedUseCase('50760000000', true);
    await setWhatsAppConversationPinnedUseCase('50760000000', false);
    await setWhatsAppConversationArchivedUseCase('50760000000', true);
    await setWhatsAppConversationArchivedUseCase('50760000000', false);

    expect(deps.setWhatsAppConversationPinned).toHaveBeenNthCalledWith(1, '50760000000', expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(deps.setWhatsAppConversationPinned).toHaveBeenNthCalledWith(2, '50760000000', null);
    expect(deps.setWhatsAppConversationArchived).toHaveBeenNthCalledWith(1, '50760000000', expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(deps.setWhatsAppConversationArchived).toHaveBeenNthCalledWith(2, '50760000000', null);
  });

  it('rejects a malformed WhatsApp number before writing', async () => {
    await expect(setWhatsAppConversationPinnedUseCase('abc', true)).rejects.toThrow('no es válido');
    await expect(setWhatsAppConversationArchivedUseCase("507' or 1=1", true)).rejects.toThrow('no es válido');
    expect(deps.setWhatsAppConversationPinned).not.toHaveBeenCalled();
    expect(deps.setWhatsAppConversationArchived).not.toHaveBeenCalled();
  });

  it('hides a message from the inbox only', async () => {
    await hideWhatsAppMessageUseCase('m1', 'inbound');
    expect(deps.hideWhatsAppMessage).toHaveBeenCalledWith('m1', 'inbound');
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

it('omits code-access passwords even when the manual context receives both credential sources', async () => {
  deps.fetchVentaDetalleQuery.mockResolvedValueOnce({ venta: { clienteNombre: 'Ana', servicioNombre: 'Cuenta',
    accesoPorCodigo: true, servicioContrasena: 'stale-password' }, servicioContrasena: 'current-password' });
  expect(await fetchVentaMessageContextUseCase('v1')).toMatchObject({ contrasena: '' });
});
