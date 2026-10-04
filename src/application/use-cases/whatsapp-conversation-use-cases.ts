import { fetchConversationControl, postConversationControl, postConversationReview } from '@/platform/api/whatsapp-conversation-client';
import { getCurrentSession } from '@/platform/supabase/auth';
import { assertOnlineMutation } from '@/platform/utils/online-mutation';
import { conversationModeSchema, conversationQuerySchema, conversationReviewSchema } from '@/modules/whatsapp/conversation-contracts';

async function token(): Promise<string> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Debes iniciar sesión para atender el chat.');
  return session.access_token;
}
export async function getConversationControlUseCase(waId: string) {
  const input = conversationQuerySchema.parse({ waId });
  return fetchConversationControl(await token(), input.waId);
}
export async function setConversationControlUseCase(input: { waId: string; mode: 'bot' | 'human'; version: number }) {
  assertOnlineMutation();
  return postConversationControl(await token(), conversationModeSchema.parse(input));
}
export async function resolveConversationReviewUseCase(waId: string, version: number) {
  assertOnlineMutation();
  return postConversationReview(await token(), conversationReviewSchema.parse({ waId, version }));
}
