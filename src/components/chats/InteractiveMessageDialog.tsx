'use client';

import { useState } from 'react';
import { ChevronDown, LayoutList, List, MousePointerClick, Plus, Trash2 } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/platform/utils/cn';
import {
  INTERACTIVE_LIMITS,
  buildInteractiveMessage,
  emptyInteractiveDraft,
  type InteractiveDraft,
  type InteractiveSendMessage,
  type InteractiveType,
} from './chat-interactive';
import { WhatsAppText } from './WhatsAppText';

type InteractiveMessageDialogProps = {
  open: boolean;
  isSending: boolean;
  initialDraft?: InteractiveDraft;
  onOpenChange: (open: boolean) => void;
  onSend: (message: InteractiveSendMessage) => void;
};

const FIELD = 'w-full rounded-[9px] border border-chat-line bg-chat-raised px-3 py-2 text-base text-chat-ink outline-none transition-colors placeholder:text-chat-quiet focus:border-chat-accent focus-visible:ring-2 focus-visible:ring-chat-accent/25 sm:text-[13px]';

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn('shrink-0 text-[11px] tabular-nums', value.length > max ? 'text-destructive' : 'text-chat-quiet')}>{value.length}/{max}</span>;
}

// Remontar con una key nueva al abrir deja el formulario vacío.
export function InteractiveMessageDialog({ open, isSending, initialDraft, onOpenChange, onSend }: InteractiveMessageDialogProps) {
  const [type, setType] = useState<InteractiveType>(initialDraft?.type ?? 'buttons');
  const [drafts, setDrafts] = useState<Record<InteractiveType, InteractiveDraft>>(() => ({
    buttons: initialDraft?.type === 'buttons' ? initialDraft : emptyInteractiveDraft('buttons'),
    list: initialDraft?.type === 'list' ? initialDraft : emptyInteractiveDraft('list'),
  }));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = drafts[type];
  const isList = type === 'list';
  const maxOptions = isList ? INTERACTIVE_LIMITS.maxRows : INTERACTIVE_LIMITS.maxButtons;
  const titleLimit = isList ? INTERACTIVE_LIMITS.rowTitle : INTERACTIVE_LIMITS.buttonTitle;

  const update = (next: Partial<InteractiveDraft>) => {
    setDrafts((current) => ({ ...current, [type]: { ...current[type], ...next } }));
    setError(null);
  };
  const updateOption = (index: number, field: 'title' | 'description', value: string) =>
    update({ options: draft.options.map((option, current) => current === index ? { ...option, [field]: value } : option) });
  const switchType = (type: InteractiveType) => {
    setType(type);
    setError(null);
  };

  const submit = () => {
    const result = buildInteractiveMessage(draft);
    if (!result.ok) { setError(result.error); return; }
    onSend(result.message);
  };

  const filled = draft.options.filter((option) => option.title.trim());

  const preview = (
    <div className="w-fit max-w-full rounded-[7.5px] bg-chat-bubble-out px-3 py-2.5 text-[13.5px] leading-[19px] text-chat-bubble-out-ink shadow-[0_2px_8px_rgb(0_0_0/0.12)]">
      <p className="whitespace-pre-wrap break-words">{draft.body.trim() ? <WhatsAppText text={draft.body} /> : <span className="text-chat-quiet">Texto del mensaje</span>}</p>
      <div className="mt-2 space-y-1">
        {isList ? (
          <div className="flex items-center justify-center gap-1.5 rounded-md bg-black/5 px-2 py-1.5 text-[13px] font-medium text-chat-accent-strong dark:bg-white/10"><List className="h-3.5 w-3.5" aria-hidden />{draft.buttonLabel.trim() || 'Ver opciones'}</div>
        ) : (filled.length ? filled : [{ title: 'Botón', description: '' }]).map((option, index) => (
          <div key={index} className="rounded-md bg-black/5 px-2 py-1.5 text-center text-[13px] font-medium text-chat-accent-strong dark:bg-white/10">{option.title}</div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="chats-surface flex h-[min(90dvh,760px)] flex-col gap-0 overflow-hidden border-chat-line bg-chat-surface p-0 text-chat-ink sm:max-w-[880px]">
        <DialogHeader className="shrink-0 gap-1 border-b border-chat-line-soft px-5 pb-4 pt-5 text-left sm:px-6">
          <DialogTitle className="pr-8 font-editorial text-[21px] font-normal leading-tight">Mensaje con botones o lista</DialogTitle>
          <DialogDescription className="max-w-[65ch] text-[13px] leading-relaxed text-chat-muted">El cliente responde tocando una opción. Solo se puede enviar mientras la ventana de 24 horas está abierta.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.8fr)] md:overflow-hidden">
          <aside aria-label="Vista previa" className="order-1 shrink-0 border-b border-chat-line-soft bg-chat-canvas px-5 py-3 md:order-2 md:overflow-y-auto md:border-b-0 md:border-l md:px-6 md:py-6">
            <button type="button" aria-expanded={previewOpen} aria-controls="interactive-preview-content" onClick={() => setPreviewOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-md py-1 text-left text-[13px] font-semibold text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
              Vista previa <ChevronDown className={cn('h-4 w-4 transition-transform', previewOpen && 'rotate-180')} aria-hidden />
            </button>
            <h3 className="hidden text-[13px] font-semibold text-chat-ink md:block">Vista previa</h3>
            <div id="interactive-preview-content" className={cn(previewOpen ? 'block' : 'hidden', 'md:block')}>
              <p className="mt-0.5 text-[12px] text-chat-muted">Así verá el cliente tu mensaje.</p>
              <div className="mt-4 flex justify-end">{preview}</div>
              {isList ? <p className="mt-4 text-[11px] leading-relaxed text-chat-muted">Las opciones se muestran al tocar «{draft.buttonLabel.trim() || 'Ver opciones'}».</p> : null}
            </div>
          </aside>

          <div className="order-2 min-h-0 px-5 py-5 md:order-1 md:overflow-y-auto md:px-6 md:py-6">
            <div role="radiogroup" aria-label="Tipo de mensaje" className="mb-5 grid grid-cols-2 gap-1 rounded-[10px] border border-chat-line bg-chat-raised p-1">
              {(['buttons', 'list'] as const).map((choice) => (
                <label key={choice} className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[7px] px-2 text-[13px] font-semibold transition-colors focus-within:ring-2 focus-within:ring-chat-accent',
                  type === choice ? 'bg-chat-accent text-chat-accent-ink' : 'text-chat-muted hover:text-chat-ink'
                )}>
                  <input type="radio" name="interactive-type" value={choice} checked={type === choice} onChange={() => switchType(choice)} className="sr-only" />
                  {choice === 'buttons' ? <MousePointerClick className="h-4 w-4 shrink-0" aria-hidden /> : <LayoutList className="h-4 w-4 shrink-0" aria-hidden />}
                  <span>{choice === 'buttons' ? 'Botones' : 'Lista'}</span>
                  <span className={cn('text-[11px] font-medium', type === choice ? 'text-chat-accent-ink/80' : 'text-chat-quiet')}>hasta {choice === 'buttons' ? INTERACTIVE_LIMITS.maxButtons : INTERACTIVE_LIMITS.maxRows}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between"><label htmlFor="interactive-body" className="text-[13px] font-semibold text-chat-ink">Texto del mensaje</label><Counter value={draft.body} max={INTERACTIVE_LIMITS.body} /></div>
              <textarea id="interactive-body" rows={4} value={draft.body} onChange={(event) => update({ body: event.target.value })} placeholder="Escribe el mensaje que verá el cliente" className={cn(FIELD, 'min-h-24 resize-y')} />
            </div>

            {isList ? (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between"><label htmlFor="interactive-label" className="text-[13px] font-semibold text-chat-ink">Botón para abrir la lista</label><Counter value={draft.buttonLabel} max={INTERACTIVE_LIMITS.listLabel} /></div>
                <input id="interactive-label" value={draft.buttonLabel} onChange={(event) => update({ buttonLabel: event.target.value })} className={FIELD} />
              </div>
            ) : null}

            <fieldset className="mt-6 border-t border-chat-line-soft pt-5">
              <legend className="sr-only">{isList ? 'Opciones de la lista' : 'Botones de respuesta'}</legend>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] font-semibold text-chat-ink">{isList ? 'Opciones de la lista' : 'Botones de respuesta'}</h3>
                <span className="text-[11px] tabular-nums text-chat-muted">{draft.options.length} de {maxOptions}</span>
              </div>
              <div className="space-y-3">
                {draft.options.map((option, index) => (
                  <div key={index} role="group" aria-label={`${isList ? 'Opción' : 'Botón'} ${index + 1}`} className="flex items-start gap-2">
                    <span className="mt-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-chat-raised text-[11px] font-semibold tabular-nums text-chat-muted" aria-hidden>{index + 1}</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input aria-label={`${isList ? 'Opción' : 'Botón'} ${index + 1}`} value={option.title} placeholder={isList ? 'Ej. Netflix 1 mes' : 'Ej. Ya pagué'}
                          onChange={(event) => updateOption(index, 'title', event.target.value)} className={cn(FIELD, 'h-10 py-0')} />
                        <Counter value={option.title} max={titleLimit} />
                      </div>
                      {isList ? <div className="flex items-center gap-2">
                        <input aria-label={`Descripción de la opción ${index + 1}`} value={option.description} placeholder="Descripción opcional"
                          onChange={(event) => updateOption(index, 'description', event.target.value)} className={cn(FIELD, 'h-9 py-0')} />
                        <Counter value={option.description} max={INTERACTIVE_LIMITS.rowDescription} />
                      </div> : null}
                    </div>
                    {draft.options.length > 1 ? <button type="button" aria-label={`Quitar ${isList ? 'opción' : 'botón'} ${index + 1}`}
                      onClick={() => update({ options: draft.options.filter((_, current) => current !== index) })}
                      className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-[7px] text-chat-muted transition-colors hover:bg-chat-selected hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button> : <span className="w-9 shrink-0" aria-hidden />}
                  </div>
                ))}
              </div>
              <button type="button" disabled={draft.options.length >= maxOptions}
                onClick={() => update({ options: [...draft.options, { title: '', description: '' }] })}
                className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-[9px] border border-chat-accent-line px-3 py-2 text-[12px] font-semibold text-chat-accent-strong transition-colors hover:bg-chat-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40">
                <Plus className="h-3.5 w-3.5" aria-hidden /> {isList ? 'Agregar opción' : 'Agregar botón'}
              </button>
            </fieldset>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-chat-line-soft px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {error ? <p role="alert" className="text-[12.5px] font-medium text-destructive">{error}</p> : <p className="hidden text-[11px] text-chat-muted sm:block">Revisa el mensaje antes de enviarlo.</p>}
          <div className="flex shrink-0 justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="min-h-10 rounded-[9px] px-4 py-2 text-[13px] font-medium text-chat-muted transition-colors hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancelar</button>
            <button type="button" disabled={isSending} onClick={submit} className="min-h-10 rounded-[9px] bg-chat-accent px-4 py-2 text-[13px] font-bold text-chat-accent-ink transition-colors hover:bg-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45">{isSending ? 'Enviando…' : 'Enviar mensaje'}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
