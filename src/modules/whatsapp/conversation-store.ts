import { createServiceRoleClient, createUserRequestClient } from '@/platform/server/supabase-server';
import type { WhatsAppConversationControl } from '@/types/whatsapp-conversation';
import { conversationControlSchema } from './conversation-contracts';

type Client = ReturnType<typeof createServiceRoleClient>;
export function createConversationStore(client: Client = createServiceRoleClient()) {
  return {
    async get(waId: string): Promise<WhatsAppConversationControl> {
      const { data, error } = await client.from('whatsapp_conversation_state')
        .select('wa_id,mode,version,operator_id,active_process,order_id,handoff_reason').eq('wa_id', waId).maybeSingle();
      if (error) throw new Error('Conversation lookup failed');
      return conversationControlSchema.parse(data ? {
        waId: data.wa_id, mode: data.mode, version: data.version, operatorId: data.operator_id,
        activeProcess: data.active_process, orderId: data.order_id, handoffReason: data.handoff_reason,
      } : { waId, mode: 'bot', version: 0, operatorId: null, activeProcess: null, orderId: null, handoffReason: null });
    },
  };
}

export async function setConversationMode(authorization: string, input: { waId: string; mode: string; version: number }) {
  const { data, error } = await createUserRequestClient(authorization).rpc('set_whatsapp_conversation_mode', {
    p_wa_id: input.waId, p_mode: input.mode, p_version: input.version,
  });
  if (error) throw new Error('Conversation control failed');
  return data === true;
}

export async function resolveConversationReview(authorization: string, input: { waId: string; version: number }) {
  const { data, error } = await createUserRequestClient(authorization).rpc('resolve_whatsapp_automation_review', {
    p_wa_id: input.waId, p_version: input.version,
  });
  if (error) throw new Error('Conversation review resolution failed');
  return data === true;
}
