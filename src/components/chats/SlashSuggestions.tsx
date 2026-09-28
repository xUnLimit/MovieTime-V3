'use client';

import { Zap } from 'lucide-react';

import { cn } from '@/platform/utils/cn';
import type { SlashItem } from './chat-slash';

type Props = {
  items: SlashItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (item: SlashItem) => void;
};

const KIND_LABELS = { text: 'Texto', buttons: 'Botones', list: 'Lista' } as const;

function preview(item: SlashItem): string {
  return item.kind === 'saved' ? item.message.body : item.body;
}

function tag(item: SlashItem): string {
  return item.kind === 'saved' ? KIND_LABELS[item.message.kind] : 'Sistema';
}

// Popup tipo Slack: aparece al escribir "/" en el composer, filtrado por lo
// que sigue. La navegación con flechas/Enter/Escape vive en ChatComposer para
// no robarle el foco al textarea.
export function SlashSuggestions({ items, activeIndex, onHover, onSelect }: Props) {
  if (items.length === 0) return null;
  const firstSystem = items.findIndex((item) => item.kind === 'system');

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
        {items.map((item, index) => (
          <li key={item.id}>
            {index === firstSystem ? (
              <p role="presentation" className="border-y border-chat-line-soft bg-chat-raised px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-chat-muted">Mensajes del sistema</p>
            ) : null}
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => onHover(index)}
              onClick={() => onSelect(item)}
              className={cn('flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left focus-visible:outline-none', index === activeIndex ? 'bg-chat-selected' : 'hover:bg-chat-hover')}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-chat-ink">{item.title}</span>
                <span className="shrink-0 text-[10px] text-chat-muted">{tag(item)}</span>
              </span>
              <span className="line-clamp-1 text-[12px] text-chat-muted">{preview(item)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
