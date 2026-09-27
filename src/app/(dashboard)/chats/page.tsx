'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { ChatThread } from '@/components/chats/ChatThread';
import { ConversationList } from '@/components/chats/ConversationList';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useWhatsAppConversations } from '@/hooks/use-whatsapp-chat';
import { cn } from '@/platform/utils/cn';

const CLOCK_TICK_MS = 60_000;

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function ChatsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get('wa');
  const selectedWaId = requested && /^\d{8,15}$/.test(requested) ? requested : null;
  const { data: conversations = [], isLoading } = useWhatsAppConversations();
  const now = useNow();
  const selected = conversations.find((conversation) => conversation.waId === selectedWaId) ?? null;

  const select = (waId: string | null) => {
    router.replace(waId ? `/chats?wa=${waId}` : '/chats', { scroll: false });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Chats de WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/dashboard" className="transition-colors hover:text-foreground">Dashboard</Link>
          {' / '}
          <span className="text-foreground">Chats</span>
        </p>
      </div>

      <div className="grid h-[calc(100dvh-12rem)] min-h-[420px] overflow-hidden rounded-lg border bg-card md:grid-cols-[320px_1fr]">
        <section
          aria-label="Lista de conversaciones"
          className={cn('min-h-0 border-r', selected ? 'hidden md:block' : 'block')}
        >
          <ConversationList
            conversations={conversations}
            selectedWaId={selectedWaId}
            isLoading={isLoading}
            now={now}
            onSelect={select}
          />
        </section>

        <section aria-label="Conversación" className={cn('min-h-0', selected ? 'block' : 'hidden md:block')}>
          {selected ? (
            <ChatThread key={selected.waId} conversation={selected} now={now} onBack={() => select(null)} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {selectedWaId && !isLoading ? 'No se encontró esa conversación.' : 'Selecciona una conversación para verla.'}
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
