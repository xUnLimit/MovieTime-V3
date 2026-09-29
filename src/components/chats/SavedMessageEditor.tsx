'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { INTERACTIVE_LIMITS } from '@/modules/whatsapp/interactive-limits';
import { emptySavedMessageDraft, validateSavedMessageDraft, type SavedMessage, type SavedMessageDraft } from '@/modules/whatsapp/saved-messages';
import { cn } from '@/platform/utils/cn';
import { SavedMessagePreview } from './SavedMessagePreview';

type Props = {
  initial?: SavedMessage;
  onSave: (draft: SavedMessageDraft) => Promise<void>;
  onCancel: () => void;
};

const FIELD = 'w-full rounded-md border border-chat-line bg-chat-raised px-3 py-2 text-base text-chat-ink outline-none placeholder:text-chat-quiet focus:border-chat-accent focus-visible:ring-2 focus-visible:ring-chat-accent/25 sm:text-sm';
const KIND_OPTIONS = [
  { value: 'text', label: 'Solo texto' },
  { value: 'buttons', label: 'Con botones' },
  { value: 'list', label: 'Con lista' },
] as const;

export function SavedMessageEditor({ initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [kind, setKind] = useState<SavedMessageDraft['kind']>(initial?.kind ?? 'text');
  const [buttonLabel, setButtonLabel] = useState(initial?.buttonLabel || 'Ver opciones');
  const [buttonOptions, setButtonOptions] = useState(() => initial?.kind === 'buttons' ? initial.options : emptySavedMessageDraft().options);
  const [listOptions, setListOptions] = useState(() => initial?.kind === 'list' ? initial.options : emptySavedMessageDraft().options);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const interactive = kind !== 'text';
  const options = kind === 'buttons' ? buttonOptions : listOptions;
  const setOptions = kind === 'buttons' ? setButtonOptions : setListOptions;
  const maxOptions = kind === 'buttons' ? INTERACTIVE_LIMITS.maxButtons : INTERACTIVE_LIMITS.maxRows;
  const titleLimit = kind === 'buttons' ? INTERACTIVE_LIMITS.buttonTitle : INTERACTIVE_LIMITS.rowTitle;
  const draft: SavedMessageDraft = { title, kind, body, buttonLabel, options };

  const changeOption = (index: number, field: 'title' | 'description', value: string) => {
    setOptions((current) => current.map((option, position) => position === index ? { ...option, [field]: value } : option));
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateSavedMessageDraft(draft);
    if (!result.ok) { setError(result.error); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(result.value);
    } catch {
      setError('No se pudo guardar el mensaje. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        <div>
          <h3 className="text-base font-semibold text-chat-ink">{initial ? 'Editar mensaje' : 'Nuevo mensaje'}</h3>
          <p className="mt-1 text-xs text-chat-muted">Quedará disponible para el equipo en cualquier chat.</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between gap-2"><label htmlFor="saved-message-title" className="text-sm font-semibold text-chat-ink">Nombre para encontrarlo</label><span className="text-xs tabular-nums text-chat-muted">{title.length}/80</span></div>
          <input id="saved-message-title" value={title} maxLength={80} onChange={(event) => { setTitle(event.target.value); setError(null); }} placeholder="Ej. Bienvenida a nuevos clientes" className={FIELD} />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-chat-ink">Formato</legend>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-chat-line bg-chat-raised p-1">
            {KIND_OPTIONS.map((choice) => (
              <label key={choice.value} className={cn('flex min-h-10 cursor-pointer items-center justify-center rounded-md px-1 text-center text-xs font-semibold focus-within:ring-2 focus-within:ring-chat-accent sm:text-xs', kind === choice.value ? 'bg-chat-accent text-chat-accent-ink' : 'text-chat-muted hover:text-chat-ink')}>
                <input type="radio" name="saved-message-kind" value={choice.value} checked={kind === choice.value} onChange={() => { setKind(choice.value); setError(null); }} className="sr-only" />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <div className="flex justify-between gap-2"><label htmlFor="saved-message-body" className="text-sm font-semibold text-chat-ink">Texto del mensaje</label><span className={cn('text-xs tabular-nums', body.length > (interactive ? INTERACTIVE_LIMITS.body : 4096) ? 'text-destructive' : 'text-chat-muted')}>{body.length}/{interactive ? INTERACTIVE_LIMITS.body : 4096}</span></div>
          <textarea id="saved-message-body" value={body} maxLength={4096} rows={4} onChange={(event) => { setBody(event.target.value); setError(null); }} placeholder="Escribe lo que verá el cliente" className={cn(FIELD, 'min-h-24 resize-y')} />
        </div>

        {kind === 'list' ? <div className="space-y-2">
          <div className="flex justify-between gap-2"><label htmlFor="saved-message-list-label" className="text-sm font-semibold text-chat-ink">Botón que abre la lista</label><span className="text-xs tabular-nums text-chat-muted">{buttonLabel.length}/{INTERACTIVE_LIMITS.listLabel}</span></div>
          <input id="saved-message-list-label" value={buttonLabel} maxLength={INTERACTIVE_LIMITS.listLabel} onChange={(event) => { setButtonLabel(event.target.value); setError(null); }} className={FIELD} />
        </div> : null}

        {interactive ? <fieldset className="space-y-3 border-t border-chat-line-soft pt-5">
          <legend className="sr-only">{kind === 'buttons' ? 'Botones' : 'Opciones de la lista'}</legend>
          <div className="flex justify-between gap-2"><h4 className="text-sm font-semibold text-chat-ink">{kind === 'buttons' ? 'Botones' : 'Opciones de la lista'}</h4><span className="text-xs tabular-nums text-chat-muted">{options.length} de {maxOptions}</span></div>
          {options.map((option, index) => <div key={index} role="group" aria-label={`${kind === 'buttons' ? 'Botón' : 'Opción'} ${index + 1}`} className="flex items-start gap-2">
            <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-chat-raised text-xs font-semibold text-chat-muted" aria-hidden>{index + 1}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2"><input aria-label={`${kind === 'buttons' ? 'Botón' : 'Opción'} ${index + 1}`} value={option.title} maxLength={titleLimit} placeholder={kind === 'buttons' ? 'Ej. Confirmar' : 'Ej. Netflix 1 mes'} onChange={(event) => changeOption(index, 'title', event.target.value)} className={FIELD} /><span className="shrink-0 text-xs tabular-nums text-chat-muted">{option.title.length}/{titleLimit}</span></div>
              {kind === 'list' ? <div className="flex items-center gap-2"><input aria-label={`Descripción de la opción ${index + 1}`} value={option.description} maxLength={INTERACTIVE_LIMITS.rowDescription} placeholder="Descripción opcional" onChange={(event) => changeOption(index, 'description', event.target.value)} className={FIELD} /><span className="shrink-0 text-xs tabular-nums text-chat-muted">{option.description.length}/{INTERACTIVE_LIMITS.rowDescription}</span></div> : null}
            </div>
            {options.length > 1 ? <button type="button" aria-label={`Quitar ${kind === 'buttons' ? 'botón' : 'opción'} ${index + 1}`} onClick={() => { setOptions((current) => current.filter((_, position) => position !== index)); setError(null); }} className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md text-chat-muted hover:bg-chat-selected hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-4 w-4" aria-hidden /></button> : <span className="w-9 shrink-0" aria-hidden />}
          </div>)}
          <button type="button" disabled={options.length >= maxOptions} onClick={() => { setOptions((current) => [...current, { title: '', description: '' }]); setError(null); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-chat-accent-line px-3 text-xs font-semibold text-chat-accent-strong hover:bg-chat-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden />Agregar {kind === 'buttons' ? 'botón' : 'opción'}</button>
        </fieldset> : null}

        <SavedMessagePreview message={draft} />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-chat-line-soft px-5 py-3 sm:px-6">
        {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : <span />}
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onCancel} className="min-h-10 rounded-md px-3 text-sm font-medium text-chat-muted hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancelar</button>
          <button type="submit" disabled={saving} className="min-h-10 rounded-md bg-chat-accent px-4 text-sm font-semibold text-chat-accent-ink hover:bg-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45">{saving ? 'Guardando…' : 'Guardar mensaje'}</button>
        </div>
      </div>
    </form>
  );
}
