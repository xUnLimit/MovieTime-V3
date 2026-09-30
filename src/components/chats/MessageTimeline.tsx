'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, MessageSquareText } from 'lucide-react';

import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Skeleton } from '@/components/ui/skeleton';
import { buildTimeline } from './chat-timeline';
import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { groupReactions } from './chat-reactions';
import { buildTemplateContent, templatePreview } from './chat-template-content';
import { useReactionOrder } from './use-reaction-order';
import { searchMessages } from './chat-search';
import { MessageBubble } from './MessageBubble';

type MessageTimelineProps = {
  messages: WhatsAppChatMessage[];
  isLoading: boolean;
  unreadCount: number;
  now: Date;
  searchQuery?: string;
  matchIds?: string[];
  activeMatchIndex?: number;
  metaTemplates?: readonly MetaTemplateInfo[];
  onReply?: (message: WhatsAppChatMessage) => void;
  onReact?: (message: WhatsAppChatMessage, emoji: string) => void;
  onForward?: (message: WhatsAppChatMessage) => void;
  onRetry?: (message: WhatsAppChatMessage) => void;
  onHide?: (message: WhatsAppChatMessage) => void;
  onOpenImage?: (message: WhatsAppChatMessage, objectUrl: string) => void;
  onSaveSticker?: (message: WhatsAppChatMessage) => void;
  canRetry?: (message: WhatsAppChatMessage) => boolean;
};

// Distancia al final (px) dentro de la cual se sigue "pegado" a los mensajes nuevos.
const STICKY_THRESHOLD = 120;

export function MessageTimeline({ messages, isLoading, unreadCount, now, searchQuery = '', matchIds, activeMatchIndex = 0, metaTemplates = [], onReply, onReact, onForward, onRetry, onHide, onOpenImage, onSaveSticker, canRetry }: MessageTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { emojis: reactionEmojis, record: recordReaction } = useReactionOrder();
  const stickToBottom = useRef(true);
  const seenCount = useRef(messages.length);
  const [unseen, setUnseen] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  // El aviso de no leidos se fija al abrir el chat; no se mueve mientras se lee.
  const [openingUnread] = useState(unreadCount);
  const visibleMessages = useMemo(() => messages.filter((message) => message.kind !== 'reaction'), [messages]);
  const items = useMemo(() => buildTimeline(visibleMessages, now, openingUnread), [visibleMessages, now, openingUnread]);
  const reactions = useMemo(() => groupReactions(messages), [messages]);
  // Las citas de una plantilla muestran su texto (no solo "Plantilla: nombre").
  const quoteLookup = useMemo(() => visibleMessages.reduce<Record<string, WhatsAppChatMessage>>((lookup, message) => {
    if (!message.waMessageId) return lookup;
    const content = message.templateName ? buildTemplateContent(message.templateName, message.templateParams, metaTemplates) : null;
    lookup[message.waMessageId] = content ? { ...message, textBody: templatePreview(content) } : message;
    return lookup;
  }, {}), [visibleMessages, metaTemplates]);
  const matches = useMemo(() => matchIds ?? searchMessages(visibleMessages, searchQuery), [matchIds, visibleMessages, searchQuery]);
  const activeId = searchQuery.trim() ? matches[activeMatchIndex] : undefined;

  useEffect(() => {
    if (!activeId) return;
    const target = Array.from(scrollRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []).find((item) => item.dataset.messageId === activeId);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeId]);

  const scrollToBottom = (behavior: ScrollBehavior) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    stickToBottom.current = true;
    setAtBottom(true);
    setUnseen(0);
  };

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const divider = element.querySelector('[data-unread-divider]');
    if (divider instanceof HTMLElement) {
      element.scrollTop = Math.max(0, divider.offsetTop - 24);
      stickToBottom.current = false;
    } else {
      element.scrollTop = element.scrollHeight;
    }
    // Solo al montar: la posicion inicial respeta el primer mensaje sin leer.
  }, [isLoading]);

  useEffect(() => {
    const added = messages.length - seenCount.current;
    seenCount.current = messages.length;
    if (added <= 0) return;
    const lastIsMine = messages[messages.length - 1]?.direction === 'outbound';
    if (stickToBottom.current || lastIsMine) {
      requestAnimationFrame(() => scrollToBottom(lastIsMine ? 'smooth' : 'auto'));
    } else {
      setUnseen((count) => count + added);
    }
  }, [messages]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < STICKY_THRESHOLD;
          stickToBottom.current = bottom;
          setAtBottom(bottom);
          if (bottom) setUnseen(0);
        }}
        className="h-full overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_0%,var(--chat-glow)_0,var(--chat-canvas)_60%)] pb-[22px] pt-[17px] md:pb-[25px] md:pt-[22px]"
      >
        {isLoading ? (
          <div className="space-y-3 px-6 py-4" aria-hidden>
            <Skeleton className="h-10 w-2/5 rounded-2xl" />
            <Skeleton className="ml-auto h-14 w-1/2 rounded-2xl" />
            <Skeleton className="h-8 w-1/3 rounded-2xl" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-chat-raised text-chat-quiet"><MessageSquareText className="h-5 w-5" aria-hidden /></span>
            <p className="text-sm font-semibold text-chat-ink">Aún no hay mensajes en esta conversación.</p>
            <p className="max-w-64 text-sm text-chat-muted">Los mensajes aparecerán aquí cuando se inicie el chat.</p>
          </div>
        ) : (
          <ol aria-label="Mensajes" className="flex min-h-full flex-col justify-end pb-2">
            {items.map((item) => {
              if (item.type === 'day') {
                return (
                  <li key={item.key} className="sticky top-1 z-10 flex justify-center py-2">
                    <span className="rounded-lg bg-chat-raised px-3 py-1 text-xs font-medium text-chat-muted shadow-sm">{item.label}</span>
                  </li>
                );
              }
              if (item.type === 'unread') {
                return (
                  <li key={item.key} data-unread-divider className="mx-3 my-3 flex justify-center rounded-lg border border-chat-accent-line bg-chat-accent-soft py-1.5 sm:mx-6">
                    <span className="text-xs font-semibold text-chat-accent-strong">
                      {item.count === 1 ? '1 mensaje sin leer' : `${item.count} mensajes sin leer`}
                    </span>
                  </li>
                );
              }
              return <MessageBubble key={item.key} message={item.message} continued={item.continued} quotedByWaMessageId={quoteLookup} reactions={item.message.waMessageId ? reactions.get(item.message.waMessageId) : undefined} templateContent={item.message.templateName ? buildTemplateContent(item.message.templateName, item.message.templateParams, metaTemplates) : null} highlighted={Boolean(searchQuery.trim() && matches.includes(item.message.id))} activeMatch={item.message.id === activeId} reactionEmojis={reactionEmojis} onReply={onReply} onReact={onReact && ((message, emoji) => { recordReaction(emoji); onReact(message, emoji); })} onForward={onForward} onRetry={onRetry} onHide={onHide} onOpenImage={onOpenImage} onSaveSticker={onSaveSticker} canRetry={canRetry} />;
            })}
          </ol>
        )}
      </div>

      {unseen > 0 || !atBottom ? (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          aria-label={unseen > 0 ? `Ir a ${unseen} mensajes nuevos` : 'Ir al final'}
          className="absolute bottom-3 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-chat-line bg-chat-raised text-chat-ink shadow-[0_14px_42px_rgb(0_0_0/0.35)] transition-[transform,background-color] duration-150 ease-out hover:bg-chat-hover active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDown className="h-5 w-5" aria-hidden />
          {unseen > 0 ? (
            <span className="absolute -right-1 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-chat-accent px-1 text-xs font-semibold text-chat-accent-ink">
              {unseen}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
