'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const missingConversation = Boolean(selectedWaId && !selected && !isLoading);

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
    // El area de chats ocupa todo el contenido, sin el padding del layout, como en el prototipo.
    <div className="chats-surface -m-3 flex h-[calc(100%+1.5rem)] min-w-0 flex-col sm:-m-4 sm:h-[calc(100%+2rem)] md:-m-6 md:h-[calc(100%+3rem)]">
      {missingConversation ? <p role="status" className="border-b border-chat-line bg-chat-closed px-4 py-3 text-[13px] text-chat-closed-ink md:hidden">No se encontró esa conversación. Elige otro chat de la lista.</p> : null}
      <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(286px,350px)_minmax(0,1fr)]">
        <section
          aria-label="Lista de conversaciones"
          className={cn('min-h-0 border-chat-line bg-chat-inbox md:border-r', selected ? 'hidden md:block' : 'block')}
        >
          <ConversationList
            ref={searchRef}
            header={(
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-chat-accent">MovieTime PTY</p>
                <h1 className="mb-1 mt-2 font-editorial text-[34px] font-normal leading-[1.1] tracking-[-0.035em] md:text-[clamp(27px,2.3vw,35px)]">Conversaciones</h1>
                <p className="mb-5 text-[12px] leading-normal text-chat-muted">La atención, con toda la información a mano.</p>
              </>
            )}
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

        <section aria-label="Conversación" className={cn('min-h-0 min-w-0 bg-chat-canvas', selected ? 'block' : 'hidden md:block')}>
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
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_0%,var(--chat-glow)_0,var(--chat-canvas)_60%)] p-8 text-center">
              <span className="mb-1 flex h-16 w-16 items-center justify-center rounded-2xl border border-chat-accent-line bg-chat-accent-soft text-chat-accent-strong"><MessageCircle className="h-7 w-7" aria-hidden /></span>
              <h2 className="font-editorial text-[24px] font-normal tracking-[-0.02em]">{missingConversation ? 'Chat no disponible' : 'Selecciona una conversación'}</h2>
              <p className="max-w-sm text-[13px] leading-relaxed text-chat-muted">
                {missingConversation
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
