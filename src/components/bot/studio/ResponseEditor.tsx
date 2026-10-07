'use client';

import { useId, useRef, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { MESSAGE_CATALOG, VARIABLE_CATALOG, renderTemplate } from '@/modules/bot-config';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BotIssue, BotMessageKey } from '@/types/bot';
import { MessageBubble } from '../MessageBubble';

const examples = Object.fromEntries(Object.entries(VARIABLE_CATALOG).map(([key, variable]) => [key, variable.example]));

type InsertableVariable = { name: string; label: string; example: string; required: boolean };

type ResponseFrameProps = {
  title: string;
  hint: string;
  edited: boolean;
  onRestore: () => void;
  /** Cuándo se usa el texto (solo los textos de compras lo traen). */
  note?: ReactNode;
  value: string;
  maxLength: number;
  multiline?: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  /** Problemas del texto, dichos junto al campo y no solo al publicar. */
  problems: readonly { message: string; severity: 'error' | 'warning' }[];
  variables: readonly InsertableVariable[];
  /** Texto de la burbuja: el mismo con los datos reemplazados por ejemplos. */
  previewText: string;
  previewTestId: string;
};

/**
 * Una respuesta en dos mitades: a la izquierda el texto con sus datos insertables y, a la derecha, cómo lo ve el cliente
 * mientras se escribe. Restablecer y el estado «Editado» están siempre a la vista en el encabezado. Lo usan las respuestas del
 * bot y los textos de compras, para que ambas se editen y se guarden igual: todo se aplica al borrador al escribir.
 */
export function ResponseFrame({ title, hint, edited, onRestore, note, value, maxLength, multiline = true, compact = false, onChange, problems, variables, previewText, previewTestId }: ResponseFrameProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const insert = (name: string) => {
    const marker = `{{${name}}}`;
    const start = field.current?.selectionStart ?? value.length;
    const end = field.current?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${marker}${value.slice(end)}`);
    requestAnimationFrame(() => { field.current?.focus(); field.current?.setSelectionRange(start + marker.length, start + marker.length); });
  };
  const failing = problems.some((problem) => problem.severity === 'error');
  return <div className={compact ? "space-y-3" : "space-y-5 p-5"}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {failing ? <StatusBadge tone="danger">Con error</StatusBadge> : edited ? <StatusBadge tone="info">Editado</StatusBadge> : null}
        </div>
        <p className="text-sm text-muted-foreground">{hint}</p>
        {note}
      </div>
      <Button type="button" variant="outline" disabled={!edited} onClick={onRestore}><RotateCcw />Restablecer</Button>
    </header>
    <div className={compact ? "grid min-w-0 gap-3" : "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"}>
      <div className="min-w-0 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={fieldId} className="text-sm font-medium">Texto del mensaje</label>
          <Textarea id={fieldId} ref={field} rows={multiline ? 8 : 3} value={value} maxLength={maxLength} aria-invalid={failing} onChange={(event) => onChange(event.target.value)} />
          <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
            <ul aria-label="Problemas del mensaje" className="min-w-0 flex-1 space-y-0.5">
              {problems.map((problem, index) => <li key={index} role={problem.severity === 'error' ? 'alert' : undefined} className={problem.severity === 'error' ? 'text-danger' : 'text-warning'}>{problem.message}</li>)}
            </ul>
            <span className="text-muted-foreground tabular-nums">{value.length}/{maxLength}</span>
          </div>
        </div>
        {variables.length > 0 ? <div className="space-y-1.5">
          <p className="text-sm font-medium">Datos que puedes insertar</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Marcadores de ${title}`}>
            {variables.map((variable) => <Button key={variable.name} type="button" size="sm" variant="outline" title={`Ejemplo: ${variable.example}`} onClick={() => insert(variable.name)}>
              {variable.label}{variable.required ? ' *' : ''}</Button>)}
          </div>
          {variables.some((variable) => variable.required) ? <p className="text-xs text-muted-foreground">* Obligatorio: sin este dato no se puede publicar.</p> : null}
        </div> : null}
      </div>
      <aside aria-label="Vista previa" className="min-w-0 space-y-2 xl:sticky xl:top-0 xl:self-start">
        <p className="text-sm font-medium">Así lo verá el cliente</p>
        <MessageBubble text={previewText} testId={previewTestId} />
        <p className="text-xs text-muted-foreground">Los datos se muestran con valores de ejemplo.</p>
      </aside>
    </div>
  </div>;
}

type ResponseEditorProps = {
  messageKey: BotMessageKey;
  value: string;
  onChange: (value: string) => void;
  issues: readonly BotIssue[];
  compact?: boolean;
};

/** Respuesta del bot dentro de la conversación (códigos, errores, atención). */
export function ResponseEditor({ messageKey, value, onChange, issues, compact }: ResponseEditorProps) {
  const item = MESSAGE_CATALOG[messageKey];
  return <ResponseFrame compact={compact} title={item.label} hint={item.description} edited={value.trim() !== item.defaultText.trim()} onRestore={() => onChange(item.defaultText)}
    value={value} maxLength={item.maxLength} onChange={onChange} problems={issues}
    variables={item.variables.map((name) => ({ name, label: VARIABLE_CATALOG[name]?.label ?? name, example: VARIABLE_CATALOG[name]?.example ?? '', required: item.required.includes(name) }))}
    previewText={renderTemplate(value, examples)} previewTestId="message-preview" />;
}
