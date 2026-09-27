import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  assertOnlineMutation: vi.fn(),
  postWhatsAppMessage: vi.fn(),
  getCurrentSession: vi.fn(),
  createIdempotencyKey: vi.fn(() => 'generated-key'),
  listWhatsAppConversations: vi.fn(),
  listWhatsAppMessages: vi.fn(),
  markWhatsAppConversationRead: vi.fn(),
}));

vi.mock('@/modules/pwa/offline-copy', () => ({ assertOnlineMutation: deps.assertOnlineMutation }));
vi.mock('@/platform/api/whatsapp-messages-client', () => ({ postWhatsAppMessage: deps.postWhatsAppMessage }));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: deps.getCurrentSession }));
vi.mock('@/platform/supabase/idempotency', () => ({ createIdempotencyKey: deps.createIdempotencyKey }));
vi.mock('@/platform/supabase/whatsapp-chat-repository', () => ({
  listWhatsAppConversations: deps.listWhatsAppConversations,
  listWhatsAppMessages: deps.listWhatsAppMessages,
  markWhatsAppConversationRead: deps.markWhatsAppConversationRead,
}));

import {
  fetchWhatsAppConversationsUseCase,
  fetchWhatsAppMessagesUseCase,
  markWhatsAppConversationReadUseCase,
  sendWhatsAppMessageUseCase,
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

  it('requires a connection before marking a conversation read', async () => {
    await markWhatsAppConversationReadUseCase('507', '2026-09-27T12:00:00Z');
    expect(deps.markWhatsAppConversationRead).toHaveBeenCalledWith('507', '2026-09-27T12:00:00Z');

    deps.assertOnlineMutation.mockImplementation(() => { throw new Error('offline'); });
    await expect(markWhatsAppConversationReadUseCase('507', 'x')).rejects.toThrow('offline');
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
});
