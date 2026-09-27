import { assertOnlineMutation } from '@/modules/pwa/offline-copy';
import {
  postWhatsAppMessage,
  type WhatsAppSendMessage,
  type WhatsAppSendResult,
} from '@/platform/api/whatsapp-messages-client';
import { getCurrentSession } from '@/platform/supabase/auth';
import { createIdempotencyKey } from '@/platform/supabase/idempotency';
import {
  listWhatsAppConversations,
  listWhatsAppMessages,
  markWhatsAppConversationRead,
} from '@/platform/supabase/whatsapp-chat-repository';

export type { WhatsAppConversation, WhatsAppChatMessage } from '@/platform/supabase/whatsapp-chat-repository';
export type { WhatsAppSendMessage, WhatsAppSendResult } from '@/platform/api/whatsapp-messages-client';

export function fetchWhatsAppConversationsUseCase() {
  return listWhatsAppConversations();
}

export function fetchWhatsAppMessagesUseCase(waId: string) {
  return listWhatsAppMessages(waId);
}

export async function markWhatsAppConversationReadUseCase(waId: string, readAt: string) {
  assertOnlineMutation();
  await markWhatsAppConversationRead(waId, readAt);
}

// La clave de idempotencia la genera quien llama (una por intento del usuario),
// para que un reintento de red devuelva el mismo envio en vez de duplicarlo.
export async function sendWhatsAppMessageUseCase(input: {
  to: string;
  message: WhatsAppSendMessage;
  idempotencyKey?: string;
}): Promise<WhatsAppSendResult> {
  assertOnlineMutation();
  const session = await getCurrentSession();
  if (!session?.access_token) {
    throw new Error('No hay una sesión activa para enviar mensajes.');
  }
  return postWhatsAppMessage(session.access_token, {
    idempotencyKey: input.idempotencyKey ?? createIdempotencyKey(),
    to: input.to,
    message: input.message,
  });
}
