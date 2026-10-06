'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageBubble } from '../MessageBubble';
import { COPY_CATALOG, COPY_VARIABLES, type CopyKey } from '@/modules/commerce-copy/catalog';
import { copyProblem, renderCopyText, sampleValues } from '@/modules/commerce-copy/render';

interface CopyEditorProps {
  copyKey: CopyKey;
  /** Texto guardado en el bloque del recorrido; sin valor rige `inherited` o, si tampoco hay, el original. */
  saved: string | undefined;
  /** Texto guardado fuera del recorrido (antigua pestaña Compras) que el bot usa mientras el bloque no tenga uno propio. */
  inherited?: string;
  /** `null` quita el texto del bloque y vuelve a regir `inherited` o el original. */
  onSave: (text: string | null) => void;
}

/**
 * Edita un texto de un bloque de compra con vista previa y datos insertables. Muestra el texto que el bot usa de verdad
 * y "Restaurar original" deja el original aunque haya un texto guardado fuera del recorrido. Se monta de nuevo al guardar.
 */
export function CopyEditor({ copyKey, saved, inherited, onSave }: CopyEditorProps) {
  const spec = COPY_CATALOG[copyKey];
  const original = spec.defaultText.trim();
  // Lo que rige cuando el bloque no trae texto propio.
  const base = (inherited ?? spec.defaultText).trim();
  const current = saved ?? inherited ?? spec.defaultText;
  const [draft, setDraft] = useState(current);
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const fieldId = useId();
  const helpId = useId();
  const problem = copyProblem(copyKey, draft);
  const changed = draft.trim() !== current.trim();
  const isOriginal = current.trim() === original;
  const multiline = spec.kind === 'message';
  // Guarda en el bloque solo lo que difiere de lo que ya rige sin el; el original se guarda explicito si hay otro texto debajo.
  const store = (text: string) => onSave(text === base ? null : text);

  const insert = (name: string) => {
    const input = field.current;
    const marker = `{{${name}}}`;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    setDraft(`${draft.slice(0, start)}${marker}${draft.slice(end)}`);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + marker.length, start + marker.length);
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Se usa cuando: {spec.when}.</p>
        {saved === undefined && inherited !== undefined
          ? <p role="note">El bot usa este texto, guardado en la antigua pestaña Compras. Si lo cambias aquí, el cambio queda en el recorrido.</p>
          : null}
      </div>

      <div className="space-y-2">
        <label htmlFor={fieldId} className="block text-sm font-medium">Texto</label>
        {multiline ? (
          <Textarea id={fieldId} ref={field} rows={6} value={draft} maxLength={spec.maxLength} onChange={event => setDraft(event.target.value)} aria-invalid={problem !== null} aria-describedby={helpId} />
        ) : (
          <Input id={fieldId} ref={field} value={draft} maxLength={spec.maxLength} onChange={event => setDraft(event.target.value)} aria-invalid={problem !== null} aria-describedby={helpId} />
        )}
        <div id={helpId} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{draft.length}/{spec.maxLength} caracteres</span>
          {problem ? <span role="alert" className="text-danger">{problem}</span> : null}
        </div>
      </div>

      {spec.variables.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Datos que puedes insertar</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Datos que puedes insertar">
            {spec.variables.map(name => (
              <Button key={name} type="button" size="sm" variant="outline" onClick={() => insert(name)} title={`Ejemplo: ${COPY_VARIABLES[name].example}`}>
                {COPY_VARIABLES[name].label}{(spec.required as readonly string[]).includes(name) ? ' *' : ''}
              </Button>
            ))}
          </div>
          {spec.required.length > 0 ? <p className="text-xs text-muted-foreground">* Este dato es obligatorio en este mensaje.</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Así lo verá el cliente</p>
        <MessageBubble text={renderCopyText(draft, sampleValues(copyKey))} testId="copy-preview" />
        <p className="text-xs text-muted-foreground">Los datos se muestran con valores de ejemplo.</p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={isOriginal && !changed}
          onClick={() => { if (isOriginal) setDraft(spec.defaultText); else store(original); }}>
          Restaurar original
        </Button>
        <Button type="button" variant="outline" disabled={problem !== null || !changed} onClick={() => store(draft.trim())}>Guardar</Button>
      </div>
    </div>
  );
}
