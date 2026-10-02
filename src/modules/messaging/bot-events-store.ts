import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { BotEventDetail, BotEventType } from '@/types/bot';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type BotEventInput = {
  waId: string;
  clienteId?: string | null;
  type: BotEventType;
  nodeId?: string | null;
  optionId?: string | null;
  detail?: Record<string, unknown>;
};
export type BotEventsStore = { record(event: BotEventInput): Promise<void> };

const MAX_KEYS = 20;
const MAX_VALUE_LENGTH = 120;
const SAFE_KEY = /^[a-z][a-z0-9_]{0,39}$/;
// Keys that could carry a credential, a code or a link are dropped no matter their value.
const SECRET_KEY = /pass|secret|token|cookie|authoriz|credential|otp|code|codigo|link|enlace|url|href|mail_key|key/i;
const SECRET_VALUE = /:\/\/|^\d{4,8}$/;

/** Keeps only short, plain facts: events are audit data, never a place for secrets. */
export function sanitizeEventDetail(detail: Record<string, unknown> | undefined): BotEventDetail {
  const safe: BotEventDetail = {};
  for (const [key, value] of Object.entries(detail ?? {})) {
    if (Object.keys(safe).length >= MAX_KEYS) break;
    if (!SAFE_KEY.test(key) || SECRET_KEY.test(key)) continue;
    if (typeof value === 'boolean' || value === null) safe[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === 'string') {
      const text = value.trim();
      if (!SECRET_VALUE.test(text)) safe[key] = text.slice(0, MAX_VALUE_LENGTH);
    }
  }
  return safe;
}

function limit(value: string | null | undefined, max: number): string | null {
  return value ? value.slice(0, max) : null;
}

export function createBotEventsStore(client: ServiceClient = createServiceRoleClient()): BotEventsStore {
  return {
    async record(event) {
      const { error } = await client.rpc('record_whatsapp_bot_event', {
        p_wa_id: event.waId.slice(0, 32),
        p_cliente_id: event.clienteId ?? null,
        p_type: event.type,
        p_node_id: limit(event.nodeId, 64),
        p_option_id: limit(event.optionId, 64),
        p_detail: sanitizeEventDetail(event.detail),
      });
      if (error) throw new Error(`Bot events store record failed: ${error.code ?? 'unknown'}`);
    },
  };
}
