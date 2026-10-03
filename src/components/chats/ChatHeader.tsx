'use client';

import Link from 'next/link';
import { Archive, ArchiveRestore, ArrowLeft, Ellipsis, Mail, PanelRight, PanelRightClose, Pin, PinOff, Search, UserRound } from 'lucide-react';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/platform/utils/cn';
import { ChatAvatar } from './ChatAvatar';
import { ServiceTags } from './ServiceTags';
import { conversationTitle, formatWaId, type ServiceWindow } from './chat-format';

type ChatHeaderProps = {
  conversation: WhatsAppConversation;
  serviceWindow: ServiceWindow;
  panelOpen: boolean;
  searchOpen?: boolean;
  onBack: () => void;
  onTogglePanel: () => void;
  onMarkUnread: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onToggleSearch?: () => void;
};

const HEADER_ICON = 'grid h-[35px] w-[35px] shrink-0 place-items-center rounded-md text-chat-muted transition-colors hover:bg-chat-selected hover:text-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:w-10';
const HEADER_ICON_ACTIVE = 'bg-chat-selected text-chat-accent-strong';

export function ChatHeader({ conversation, serviceWindow, panelOpen, searchOpen = false, onBack, onTogglePanel, onMarkUnread, onTogglePin, onToggleArchive, onToggleSearch }: ChatHeaderProps) {
  const title = conversationTitle(conversation);

  return (
    <header className="flex min-h-[calc(68px+env(safe-area-inset-top))] shrink-0 items-center gap-[7px] border-b border-chat-line-soft bg-chat-surface px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:min-h-[calc(78px+env(safe-area-inset-top))] md:gap-3 md:px-[22px] md:pb-[13px] md:pt-[max(13px,env(safe-area-inset-top))]">
      <button type="button" className={cn(HEADER_ICON, 'md:hidden')} onClick={onBack} aria-label="Volver a la lista">
        <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={1.6} />
      </button>

      <button
        type="button"
        onClick={onTogglePanel}
        className="-ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:gap-3"
        aria-label={`Ver ficha de ${title}`}
      >
        <ChatAvatar name={title} seed={conversation.waId} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight text-chat-ink md:text-base">{title}</span>
          <span className="mt-[3px] flex min-w-0 items-center gap-2">
            <span className="truncate text-xs tabular-nums text-chat-muted">
              {formatWaId(conversation.waId)}
              {conversation.terceroId ? '' : ' · No registrado'}
            </span>
            <ServiceTags categories={conversation.activeCategories} max={3} className="hidden sm:flex" />
          </span>
        </span>
      </button>

      <span
        className={cn(
          'hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-[7px] text-xs sm:inline-flex',
          serviceWindow.open ? 'bg-chat-open text-chat-open-ink' : 'bg-chat-closed text-chat-closed-ink'
        )}
        title="WhatsApp permite texto libre durante 24 h desde el último mensaje del cliente"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {serviceWindow.open ? `Ventana abierta · ${serviceWindow.hoursLeft} h` : 'Ventana cerrada'}
      </span>

      {onToggleSearch ? (
        <button type="button" className={cn(HEADER_ICON, searchOpen && HEADER_ICON_ACTIVE)} onClick={onToggleSearch} aria-label={searchOpen ? 'Cerrar búsqueda en la conversación' : 'Buscar en la conversación'} aria-pressed={searchOpen}>
          <Search className="h-[19px] w-[19px]" strokeWidth={1.6} aria-hidden />
        </button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={HEADER_ICON} aria-label="Más opciones">
            <Ellipsis className="h-[19px] w-[19px]" strokeWidth={1.6} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="chat-menu min-w-[190px]">
          <DropdownMenuItem onSelect={onTogglePanel}>
            {panelOpen ? <PanelRightClose className="mr-2 h-4 w-4" aria-hidden /> : <PanelRight className="mr-2 h-4 w-4" aria-hidden />}
            {panelOpen ? 'Ocultar ficha del cliente' : 'Mostrar ficha del cliente'}
          </DropdownMenuItem>
          {conversation.terceroId ? (
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={`/terceros/${conversation.terceroId}`}>
                <UserRound className="mr-2 h-4 w-4" aria-hidden /> Abrir cliente
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem disabled={!conversation.lastInboundAt} onSelect={onMarkUnread}>
            <Mail className="mr-2 h-4 w-4" aria-hidden /> Marcar como no leído
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onTogglePin}>
            {conversation.pinnedAt ? <PinOff className="mr-2 h-4 w-4" aria-hidden /> : <Pin className="mr-2 h-4 w-4" aria-hidden />}
            {conversation.pinnedAt ? 'Desfijar conversación' : 'Fijar conversación'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleArchive}>
            {conversation.archived ? <ArchiveRestore className="mr-2 h-4 w-4" aria-hidden /> : <Archive className="mr-2 h-4 w-4" aria-hidden />}
            {conversation.archived ? 'Desarchivar conversación' : 'Archivar conversación'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
