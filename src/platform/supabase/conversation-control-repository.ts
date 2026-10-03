import { supabase } from './client';
import { z } from '@/platform/validation/zod';

const waIdSchema = z.string().regex(/^[0-9]{7,15}$/);
export const conversationControlRepository = {
  async owner(waId: string) {
    const { data, error } = await supabase.from('whatsapp_conversation_state').select('owner')
      .eq('wa_id', waIdSchema.parse(waId)).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
    if (error) throw new Error('No se pudo consultar quién atiende el chat.');
    return data === null ? null : z.enum(['bot', 'humano']).parse(data.owner);
  },
  async change(waId: string, owner: 'bot' | 'humano') {
    waIdSchema.parse(waId);
    const { data, error } = await supabase.rpc(owner === 'humano' ? 'take_over_conversation' : 'hand_back_conversation', { p_wa_id: waId })
      .abortSignal(AbortSignal.timeout(10000));
    if (error || data !== true) throw new Error('No se pudo cambiar la atención. Recarga el chat e intenta de nuevo.');
  },
};
