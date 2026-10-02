import { beforeEach, it, expect, vi } from 'vitest';
import { defaultDefinition } from '@/modules/bot-config';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotDeps } from '@/application/use-cases/bot-reply';
const mocks = vi.hoisted(() => ({ config: vi.fn(), load: vi.fn(), record: vi.fn(), handle: vi.fn(), mailbox: vi.fn(), inbox: vi.fn() }));
vi.mock('@/modules/messaging/bot-config-store', () => ({ createBotConfigStore: () => ({ load: mocks.config }) }));
vi.mock('@/modules/messaging/bot-events-store', () => ({ createBotEventsStore: () => ({ record: mocks.record }) }));
vi.mock('@/modules/messaging/bot-store', () => ({ createBotStore: () => ({}) }));
vi.mock('@/modules/messaging/netflix-claim-store', () => ({ createNetflixClaimStore: () => ({}) }));
vi.mock('@/modules/messaging/conversation-state-store', () => ({ createConversationStateStore: () => ({ load: mocks.load }) }));
vi.mock('@/application/use-cases/whatsapp-bot-use-case', () => ({ handleBotMessage: mocks.handle }));
vi.mock('@/platform/server/netflix-imap', () => ({ openNetflixInbox: mocks.inbox }));
vi.mock('@/platform/config/netflix-server', () => ({ getNetflixMailConfig: mocks.mailbox }));
import { createBotRuntime } from './bot-runtime';
const message: InboundMessage = { waMessageId: 'wamid.test', phoneNumberId: '1', fromWaId: '50760000001', contactName: null,
  messageType: 'text', textBody: 'hola', sentAt: '2026-10-02T12:00:00Z', mediaId: null, mediaMimeType: null, mediaFilename: null,
  contextWaMessageId: null, reactionEmoji: null, payload: {} };
beforeEach(() => { vi.clearAllMocks(); mocks.config.mockResolvedValue({ ready: true, definition: defaultDefinition() }); mocks.load.mockResolvedValue(null); });
it('injects the canonical persisted owner lookup into the bot use case', async () => {
  mocks.handle.mockImplementation(async (_message: InboundMessage, deps: BotDeps) => {
    expect(deps.conversationOwner).toBeDefined();
    expect(await deps.conversationOwner?.(message.fromWaId)).toBe('humano'); return 'ignored';
  });
  mocks.load.mockResolvedValue({ state: { owner: 'humano' } });
  expect(await createBotRuntime('request-id').handle(message, vi.fn())).toBe('ignored');
  expect(mocks.load).toHaveBeenCalledWith(message.fromWaId);
});
it('handles absent state and records controlled errors without swallowing them', async () => {
  mocks.handle.mockImplementation(async (_message: InboundMessage, deps: BotDeps) => {
    expect(await deps.conversationOwner?.(message.fromWaId)).toBeNull(); return 'menu';
  });
  const runtime = createBotRuntime('request-id'); expect(await runtime.handle(message, vi.fn())).toBe('menu');
  mocks.load.mockRejectedValueOnce(new Error('Unavailable'));
  await expect(runtime.handle(message, vi.fn())).rejects.toThrow('Unavailable');
  expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', detail: { motivo: 'respuesta_fallida' } }));
});
it('keeps a disabled bot silent', async () => {
  mocks.config.mockResolvedValue({ ready: false, reason: 'disabled' });
  expect(await createBotRuntime('request-id').handle(message, vi.fn())).toBe('off');
  expect(mocks.handle).not.toHaveBeenCalled();
});
