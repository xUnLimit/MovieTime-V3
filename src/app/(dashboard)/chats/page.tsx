'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

import { ChatWorkspace } from '@/components/chats/ChatWorkspace';
import { ConversationList } from '@/components/chats/ConversationList';
import {
  countByFilter,
  matchesFilter,
  matchesSearch,
  type ChatFilter,
} from '@/components/chats/conversation-filters';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useWhatsAppConversations } from '@/hooks/use-whatsapp-chat';
import { cn } from '@/platform/utils/cn';

const CLOCK_TICK_MS = 60_000;
const PANEL_STORAGE_KEY = 'chats:panel-open';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// Preferencia por dispositivo; si el almacenamiento falla se usa el valor por defecto.
function usePanelPreference() {
  const [open, setOpen] = useState(() => {
    try {
      return typeof window === 'undefined' || window.localStorage.getItem(PANEL_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const update = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(PANEL_STORAGE_KEY, String(next));
    } catch {
      // Sin almacenamiento la preferencia solo dura en esta sesion.
    }
  };
  return [open, update] as const;
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function ChatsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get('wa');
  const selectedWaId = requested && /^\d{8,15}$/.test(requested) ? requested : null;
  const { data: conversations = [], isLoading } = useWhatsAppConversations();
  const now = useNow();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('todos');
  const [panelPreferred, setPanelPreferred] = usePanelPreference();
  const searchRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => countByFilter(conversations, now), [conversations, now]);
  const visible = useMemo(
    () => conversations.filter((item) => matchesFilter(item, filter, now) && matchesSearch(item, search)),
    [conversations, filter, now, search]
  );
  const selected = conversations.find((conversation) => conversation.waId === selectedWaId) ?? null;

  const select = useCallback((waId: string | null) => {
    router.replace(waId ? `/chats?wa=${waId}` : '/chats', { scroll: false });
  }, [router]);

  // Atajos: "/" busca, Alt+Flechas cambia de chat y Escape cierra el chat abierto.
  useEffect(() => {
    const state = { visible, selectedWaId, select };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && state.visible.length > 0) {
        event.preventDefault();
        const index = state.visible.findIndex((item) => item.waId === state.selectedWaId);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const next = index === -1 ? 0 : Math.min(Math.max(index + step, 0), state.visible.length - 1);
        state.select(state.visible[next].waId);
        return;
      }
      if (event.key === 'Escape' && state.selectedWaId && !isTypingTarget(event.target) && !document.querySelector('[role="dialog"]')) {
        state.select(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [select, selectedWaId, visible]);

  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      {/* En el celular, con un chat abierto, el encabezado se oculta para dar espacio a la conversación. */}
      <div className={cn('space-y-1', selected && 'hidden md:block')}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Chats de WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/dashboard" className="transition-colors hover:text-foreground">Dashboard</Link>
          {' / '}
          <span className="text-foreground">Chats</span>
        </p>
      </div>
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border bg-background md:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <section
          aria-label="Lista de conversaciones"
          className={cn('min-h-0 border-r', selected ? 'hidden md:block' : 'block')}
        >
          <ConversationList
            ref={searchRef}
            visible={visible}
            totalCount={conversations.length}
            counts={counts}
            search={search}
            filter={filter}
            selectedWaId={selectedWaId}
            isLoading={isLoading}
            now={now}
            onSearchChange={setSearch}
            onFilterChange={setFilter}
            onSelect={select}
          />
        </section>

        <section aria-label="Conversación" className={cn('min-h-0 min-w-0', selected ? 'block' : 'hidden md:block')}>
          {selected ? (
            <ChatWorkspace
              key={selected.waId}
              conversation={selected}
              conversations={conversations}
              now={now}
              panelPreferred={panelPreferred}
              onPanelPreferredChange={setPanelPreferred}
              onBack={() => select(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/25 p-8 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/60" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">
                {selectedWaId && !isLoading
                  ? 'No se encontró esa conversación.'
                  : 'Elige un chat para responder. Con Alt + ↑/↓ cambias de chat y con / buscas.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ChatsPage() {
  return (
    <ModuleErrorBoundary moduleName="Chats">
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando...</div>}>
        <ChatsPageContent />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
