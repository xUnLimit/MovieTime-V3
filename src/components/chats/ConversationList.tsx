'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Input } from '@/components/ui/input';
import { cn } from '@/platform/utils/cn';
import { conversationTitle, formatChatTime } from './chat-format';

type ConversationListProps = {
  conversations: WhatsAppConversation[];
  selectedWaId: string | null;
  isLoading: boolean;
  now: Date;
  onSelect: (waId: string) => void;
};

export function ConversationList({ conversations, selectedWaId, isLoading, now, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) =>
      conversationTitle(conversation).toLowerCase().includes(term) || conversation.waId.includes(term.replace(/\D/g, '') || term)
    );
  }, [conversations, search]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative p-3">
        <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o número"
          aria-label="Buscar conversación"
          className="pl-9"
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Conversaciones">
        {isLoading ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Cargando conversaciones...</li>
        ) : filtered.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            {conversations.length === 0 ? 'Todavía no hay conversaciones.' : 'Sin resultados.'}
          </li>
        ) : (
          filtered.map((conversation) => {
            const selected = conversation.waId === selectedWaId;
            return (
              <li key={conversation.waId}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.waId)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60',
                    selected && 'bg-muted'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate', conversation.unreadCount > 0 && 'font-semibold')}>
                        {conversationTitle(conversation)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatChatTime(conversation.lastMessageAt, now)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-muted-foreground">
                        {conversation.lastDirection === 'outbound' ? 'Tú: ' : ''}
                        {conversation.lastPreview}
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <span
                          className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
                          aria-label={`${conversation.unreadCount} sin leer`}
                        >
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    {conversation.terceroId ? null : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">No registrado</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
