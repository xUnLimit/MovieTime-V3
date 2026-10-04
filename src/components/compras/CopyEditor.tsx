'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { COPY_CATALOG, COPY_VARIABLES, type CopyKey } from '@/modules/commerce-copy/catalog';
import { copyProblem, renderCopyText, sampleValues } from '@/modules/commerce-copy/render';

interface CopyEditorProps {
  copyKey: CopyKey;
  /** Texto guardado (editado); sin valor se usa el original. */
  saved: string | undefined;
  saving: boolean;
  /** `null` restaura el original. */
  onSave: (text: string | null) => void;
}

/** Edita un solo texto con vista previa y datos insertables. Se monta de nuevo al cambiar de texto o al guardar. */
export function CopyEditor({ copyKey, saved, saving, onSave }: CopyEditorProps) {
  const spec = COPY_CATALOG[copyKey];
  const current = saved ?? spec.defaultText;
  const [draft, setDraft] = useState(current);
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const problem = copyProblem(copyKey, draft);
  const changed = draft.trim() !== current.trim();
  const multiline = spec.kind === 'message';

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
    <Panel
      title={spec.label}
      description={`Se usa cuando: ${spec.when}.`}
      actions={saved === undefined ? <StatusBadge tone="neutral">Texto original</StatusBadge> : <StatusBadge tone="info">Editado</StatusBadge>}
      contentClassName="space-y-4"
    >
      <div className="space-y-2">
        <label htmlFor="copy-text" className="block text-sm font-medium">Texto</label>
        {multiline ? (
          <Textarea id="copy-text" ref={field} rows={6} value={draft} maxLength={spec.maxLength} onChange={event => setDraft(event.target.value)} aria-invalid={problem !== null} aria-describedby="copy-help" />
        ) : (
          <Input id="copy-text" ref={field} value={draft} maxLength={spec.maxLength} onChange={event => setDraft(event.target.value)} aria-invalid={problem !== null} aria-describedby="copy-help" />
        )}
        <div id="copy-help" className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
        <div className="rounded-xl border bg-muted p-3">
          <p className="text-sm break-words whitespace-pre-wrap" data-testid="copy-preview">{renderCopyText(draft, sampleValues(copyKey)) || ' '}</p>
        </div>
        <p className="text-xs text-muted-foreground">Los datos se muestran con valores de ejemplo.</p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={saving || (saved === undefined && !changed)}
          onClick={() => { if (saved === undefined) setDraft(spec.defaultText); else onSave(null); }}>
          Restaurar original
        </Button>
        <Button type="button" disabled={saving || problem !== null || !changed}
          onClick={() => onSave(draft.trim() === spec.defaultText.trim() ? null : draft.trim())}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Panel>
  );
}
