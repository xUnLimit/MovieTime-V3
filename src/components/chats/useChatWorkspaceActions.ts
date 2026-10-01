import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import {
  useMarkWhatsAppConversationRead,
  useMarkWhatsAppConversationUnread,
  useSetWhatsAppConversationArchived,
  useSetWhatsAppConversationPinned,
} from '@/hooks/use-whatsapp-chat';

export function useChatWorkspaceActions(conversation: WhatsAppConversation, onBack: () => void) {
  const { waId } = conversation;
  const { mutate: markRead } = useMarkWhatsAppConversationRead();
  const markUnread = useMarkWhatsAppConversationUnread();
  const setPinned = useSetWhatsAppConversationPinned();
  const setArchived = useSetWhatsAppConversationArchived();
  // Tras "Marcar como no leído" el chat abierto deja de marcarse como leído solo;
  // si no, la recarga de la lista revertía la marca en milisegundos.
  const autoReadEnabled = useRef(true);

  useEffect(() => {
    if (autoReadEnabled.current && conversation.unreadCount > 0) {
      markRead({ waId, readAt: new Date().toISOString() });
    }
  }, [conversation.unreadCount, markRead, waId]);

  const onMarkUnread = () => {
    if (conversation.lastInboundAt) {
      autoReadEnabled.current = false;
      markUnread.mutate({ waId, lastInboundAt: conversation.lastInboundAt }, { onSuccess: onBack });
    }
  };
  const onTogglePin = () => setPinned.mutate({ waId, pinned: !conversation.pinnedAt }, {
    onError: (error) => toast.error(getPublicErrorMessage(error, 'No se pudo cambiar el fijado. Intenta de nuevo.')),
  });
  const onToggleArchive = () => setArchived.mutate({ waId, archived: !conversation.archived }, {
    onSuccess: () => {
      toast.success(conversation.archived ? 'Conversación desarchivada.' : 'Conversación archivada. Volverá a la bandeja cuando el cliente escriba.');
      if (!conversation.archived) onBack();
    },
    onError: (error) => toast.error(getPublicErrorMessage(error, 'No se pudo cambiar el archivado. Intenta de nuevo.')),
  });

  return { onMarkUnread, onTogglePin, onToggleArchive };
}
