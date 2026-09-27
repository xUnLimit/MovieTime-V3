'use client';

import { useState } from 'react';
import { List, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  onOpenChange: (open: boolean) => void;
  onSend: (message: InteractiveSendMessage) => void;
};

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn('text-[11px] tabular-nums', value.length > max ? 'text-destructive' : 'text-muted-foreground')}>{value.length}/{max}</span>;
}

// Remontar con una key nueva al abrir deja el formulario vacío.
export function InteractiveMessageDialog({ open, isSending, onOpenChange, onSend }: InteractiveMessageDialogProps) {
  const [draft, setDraft] = useState<InteractiveDraft>(() => emptyInteractiveDraft('buttons'));
  const [error, setError] = useState<string | null>(null);
  const isList = draft.type === 'list';
  const maxOptions = isList ? INTERACTIVE_LIMITS.maxRows : INTERACTIVE_LIMITS.maxButtons;
  const titleLimit = isList ? INTERACTIVE_LIMITS.rowTitle : INTERACTIVE_LIMITS.buttonTitle;

  const update = (next: Partial<InteractiveDraft>) => { setDraft((current) => ({ ...current, ...next })); setError(null); };
  const updateOption = (index: number, field: 'title' | 'description', value: string) =>
    update({ options: draft.options.map((option, current) => current === index ? { ...option, [field]: value } : option) });
  const switchType = (type: InteractiveType) => {
    if (type === draft.type) return;
    const limit = type === 'list' ? INTERACTIVE_LIMITS.maxRows : INTERACTIVE_LIMITS.maxButtons;
    update({ type, buttonLabel: draft.buttonLabel || emptyInteractiveDraft(type).buttonLabel, options: draft.options.slice(0, limit) });
  };

  const submit = () => {
    const result = buildInteractiveMessage(draft);
    if (!result.ok) { setError(result.error); return; }
    onSend(result.message);
  };

  const filled = draft.options.filter((option) => option.title.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mensaje con botones o lista</DialogTitle>
          <DialogDescription>El cliente responde tocando una opción. Solo se puede enviar mientras la ventana de 24 horas está abierta.</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Tipo de mensaje" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['buttons', 'list'] as const).map((type) => (
            <button key={type} type="button" role="radio" aria-checked={draft.type === type} onClick={() => switchType(type)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                draft.type === type ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {type === 'buttons' ? `Botones (hasta ${INTERACTIVE_LIMITS.maxButtons})` : `Lista (hasta ${INTERACTIVE_LIMITS.maxRows})`}
            </button>
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><Label htmlFor="interactive-body">Texto del mensaje</Label><Counter value={draft.body} max={INTERACTIVE_LIMITS.body} /></div>
              <Textarea id="interactive-body" rows={3} value={draft.body} onChange={(event) => update({ body: event.target.value })} placeholder="¿Qué deseas hacer?" />
            </div>
            {isList ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label htmlFor="interactive-label">Texto del botón que abre la lista</Label><Counter value={draft.buttonLabel} max={INTERACTIVE_LIMITS.listLabel} /></div>
                <Input id="interactive-label" value={draft.buttonLabel} onChange={(event) => update({ buttonLabel: event.target.value })} />
              </div>
            ) : null}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{isList ? 'Opciones de la lista' : 'Botones'}</legend>
              {draft.options.map((option, index) => (
                <div key={index} className="space-y-1.5 rounded-lg border p-2">
                  <div className="flex items-center gap-2">
                    <Input aria-label={`${isList ? 'Opción' : 'Botón'} ${index + 1}`} value={option.title} placeholder={isList ? 'Ej. Netflix 1 mes' : 'Ej. Ya pagué'}
                      onChange={(event) => updateOption(index, 'title', event.target.value)} />
                    <Counter value={option.title} max={titleLimit} />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Quitar ${isList ? 'opción' : 'botón'} ${index + 1}`}
                      disabled={draft.options.length === 1} onClick={() => update({ options: draft.options.filter((_, current) => current !== index) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {isList ? <Input aria-label={`Descripción de la opción ${index + 1}`} value={option.description} placeholder="Descripción opcional"
                    onChange={(event) => updateOption(index, 'description', event.target.value)} /> : null}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={draft.options.length >= maxOptions}
                onClick={() => update({ options: [...draft.options, { title: '', description: '' }] })}>
                <Plus className="mr-1 h-4 w-4" /> {isList ? 'Agregar opción' : 'Agregar botón'}
              </Button>
            </fieldset>
          </div>

          <div aria-label="Vista previa" className="space-y-1 self-start rounded-xl bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Vista previa</p>
            <div className="rounded-lg bg-background p-2.5 text-sm shadow-sm">
              <p className="whitespace-pre-wrap break-words">{draft.body.trim() ? <WhatsAppText text={draft.body} /> : <span className="text-muted-foreground">Texto del mensaje</span>}</p>
            </div>
            {isList ? (
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-background p-2 text-sm font-medium text-primary shadow-sm"><List className="h-4 w-4" />{draft.buttonLabel.trim() || 'Ver opciones'}</div>
            ) : (filled.length ? filled : [{ title: 'Botón', description: '' }]).map((option, index) => (
              <div key={index} className="rounded-lg bg-background p-2 text-center text-sm font-medium text-primary shadow-sm">{option.title}</div>
            ))}
          </div>
        </div>

        {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={isSending} onClick={submit}>Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
