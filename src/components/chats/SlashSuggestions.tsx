'use client';

import { Zap } from 'lucide-react';

import type { SavedMessage } from '@/modules/whatsapp/saved-messages';
import { cn } from '@/platform/utils/cn';

type Props = {
  messages: SavedMessage[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (message: SavedMessage) => void;
};

const KIND_LABELS: Record<SavedMessage['kind'], string> = {
  text: 'Texto', buttons: 'Botones', list: 'Lista',
};

// Popup tipo Slack: aparece al escribir "/" en el composer, filtrado por lo
// que sigue. La navegación con flechas/Enter/Escape vive en ChatComposer para
// no robarle el foco al textarea.
export function SlashSuggestions({ messages, activeIndex, onHover, onSelect }: Props) {
  if (messages.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Respuestas rápidas"
      className="absolute inset-x-3 bottom-full z-10 mb-2 max-h-64 overflow-y-auto rounded-[11px] border border-chat-line bg-chat-raised shadow-[0_-8px_30px_rgb(0_0_0/0.25)] md:inset-x-[18px]"
    >
      <p className="sticky top-0 border-b border-chat-line-soft bg-chat-raised px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-chat-muted">
        <Zap className="mr-1.5 inline h-3 w-3 -translate-y-px" aria-hidden />Respuestas rápidas
      </p>
      <ul>
        {messages.map((message, index) => (
          <li key={message.id}>
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => onHover(index)}
              onClick={() => onSelect(message)}
              className={cn('flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left focus-visible:outline-none', index === activeIndex ? 'bg-chat-selected' : 'hover:bg-chat-hover')}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-chat-ink">{message.title}</span>
                <span className="shrink-0 text-[10px] text-chat-muted">{KIND_LABELS[message.kind]}</span>
              </span>
              <span className="line-clamp-1 text-[12px] text-chat-muted">{message.body}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
