import { isUuid } from '@/platform/utils/safety';
import type { OutboundPayload } from './cloud-api-client';
import type { InboundMessage } from './webhook-payload';

type ListPayload = Extract<OutboundPayload, { kind: 'list' }>;

const MENU_IDLE_MS = 12 * 60 * 60 * 1000;
const OPERATOR_QUIET_MS = 60 * 60 * 1000;
const ACCOUNT_PREFIX = 'BOT:ACC:';

export const BOT_NETFLIX_ID = 'BOT:NETFLIX';
export const BOT_SUPPORT_ID = 'BOT:SUPPORT';
export const BOT_OPERATOR_QUIET_MS = OPERATOR_QUIET_MS;

export type BotAction =
  | { kind: 'netflix'; serviceId: string | null }
  | { kind: 'support' };

export function botAccountId(serviceId: string): string {
  return `${ACCOUNT_PREFIX}${serviceId}`;
}

// Only taps on our own menu count; anything else a customer writes stays a chat.
export function readBotAction(message: InboundMessage): BotAction | null {
  const payload = message.payload;
  if (message.messageType !== 'interactive' || !payload || typeof payload !== 'object' || Array.isArray(payload)
    || (payload.type !== 'button_reply' && payload.type !== 'list_reply') || typeof payload.id !== 'string') return null;
  if (payload.id === BOT_NETFLIX_ID) return { kind: 'netflix', serviceId: null };
  if (payload.id === BOT_SUPPORT_ID) return { kind: 'support' };
  if (payload.id.startsWith(ACCOUNT_PREFIX)) {
    const serviceId = payload.id.slice(ACCOUNT_PREFIX.length);
    return isUuid(serviceId) ? { kind: 'netflix', serviceId } : null;
  }
  return null;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function hasMenuKeyword(text: string | null): boolean {
  return text !== null && /\b(hola|buenas|buenos|menu|ayuda|opciones|codigo|netflix)\b/.test(normalize(text));
}

// The menu appears on a keyword or when the conversation was idle, and never
// while a person has been answering this customer.
export function shouldShowMenu(input: {
  text: string | null; lastActivityAt: string | null; operatorRepliedRecently: boolean; now: Date;
}): boolean {
  if (input.operatorRepliedRecently) return false;
  if (hasMenuKeyword(input.text)) return true;
  if (!input.lastActivityAt) return true;
  const idle = input.now.getTime() - Date.parse(input.lastActivityAt);
  return !Number.isFinite(idle) || idle >= MENU_IDLE_MS;
}

export const menuMessage: OutboundPayload = {
  kind: 'buttons',
  body: 'Hola, soy el asistente de MovieTime PTY. ¿Qué necesitas?',
  buttons: [
    { id: BOT_NETFLIX_ID, title: 'Código de Netflix' },
    { id: BOT_SUPPORT_ID, title: 'Hablar con soporte' },
  ],
};

export const retryMessage: OutboundPayload = {
  kind: 'buttons',
  body: 'Todavía no me llega el código. Pídelo en Netflix y toca el botón otra vez.',
  buttons: [{ id: BOT_NETFLIX_ID, title: 'Código de Netflix' }],
};

export function accountListMessage(accounts: readonly { serviceId: string; email: string; profile: string }[]): ListPayload {
  return {
    kind: 'list',
    body: 'Tienes varias cuentas de Netflix. ¿Para cuál es el código?',
    buttonLabel: 'Elegir cuenta',
    rows: accounts.slice(0, 10).map((account) => ({
      id: botAccountId(account.serviceId),
      title: account.email.split('@')[0].slice(0, 24) || 'Cuenta',
      ...(account.profile ? { description: account.profile.slice(0, 72) } : {}),
    })),
  };
}

export const botTexts = {
  support: 'Listo, una persona te atiende en breve.',
  none: 'No encuentro una cuenta de Netflix activa a tu nombre. Una persona te ayuda en breve.',
  limited: 'Pediste muchos códigos seguidos. Espera unos minutos e inténtalo de nuevo.',
  unavailable: 'No pude consultar el código ahora. Una persona te ayuda en breve.',
  code: (code: string) => `Tu código de Netflix es *${code}*. Vence en pocos minutos; úsalo ya y no lo compartas.`,
  codeStored: 'Código de Netflix enviado (oculto).',
  link: (url: string) => `Abre este enlace para ver tu código de acceso temporal de Netflix. Vence en pocos minutos y no lo compartas:\n${url}`,
  linkStored: 'Enlace de acceso temporal de Netflix enviado (oculto).',
} as const;
