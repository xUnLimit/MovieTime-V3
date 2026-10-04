'use client';

import { Fragment, useRef } from 'react';
import { Bold, Italic, Strikethrough } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { EditableTipoKey } from '@/modules/messaging/template-tipos';
import { insertAtCursor, placeholderGroupsFor, wrapSelection } from './editor-constants';

type MessageComposerProps = {
  tipo: EditableTipoKey;
  value: string;
  onChange: (value: string) => void;
};

type Edit = { value: string; selectionStart: number; selectionEnd: number };

const FORMATS = [
  { mark: '*', label: 'Negrita', icon: Bold },
  { mark: '_', label: 'Cursiva', icon: Italic },
  { mark: '~', label: 'Tachado', icon: Strikethrough },
] as const;

// Datos como {cliente} y el bloque {{#items}}...{{/items}}; los pares impares del split son los datos.
const TOKEN = /(\{\{[#/]items\}\}|\{[a-z_]+\})/g;

// Misma tipografia y relleno en la capa y en el textarea: si cambian, se desalinean los datos resaltados.
const TEXT_BOX = 'absolute inset-0 rounded-md border px-3 py-2 text-base leading-normal [scrollbar-gutter:stable] md:text-sm';

/** Texto del mensaje con formato de WhatsApp y los datos del cliente a un clic, sin menus escondidos. */
export function MessageComposer({ tipo, value, onChange }: MessageComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const groups = placeholderGroupsFor(tipo);

  const apply = (edit: Edit) => {
    onChange(edit.value);
    // El cursor se coloca despues de que React pinte el nuevo valor.
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };

  const selection = () => ({
    start: ref.current?.selectionStart ?? value.length,
    end: ref.current?.selectionEnd ?? value.length,
  });

  const insert = (text: string) => {
    const { start, end } = selection();
    const next = insertAtCursor(value, start, end, text);
    apply({ value: next.value, selectionStart: next.cursor, selectionEnd: next.cursor });
  };

  const format = (mark: string) => {
    const { start, end } = selection();
    apply(wrapSelection(value, start, end, mark));
  };

  return (
    <Fragment>
      <section aria-label="Texto" className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-h-7 items-center justify-between gap-2">
          <label htmlFor="template-contenido" className="text-sm font-medium">Texto del mensaje</label>
          <div role="toolbar" aria-label="Formato del texto" className="flex items-center gap-0.5">
            {FORMATS.map(({ mark, label, icon: Icon }) => (
              <Button key={mark} type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={() => format(mark)}>
                <Icon aria-hidden />
              </Button>
            ))}
          </div>
        </div>

        <div className="relative min-h-56 flex-1 rounded-md bg-card dark:bg-input/30">
          <div ref={layer} aria-hidden className={`${TEXT_BOX} overflow-hidden whitespace-pre-wrap break-words border-transparent text-transparent`}>
            {value.split(TOKEN).map((part, index) => (index % 2 === 1
              ? <mark key={index} className="rounded-[3px] bg-primary/15 text-transparent">{part}</mark>
              : <Fragment key={index}>{part}</Fragment>))}
            {'\n'}
          </div>
          <Textarea
            id="template-contenido"
            ref={ref}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onScroll={(event) => { if (layer.current) layer.current.scrollTop = event.currentTarget.scrollTop; }}
            placeholder="Escribe aquí el mensaje..."
            className={`${TEXT_BOX} field-sizing-fixed h-full min-h-0 resize-none overflow-y-auto bg-transparent dark:bg-transparent`}
          />
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="rounded-[3px] bg-primary/15 px-1.5 font-medium text-foreground">{'{dato}'}</span>
          se reemplaza por el dato real de cada cliente
        </p>
      </section>

      <section aria-label="Datos del cliente" className="space-y-3 p-4">
        <div className="flex min-h-7 items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Insertar dato</h3>
          <p className="text-xs text-muted-foreground">Toca uno para agregarlo en el cursor</p>
        </div>
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="text-xs text-muted-foreground">{group.label}</span>
              <ul aria-label={group.label} className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {group.items.map((option) => (
                  <li key={option.key} className="min-w-0">
                    <Button type="button" variant="outline" size="sm" title={option.description} onClick={() => insert(option.key)} className="w-full min-w-0 justify-center overflow-hidden px-2">
                      <span className="truncate">{option.label}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </Fragment>
  );
}
