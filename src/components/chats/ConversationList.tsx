'use client';

import { forwardRef, type ReactNode } from 'react';
import { CalendarClock, MessageCircle, Search, UserPlus, X } from 'lucide-react';

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
  header?: ReactNode;
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
  { header, visible, totalCount, counts, search, filter, selectedWaId, isLoading, now, onSearchChange, onFilterChange, onSelect },
  searchRef
) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-chat-line-soft px-[21px] pb-4 pt-[26px]">
        {header}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-chat-quiet" aria-hidden />
          <Input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onSearchChange('');
              if (event.key === 'Enter' && visible[0]) onSelect(visible[0].waId);
            }}
            placeholder="Nombre, número o mensaje"
            aria-label="Buscar conversación"
            className="h-[43px] rounded-[11px] border-chat-line bg-chat-raised pl-10 pr-10 text-[16px] text-chat-ink shadow-none placeholder:text-chat-quiet focus-visible:border-chat-accent focus-visible:ring-0 sm:text-[13px]"
          />
          {search ? (
            <button type="button" onClick={() => onSearchChange('')} aria-label="Limpiar búsqueda" className="absolute right-1 top-1/2 flex h-[36px] w-[36px] -translate-y-1/2 items-center justify-center rounded-lg text-chat-quiet transition-colors hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-[5px] border border-chat-line px-[5px] py-px text-[11px] text-chat-quiet sm:inline">/</kbd>
          )}
        </div>
        <div className="-mx-1 flex gap-[7px] overflow-x-auto px-1 pb-0.5 pt-[15px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filtrar conversaciones">
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
                  'inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-chat-accent bg-chat-accent font-bold text-chat-accent-ink'
                    : 'border-chat-line bg-transparent text-chat-muted hover:bg-chat-hover hover:text-chat-ink'
                )}
              >
                {item.label}
                {count > 0 ? <span className="tabular-nums opacity-75">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-[21px] pb-2 pt-[15px] text-[11px] uppercase tracking-[0.05em] text-chat-quiet">
        <span>Recientes</span>
        <span className="tabular-nums">{isLoading ? '' : `${visible.length} de ${totalCount}`}</span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[9px] pb-3" aria-label="Conversaciones">
        {isLoading ? (
          Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="flex items-center gap-3 px-2.5 py-3" aria-hidden>
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </li>
          ))
        ) : visible.length === 0 ? (
          <li className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-chat-raised text-chat-quiet"><MessageCircle className="h-5 w-5" aria-hidden /></span>
            <p className="text-[14px] font-bold text-chat-ink">{totalCount === 0 ? 'Aún no hay conversaciones' : search ? 'Sin resultados' : 'Sin chats en este filtro'}</p>
            <p className="max-w-64 text-[12px] leading-relaxed text-chat-muted">
              {totalCount === 0
                ? 'Cuando un cliente escriba al número de WhatsApp, su chat aparecerá aquí.'
                : search ? `Ningún chat coincide con "${search}".` : 'No hay chats en este filtro.'}
            </p>
            {totalCount > 0 && (search || filter !== 'todos') ? (
              <button type="button" className="mt-2 min-h-[40px] rounded-md px-3 py-2 text-[13px] text-chat-accent underline underline-offset-4 hover:text-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { onSearchChange(''); onFilterChange('todos'); }}>
                Ver todas las conversaciones
              </button>
            ) : null}
          </li>
        ) : (
          visible.map((conversation) => {
            const selected = conversation.waId === selectedWaId;
            const unread = conversation.unreadCount > 0;
            const title = conversationTitle(conversation);
            const due = isDueSoon(conversation, now) ? dueLabel(conversation.nextExpiry, now) : null;
            return (
              <li key={conversation.waId} className="my-0.5">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.waId)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'grid min-h-[60px] w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-[11px] rounded-[11px] border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-chat-selected-line bg-chat-selected' : 'border-transparent hover:bg-chat-hover'
                  )}
                >
                  <ChatAvatar name={title} seed={conversation.waId} size="list" />
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-1.5">
                      <span className={cn('truncate text-[14px] leading-tight text-chat-ink', unread ? 'font-bold' : 'font-semibold')}>
                        {title}
                      </span>
                      {!conversation.terceroId ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-chat-quiet" title="No registrado">
                          <UserPlus className="h-2.5 w-2.5" aria-hidden /> No registrado
                        </span>
                      ) : null}
                    </span>
                    <span className={cn('mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] leading-snug', unread ? 'text-chat-ink' : 'text-chat-muted')}>
                      {due ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-chat-accent-strong">
                          <CalendarClock className="h-3 w-3" aria-hidden /> {due} ·
                        </span>
                      ) : null}
                      <span className="truncate">
                        {conversation.lastDirection === 'outbound' ? <span>Tú: </span> : null}
                        {conversation.lastPreview}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5 text-[11px] tabular-nums text-chat-quiet">
                    <span className={cn(unread && 'text-chat-accent')}>{formatChatTime(conversation.lastMessageAt, now)}</span>
                    {unread ? (
                      <span
                        className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-chat-accent px-[5px] text-[10px] font-extrabold text-chat-accent-ink"
                        aria-label={`${conversation.unreadCount} sin leer`}
                      >
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
});
