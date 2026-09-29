'use client';

import { useRef } from 'react';
import { Bold, Italic, Strikethrough } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { EditableTipoKey } from '@/modules/messaging/template-tipos';
import { insertAtCursor, placeholdersFor, wrapSelection } from './editor-constants';

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

/** Texto del mensaje con formato de WhatsApp y los datos del cliente a un clic, sin menus escondidos. */
export function MessageComposer({ tipo, value, onChange }: MessageComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const options = placeholdersFor(tipo);

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="template-contenido" className="text-sm font-medium">Texto del mensaje</label>
        <div role="toolbar" aria-label="Formato del texto" className="flex items-center gap-0.5">
          {FORMATS.map(({ mark, label, icon: Icon }) => (
            <Button key={mark} type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={() => format(mark)}>
              <Icon aria-hidden />
            </Button>
          ))}
        </div>
      </div>

      <Textarea
        id="template-contenido"
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Escribe aquí el mensaje..."
        className="field-sizing-fixed h-72 resize-none overflow-y-auto text-sm leading-normal"
      />

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Toca un dato para agregarlo donde está el cursor. Se reemplaza por el dato real de cada cliente.</p>
        <ul aria-label="Datos del cliente" className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <li key={option.key}>
              <Button type="button" variant="outline" size="sm" title={option.description} onClick={() => insert(option.key)}>
                {option.label}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
