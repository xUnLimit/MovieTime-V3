import { createServiceRoleClient } from '@/platform/server/supabase-server';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** El texto del recorrido cuya respuesta escrita espera el bot de un cliente, y hasta cuándo. */
export type BotWait = { nodeId: string; expiresAt: string };
export type BotWaitStore = {
  // Solo una espera vigente: una vencida es como si no existiera.
  get(waId: string, now: Date): Promise<BotWait | null>;
  // Cada cliente espera una sola respuesta a la vez: empezar otra reemplaza la anterior.
  set(waId: string, wait: BotWait, now: Date): Promise<void>;
  // Con `only`, borra la espera solo si sigue siendo esa (una espera nueva que ya la reemplazó no se toca).
  clear(waId: string, only?: BotWait): Promise<void>;
};

function check(error: { code?: string } | null, action: string): void {
  if (error) throw new Error(`Bot wait store ${action} failed: ${error.code ?? 'unknown'}`);
}

export function createBotWaitStore(client: ServiceClient = createServiceRoleClient()): BotWaitStore {
  return {
    async get(waId, now) {
      const { data, error } = await client.from('whatsapp_bot_waits').select('node_id,expires_at')
        .eq('wa_id', waId).gt('expires_at', now.toISOString()).maybeSingle();
      check(error, 'lookup');
      return data ? { nodeId: data.node_id, expiresAt: data.expires_at } : null;
    },
    async set(waId, wait, now) {
      const { error } = await client.from('whatsapp_bot_waits').upsert({
        wa_id: waId, node_id: wait.nodeId, expires_at: wait.expiresAt, created_at: now.toISOString(),
      }, { onConflict: 'wa_id' });
      check(error, 'save');
      // Limpieza de pasada: las esperas vencidas no sirven para nada.
      const { error: purgeError } = await client.from('whatsapp_bot_waits').delete().lt('expires_at', now.toISOString());
      check(purgeError, 'purge');
    },
    async clear(waId, only) {
      let query = client.from('whatsapp_bot_waits').delete().eq('wa_id', waId);
      if (only) query = query.eq('node_id', only.nodeId).eq('expires_at', only.expiresAt);
      const { error } = await query;
      check(error, 'clear');
    },
  };
}
