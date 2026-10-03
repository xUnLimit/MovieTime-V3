import { conversationControlRepository } from '@/platform/supabase/conversation-control-repository';
import { assertOnlineMutation } from '@/platform/supabase/online-mutation';
import { z } from '@/platform/validation/zod';

export function createConversationControlUseCases(repository = conversationControlRepository) {
  const waIdSchema = z.string().regex(/^[0-9]{7,15}$/);
  function admin(role: string | undefined) { if (role !== 'admin') throw new Error('Solo administradores.'); }
  return {
    async owner(role: string | undefined, waId: string) { admin(role); return repository.owner(waIdSchema.parse(waId)); },
    async change(role: string | undefined, waId: string, owner: 'bot' | 'humano') {
      admin(role); assertOnlineMutation();
      await repository.change(waIdSchema.parse(waId), z.enum(['bot', 'humano']).parse(owner));
    },
  };
}
export const conversationControlUseCases = createConversationControlUseCases();
