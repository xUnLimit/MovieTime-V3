import { List } from 'lucide-react';

import type { SavedMessageDraft } from '@/modules/whatsapp/saved-messages';
import { WhatsAppText } from './WhatsAppText';

export function SavedMessagePreview({ message }: { message: SavedMessageDraft }) {
  const options = message.options.filter((option) => option.title.trim());

  return (
    <div className="rounded-lg bg-chat-canvas p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-chat-muted">Vista previa</p>
      <div className="ml-auto w-fit max-w-full rounded-lg bg-chat-bubble-out px-3 py-2.5 text-sm leading-[1.5] text-chat-bubble-out-ink shadow-[0_2px_8px_rgb(0_0_0/0.12)]">
        <p className="whitespace-pre-wrap break-words">{message.body.trim() ? <WhatsAppText text={message.body} /> : <span className="text-chat-bubble-out-meta">Texto del mensaje</span>}</p>
        {message.kind === 'buttons' ? (
          <div className="mt-2 space-y-1">
            {(options.length ? options : [{ title: 'Botón', description: '' }]).map((option, index) => (
              <div key={index} className="rounded-md bg-black/5 px-2 py-1.5 text-center font-medium text-chat-accent-strong dark:bg-white/10">{option.title}</div>
            ))}
          </div>
        ) : message.kind === 'list' ? (
          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-black/5 px-2 py-1.5 font-medium text-chat-accent-strong dark:bg-white/10">
            <List className="h-3.5 w-3.5" aria-hidden />{message.buttonLabel.trim() || 'Ver opciones'}
          </div>
        ) : null}
      </div>
      {message.kind === 'list' ? <p className="mt-3 text-xs text-chat-muted">{options.length} {options.length === 1 ? 'opción' : 'opciones'} al abrir la lista.</p> : null}
    </div>
  );
}
