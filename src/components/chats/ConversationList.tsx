'use client';

import { forwardRef, type ReactNode } from 'react';
import { CalendarClock, ChevronDown, MessageCircle, Pin, Search, UserPlus, X } from 'lucide-react';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/platform/utils/cn';
import { ChatAvatar } from './ChatAvatar';
import { ServiceTags } from './ServiceTags';
import { conversationTitle, formatChatTime } from './chat-format';
import {
  categoryFilterId,
  CHAT_FIXED_FILTERS,
  CHAT_MORE_FILTERS,
  daysUntil,
  isDueSoon,
  parseDateOnly,
  type ChatFilter,
} from './conversation-filters';

type ConversationListProps = {
  header?: ReactNode;
  visible: WhatsAppConversation[];
  totalCount: number;
  counts: Record<string, number>;
  categories: string[];
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
  { header, visible, totalCount, counts, categories, search, filter, selectedWaId, isLoading, now, onSearchChange, onFilterChange, onSelect },
  searchRef
) {
  const moreItems = [...CHAT_MORE_FILTERS, ...categories.map((name) => ({ id: categoryFilterId(name), label: name }))];
  const activeMoreItem = moreItems.find((item) => item.id === filter) ?? null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-chat-line-soft px-3 pb-3 pt-3 sm:px-4 sm:pt-4 md:px-5 md:pt-[max(1.25rem,env(safe-area-inset-top))]">
        {header}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-chat-quiet" aria-hidden />
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
            className="border-chat-line bg-transparent pl-9 pr-9 text-chat-ink shadow-none placeholder:text-chat-quiet focus-visible:border-chat-accent focus-visible:ring-0"
          />
          {search ? (
            <button type="button" onClick={() => onSearchChange('')} aria-label="Limpiar búsqueda" className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-chat-quiet transition-colors hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-sm border border-chat-line px-[5px] py-px text-xs text-chat-quiet sm:inline">/</kbd>
          )}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar conversaciones">
          {CHAT_FIXED_FILTERS.map((item) => {
            const active = filter === item.id;
            const count = counts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                aria-label={item.id !== 'todos' && count > 0 ? `${item.label} (${count})` : item.label}
                onClick={() => onFilterChange(item.id)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2.5 text-xs pointer-coarse:h-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-chat-selected-line bg-chat-selected font-semibold text-chat-ink'
                    : 'border-chat-line bg-transparent text-chat-muted hover:bg-chat-hover hover:text-chat-ink'
                )}
              >
                {item.label}
                {count > 0 ? <span className="tabular-nums opacity-75">{count}</span> : null}
              </button>
            );
          })}
          {moreItems.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={activeMoreItem ? `${activeMoreItem.label} (más filtros)` : 'Más filtros'}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2.5 text-xs pointer-coarse:h-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    activeMoreItem
                      ? 'border-chat-selected-line bg-chat-selected font-semibold text-chat-ink'
                      : 'border-chat-line bg-transparent text-chat-muted hover:bg-chat-hover hover:text-chat-ink'
                  )}
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="chat-menu w-56">
                {moreItems.map((item) => {
                  const count = counts[item.id];
                  return (
                    <DropdownMenuItem key={item.id} onSelect={() => onFilterChange(item.id)} className={cn(filter === item.id && 'font-semibold text-chat-accent-strong')}>
                      <span className="flex w-full items-center justify-between gap-2">
                        {item.label}
                        {count > 0 ? <span className="tabular-nums text-chat-muted">{count}</span> : null}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {activeMoreItem ? (
          <div className="pt-2">
            <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-chat-selected-line bg-chat-selected pl-2.5 pr-1 text-xs text-chat-ink">
              <span className="truncate font-semibold">{activeMoreItem.label}</span>
              {counts[activeMoreItem.id] > 0 ? <span className="shrink-0 tabular-nums opacity-75">{counts[activeMoreItem.id]}</span> : null}
              <button
                type="button"
                onClick={() => onFilterChange('todos')}
                aria-label={`Quitar filtro ${activeMoreItem.label}`}
                className="grid size-5 shrink-0 place-items-center rounded-sm transition-colors hover:bg-chat-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-8"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-3 text-xs uppercase tracking-wide text-chat-quiet">
        <span>Recientes</span>
        <span className="tabular-nums">{isLoading ? '' : `${visible.length} de ${totalCount}`}</span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-label="Conversaciones">
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
            <p className="text-sm font-semibold text-chat-ink">{totalCount === 0 ? 'Aún no hay conversaciones' : search ? 'Sin resultados' : filter === 'archivados' ? 'No hay chats archivados' : 'Sin chats en este filtro'}</p>
            <p className="max-w-64 text-xs leading-relaxed text-chat-muted">
              {totalCount === 0
                ? 'Cuando un cliente escriba al número de WhatsApp, su chat aparecerá aquí.'
                : search ? `Ningún chat coincide con "${search}".`   : filter === 'archivados' ? 'Los chats archivados aparecen aquí y vuelven a la bandeja cuando el cliente escribe.' : 'No hay chats en este filtro.'}
            </p>
            {totalCount > 0 && (search || filter !== 'todos') ? (
              <button type="button" className="mt-2 min-h-[40px] rounded-md px-3 py-2 text-sm text-chat-accent underline underline-offset-4 hover:text-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { onSearchChange(''); onFilterChange('todos'); }}>
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
                    'grid min-h-14 w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-chat-selected-line bg-chat-selected' : 'border-transparent hover:bg-chat-hover'
                  )}
                >
                  <ChatAvatar name={title} seed={conversation.waId} size="list" />
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-1.5">
                      <span className={cn('truncate text-sm leading-tight text-chat-ink', unread ? 'font-semibold' : 'font-semibold')}>
                        {title}
                      </span>
                      {!conversation.terceroId ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-chat-quiet" title="No registrado">
                          <UserPlus className="h-2.5 w-2.5" aria-hidden /> No registrado
                        </span>
                      ) : null}
                    </span>
                    <span className={cn('mt-0.5 flex items-center gap-1.5 truncate text-xs leading-snug', unread ? 'text-chat-ink' : 'text-chat-muted')}>
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
                    <ServiceTags categories={conversation.activeCategories} className="mt-1" />
                  </span>
                  <span className="flex flex-col items-end gap-1.5 text-xs tabular-nums text-chat-quiet">
                    <span className={cn(unread && 'text-chat-accent')}>{formatChatTime(conversation.lastMessageAt, now)}</span>
                    {conversation.pinnedAt && !unread ? <Pin className="size-3.5 text-chat-quiet" aria-label="Fijado" /> : null}
                    {unread ? (
                      <span
                        className="grid h-5 min-w-5 place-items-center rounded-full bg-chat-accent px-1.5 text-xs font-semibold text-chat-accent-ink"
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
