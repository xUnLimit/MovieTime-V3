import { createLogger } from '@/platform/observability/logger';
import { createServiceRoleClient } from '@/platform/server/supabase-server';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type ContactEstado = 'lead' | 'cliente' | 'bloqueado';
export type WhatsAppContact = { waId: string; terceroId: string | null; estado: ContactEstado };
export type ContactStore = { upsert(waId: string, profileName: string | null): Promise<WhatsAppContact> };
type InboundSender = { fromWaId: string; contactName: string | null };

const MAX_WA_ID = 32;
const MAX_PROFILE_NAME = 256;
const ESTADOS: readonly ContactEstado[] = ['lead', 'cliente', 'bloqueado'];
const logger = createLogger('WhatsAppContactStore');

function isEstado(value: string): value is ContactEstado {
  return (ESTADOS as readonly string[]).includes(value);
}

export function createContactStore(client: ServiceClient = createServiceRoleClient()): ContactStore {
  return {
    async upsert(waId, profileName) {
      const { data, error } = await client.rpc('upsert_whatsapp_contact', {
        p_wa_id: waId,
        p_nombre_perfil: profileName?.trim().slice(0, MAX_PROFILE_NAME) || null,
      });
      if (error) throw new Error(`Contact store upsert failed: ${error.code ?? 'unknown'}`);
      const row = data?.[0];
      if (!row || !isEstado(row.estado)) throw new Error('Contact store upsert returned an invalid row');
      return { waId: row.wa_id, terceroId: row.tercero_id, estado: row.estado };
    },
  };
}

/**
 * Registra una vez por remitente los contactos de un lote entrante. Nunca lanza: un fallo aqui no debe
 * cambiar la respuesta del webhook ni frenar al bot. Los logs no incluyen numeros ni nombres.
 */
export async function registerInboundContacts(
  messages: readonly InboundSender[],
  requestId: string,
  createStore: () => ContactStore = createContactStore,
): Promise<void> {
  const senders = new Map<string, string | null>();
  for (const message of messages) {
    if (!message.fromWaId || message.fromWaId.length > MAX_WA_ID) continue;
    // El ultimo nombre de perfil no vacio del lote gana.
    senders.set(message.fromWaId, message.contactName?.trim() || senders.get(message.fromWaId) || null);
  }
  if (senders.size === 0) return;
  let store: ContactStore;
  try {
    store = createStore();
  } catch {
    logger.warn('WhatsApp contact store unavailable', { requestId });
    return;
  }
  let failed = 0;
  for (const [waId, profileName] of senders) {
    try {
      await store.upsert(waId, profileName);
    } catch {
      failed += 1;
    }
  }
  if (failed > 0) logger.warn('WhatsApp contacts could not be registered', { requestId, failed, total: senders.size });
}
