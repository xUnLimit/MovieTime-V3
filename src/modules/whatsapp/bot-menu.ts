import { NODE_LIMITS, parseOptionReplyId } from '@/modules/bot-config';
import { isUuid } from '@/platform/utils/safety';
import type { OutboundPayload } from './cloud-api-client';
import type { InboundMessage } from './webhook-payload';

type ListPayload = Extract<OutboundPayload, { kind: 'list' }>;
// login: code to sign in on a device. travel: code that confirms a device away from home.
export type BotCodeType = 'login' | 'travel';
// Where a button sent before the flow became configurable leads to today.
export type LegacyTarget = 'entry' | 'login' | 'travel' | 'handoff';

const ACCOUNT_PREFIX = 'BOT:ACC:';
const ACCOUNT_TYPE_TOKEN: Record<BotCodeType, string> = { login: 'LOGIN', travel: 'TRAVEL' };

// Compatibility aliases: chats still show buttons that were sent with these ids.
const LEGACY_REPLY_IDS: ReadonlyMap<string, LegacyTarget> = new Map([
  ['BOT:NETFLIX', 'entry'],
  ['BOT:NFX:LOGIN', 'login'],
  ['BOT:NFX:TRAVEL', 'travel'],
  ['BOT:SUPPORT', 'handoff'],
]);

// What the chat history keeps instead of the code or the link (never configurable).
export const BOT_STORED_TEXT = {
  code: 'Código de Netflix enviado (oculto).',
  link: 'Enlace de acceso temporal de Netflix enviado (oculto).',
} as const;

export type BotAction =
  | { kind: 'option'; nodeId: string; optionId: string }
  | { kind: 'account'; type: BotCodeType; serviceId: string }
  | { kind: 'legacy'; target: LegacyTarget };

function botAccountId(type: BotCodeType, serviceId: string): string {
  return `${ACCOUNT_PREFIX}${ACCOUNT_TYPE_TOKEN[type]}:${serviceId}`;
}

function readAccountRow(id: string): BotAction | null {
  for (const type of ['login', 'travel'] as const) {
    const prefix = `${ACCOUNT_PREFIX}${ACCOUNT_TYPE_TOKEN[type]}:`;
    if (!id.startsWith(prefix)) continue;
    const serviceId = id.slice(prefix.length);
    return isUuid(serviceId) ? { kind: 'account', type, serviceId } : null;
  }
  return null;
}

// Only taps on our own menu count; anything else a customer writes stays a chat.
export function readBotAction(message: InboundMessage): BotAction | null {
  const payload = message.payload;
  // Approved access notices arrive as template buttons rather than interactive replies.
  if (message.messageType === 'button' && payload && typeof payload === 'object' && !Array.isArray(payload)
    && payload.type === 'template_button' && payload.payload === 'BOT:NFX:LOGIN') {
    return { kind: 'legacy', target: 'login' };
  }
  if (message.messageType !== 'interactive' || !payload || typeof payload !== 'object' || Array.isArray(payload)
    || (payload.type !== 'button_reply' && payload.type !== 'list_reply') || typeof payload.id !== 'string') return null;
  const legacy = LEGACY_REPLY_IDS.get(payload.id);
  if (legacy) return { kind: 'legacy', target: legacy };
  const option = parseOptionReplyId(payload.id);
  if (option) return { kind: 'option', ...option };
  return readAccountRow(payload.id);
}

// The list that asks which Netflix account the code is for; the wording comes from the published bot.
export function accountListMessage(
  accounts: readonly { serviceId: string; email: string; profiles: readonly string[] }[], type: BotCodeType,
  texts: { body: string; buttonLabel: string },
): ListPayload {
  return {
    kind: 'list',
    body: texts.body,
    buttonLabel: texts.buttonLabel.slice(0, NODE_LIMITS.listButtonMax),
    rows: accounts.slice(0, NODE_LIMITS.listRowsMax).map((account) => ({
      id: botAccountId(type, account.serviceId),
      title: account.email.split('@')[0].slice(0, NODE_LIMITS.listTitleMax) || 'Cuenta',
      ...(account.profiles.length > 0 ? { description: account.profiles.join(', ').slice(0, NODE_LIMITS.listDescriptionMax) } : {}),
    })),
  };
}
