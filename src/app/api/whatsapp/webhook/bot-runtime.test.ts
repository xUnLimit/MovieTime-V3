import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDefinition, defaultDefinitionV2 } from '@/modules/bot-config';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';

const fakes = vi.hoisted(() => ({ load: vi.fn(), state: vi.fn(), v1: vi.fn(), v2: vi.fn(), record: vi.fn() }));
vi.mock('@/platform/config/netflix-server', () => ({ getNetflixMailConfig: () => null }));
vi.mock('@/platform/server/netflix-imap', () => ({ openNetflixInbox: vi.fn() }));
vi.mock('@/platform/server/netflix-travel-page', () => ({ fetchTravelPageHtml: vi.fn() }));
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: () => ({ rpc: vi.fn() }) }));
vi.mock('@/modules/messaging/bot-config-store', () => ({ createBotConfigStore: () => ({ load: fakes.load }) }));
vi.mock('@/modules/messaging/conversation-state-store', () => ({ createConversationStateStore: () => ({ load: fakes.state }) }));
vi.mock('@/modules/messaging/bot-events-store', () => ({ createBotEventsStore: () => ({ record: fakes.record }) }));
vi.mock('@/modules/messaging/bot-store', () => ({ createBotStore: () => ({}) }));
vi.mock('@/modules/messaging/netflix-claim-store', () => ({ createNetflixClaimStore: () => ({}) }));
vi.mock('@/modules/messaging/contact-store', () => ({ createContactStore: () => ({}) }));
vi.mock('@/modules/messaging/bot-v2-identity-store', () => ({ createBotV2IdentityStore: () => ({}) }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => ({}) }));
vi.mock('@/modules/messaging/bot-catalog-store', () => ({ createBotCatalogStore: () => ({}) }));
vi.mock('@/application/use-cases/whatsapp-bot-use-case', () => ({ handleBotMessage: fakes.v1 }));
vi.mock('@/application/use-cases/bot-v2/runtime', () => ({ handleV2Message: fakes.v2 }));
import { createBotRuntime } from './bot-runtime';

const message: InboundMessage = { waMessageId: 'fixture', phoneNumberId: '1', fromWaId: '50760000000', contactName: null,
  messageType: 'text', textBody: 'hola', sentAt: '2026-10-04T04:00:00Z', mediaId: null, mediaMimeType: null,
  mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} };
const send = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  fakes.state.mockResolvedValue(null); fakes.v1.mockResolvedValue('menu'); fakes.v2.mockResolvedValue('node');
  fakes.load.mockResolvedValue({ ready: true, definition: defaultDefinition(), version: 19 });
});
describe('live schema dispatch', () => {
  it('keeps v1 on its existing handler and reads the definition once per delivery', async () => {
    const runtime = createBotRuntime('request');
    await runtime.handle(message, send); await runtime.handle({ ...message, waMessageId: 'next' }, send);
    expect(fakes.v1).toHaveBeenCalledTimes(2); expect(fakes.v2).not.toHaveBeenCalled();
    expect(fakes.load).toHaveBeenCalledTimes(1);
    expect(fakes.v1).toHaveBeenCalledWith(message, expect.objectContaining({ definition: defaultDefinition(), send }));
  });
  it('routes v2 with the published flow version and its dependency bindings', async () => {
    fakes.load.mockResolvedValue({ ready: true, definition: defaultDefinitionV2(), version: 19 });
    await createBotRuntime('request').handle(message, send);
    expect(fakes.v1).not.toHaveBeenCalled();
    expect(fakes.v2).toHaveBeenCalledWith(message, expect.objectContaining({ version: 19, definition: defaultDefinitionV2(), send }));
  });
  it('keeps v1 silent while owned by a human', async () => {
    fakes.state.mockResolvedValue({ state: { owner: 'humano' } });
    expect(await createBotRuntime('request').handle(message, send)).toBe('ignored');
    expect(fakes.v1).not.toHaveBeenCalled();
  });
  it('fails closed when the bot is disabled and records execution errors without payloads', async () => {
    fakes.load.mockResolvedValue({ ready: false, reason: 'disabled' });
    expect(await createBotRuntime('request').handle(message, send)).toBe('off');
    expect(fakes.record).not.toHaveBeenCalled();
    fakes.load.mockResolvedValue({ ready: true, definition: defaultDefinitionV2(), version: 19 });
    fakes.v2.mockRejectedValue(new Error('internal'));
    await expect(createBotRuntime('request').handle(message, send)).rejects.toThrow('internal');
    expect(fakes.record).toHaveBeenCalledWith({ waId: message.fromWaId, type: 'error', detail: { motivo: 'respuesta_fallida' } });
  });
});
