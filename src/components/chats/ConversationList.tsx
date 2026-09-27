'use client';

import { forwardRef } from 'react';
import { CalendarClock, Search, UserPlus } from 'lucide-react';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/platform/utils/cn';
import { ChatAvatar } from './ChatAvatar';
import { conversationTitle, formatChatTime } from './chat-format';
import {
  CHAT_FILTERS,
  daysUntil,
  isDueSoon,
  parseDateOnly,
  type ChatFilter,
} from './conversation-filters';

type ConversationListProps = {
  visible: WhatsAppConversation[];
  totalCount: number;
  counts: Record<ChatFilter, number>;
  search: string;
  filter: ChatFilter;
  selectedWaId: string | null;
  isLoading: boolean;
  now: Date;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: ChatFilter) => void;
  onSelect: (waId: string) => void;
};

function dueLabel(nextExpiry: string | null, now: Date) {
  const expiry = parseDateOnly(nextExpiry);
  if (!expiry) return null;
  const days = daysUntil(expiry, now);
  if (days < 0) return 'Vencido';
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
}

export const ConversationList = forwardRef<HTMLInputElement, ConversationListProps>(function ConversationList(
  { visible, totalCount, counts, search, filter, selectedWaId, isLoading, now, onSearchChange, onFilterChange, onSelect },
  searchRef
) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b px-3 pb-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onSearchChange('');
              if (event.key === 'Enter' && visible[0]) onSelect(visible[0].waId);
            }}
            placeholder="Buscar nombre, número o mensaje"
            aria-label="Buscar conversación"
            className="h-9 bg-muted/40 pl-9 pr-10"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 text-[10px] text-muted-foreground sm:inline">/</kbd>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Filtrar conversaciones">
          {CHAT_FILTERS.map((item) => {
            const active = filter === item.id;
            const count = counts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={item.id !== 'todos' && count > 0 ? `${item.label} (${count})` : item.label}
                onClick={() => onFilterChange(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )}
              >
                {item.label}
                {item.id !== 'todos' && count > 0 ? (
                  <span className={cn('tabular-nums', active ? 'text-primary-foreground/80' : 'text-foreground/70')}>{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Conversaciones">
        {isLoading ? (
          Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="flex items-center gap-3 px-3 py-3" aria-hidden>
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </li>
          ))
        ) : visible.length === 0 ? (
          <li className="px-6 py-12 text-center text-sm text-muted-foreground">
            {totalCount === 0
              ? 'Cuando un cliente escriba al número de WhatsApp, su chat aparecerá aquí.'
              : search ? `Ningún chat coincide con "${search}".` : 'No hay chats en este filtro.'}
          </li>
        ) : (
          visible.map((conversation) => {
            const selected = conversation.waId === selectedWaId;
            const unread = conversation.unreadCount > 0;
            const title = conversationTitle(conversation);
            const due = isDueSoon(conversation, now) ? dueLabel(conversation.nextExpiry, now) : null;
            return (
              <li key={conversation.waId}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.waId)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:bg-muted focus-visible:outline-none',
                    selected ? 'bg-primary/10' : 'hover:bg-muted/60'
                  )}
                >
                  <ChatAvatar name={title} seed={conversation.waId} />
                  <div className="min-w-0 flex-1 border-b border-border/60 pb-2.5 group-last:border-b-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-[15px]', unread ? 'font-semibold text-foreground' : 'font-medium')}>
                        {title}
                      </span>
                      <span className={cn('shrink-0 text-xs tabular-nums', unread ? 'font-medium text-primary' : 'text-muted-foreground')}>
                        {formatChatTime(conversation.lastMessageAt, now)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn('truncate text-sm', unread ? 'text-foreground/90' : 'text-muted-foreground')}>
                        {conversation.lastDirection === 'outbound' ? <span className="text-muted-foreground">Tú: </span> : null}
                        {conversation.lastPreview}
                      </span>
                      {unread ? (
                        <span
                          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
                          aria-label={`${conversation.unreadCount} sin leer`}
                        >
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    {due || !conversation.terceroId ? (
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        {due ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <CalendarClock className="h-3 w-3" aria-hidden /> {due}
                          </span>
                        ) : null}
                        {!conversation.terceroId ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <UserPlus className="h-3 w-3" aria-hidden /> No registrado
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
});
