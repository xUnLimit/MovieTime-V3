'use client';

import Link from 'next/link';
import { ArrowLeft, Clock3, EllipsisVertical, Mail, PanelRight, Search, UserRound } from 'lucide-react';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/platform/utils/cn';
import { ChatAvatar } from './ChatAvatar';
import { conversationTitle, formatWaId, type ServiceWindow } from './chat-format';

type ChatHeaderProps = {
  conversation: WhatsAppConversation;
  serviceWindow: ServiceWindow;
  panelOpen: boolean;
  onBack: () => void;
  onTogglePanel: () => void;
  onMarkUnread: () => void;
  onToggleSearch?: () => void;
};

export function ChatHeader({ conversation, serviceWindow, panelOpen, onBack, onTogglePanel, onMarkUnread, onToggleSearch }: ChatHeaderProps) {
  const title = conversationTitle(conversation);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-2 sm:px-3">
      <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Volver a la lista">
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <button
        type="button"
        onClick={onTogglePanel}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver ficha de ${title}`}
      >
        <ChatAvatar name={title} seed={conversation.waId} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-semibold leading-tight">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {formatWaId(conversation.waId)}
            {conversation.terceroId ? '' : ' · No registrado'}
          </span>
        </span>
      </button>

      <span
        className={cn(
          'hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex',
          serviceWindow.open ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
        )}
        title="WhatsApp permite texto libre durante 24 h desde el último mensaje del cliente"
      >
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
        {serviceWindow.open ? `Ventana ${serviceWindow.hoursLeft} h` : 'Ventana cerrada'}
      </span>

      <Button
        type="button"
        variant={panelOpen ? 'secondary' : 'ghost'}
        size="icon"
        className="hidden md:inline-flex"
        onClick={onTogglePanel}
        aria-label={panelOpen ? 'Ocultar ficha del cliente' : 'Mostrar ficha del cliente'}
        aria-pressed={panelOpen}
      >
        <PanelRight className="h-5 w-5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Más opciones">
            <EllipsisVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onToggleSearch}><Search className="mr-2 h-4 w-4" aria-hidden /> Buscar en la conversación</DropdownMenuItem>
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
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
