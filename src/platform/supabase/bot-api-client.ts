import { readApiResponse } from '@/platform/api/client';
import type { BotHealth, BotMailboxCheck } from '@/types/bot';

/** Lo que solo el servidor sabe: si las integraciones estan configuradas (sin exponer valores). */
export type BotConfigHealth = Pick<BotHealth, 'whatsappConfigured' | 'mailboxConfigured'>;

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function fetchBotConfigHealth(accessToken: string): Promise<BotConfigHealth> {
  const response = await fetch('/api/whatsapp/bot/health', { method: 'GET', headers: authorization(accessToken), cache: 'no-store' });
  return readApiResponse<BotConfigHealth>(response);
}

export async function requestBotMailboxCheck(accessToken: string): Promise<BotMailboxCheck> {
  const response = await fetch('/api/whatsapp/bot/mailbox-check', {
    method: 'POST', headers: { ...authorization(accessToken), 'Content-Type': 'application/json' }, body: '{}',
  });
  return readApiResponse<BotMailboxCheck>(response);
}
