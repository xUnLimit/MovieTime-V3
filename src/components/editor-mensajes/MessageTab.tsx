'use client';

import { useRef } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import type { EditableTipoKey } from '@/modules/messaging/template-tipos';
import { insertAtCursor, placeholdersFor } from './editor-constants';

type MessageTabProps = {
  tipo: EditableTipoKey;
  value: string;
  onChange: (value: string) => void;
};

export function MessageTab({ tipo, value, onChange }: MessageTabProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const options = placeholdersFor(tipo);

  const insert = (text: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = insertAtCursor(value, start, end, text);
    onChange(next.value);
    // El cursor se coloca despues de que React pinte el nuevo valor.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.cursor, next.cursor);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <label htmlFor="template-contenido" className="text-sm font-medium">Texto del mensaje</label>
          <p className="text-xs text-muted-foreground">Se envía por wa.me o por el chat con la ventana de 24 h abierta.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Insertar dato
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
            <DropdownMenuLabel>Se reemplaza por el dato real de cada cliente</DropdownMenuLabel>
            {options.map((option) => (
              <DropdownMenuItem key={option.key} onSelect={() => insert(option.key)} className="flex-col items-start gap-0">
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Textarea
        id="template-contenido"
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Escribe aquí el mensaje..."
        className="h-[300px] resize-none text-sm leading-normal"
      />
    </div>
  );
}
