'use client';

import type { KeyboardEvent } from 'react';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/platform/utils';
import type { ChannelStatus } from '@/modules/messaging/meta-template-mapping';
import type { EditableTipoKey } from '@/modules/messaging/template-tipos';
import { ChannelDot, ChannelLegend } from './ChannelStatus';
import { TEMPLATE_GROUPS, tipoCuando, tipoLabel } from './editor-constants';

type TemplateListProps = {
  selected: EditableTipoKey;
  statusOf: (tipo: EditableTipoKey) => ChannelStatus;
  onSelect: (tipo: EditableTipoKey) => void;
};

// Flechas arriba/abajo mueven el foco entre mensajes sin salir de la lista.
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-tipo]'));
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
  items[(next + items.length) % items.length]?.focus();
}

export function TemplateList({ selected, statusOf, onSelect }: TemplateListProps) {
  return (
    <>
      <div className="space-y-1 md:hidden">
        <Label htmlFor="template-select" className="text-xs text-muted-foreground">Mensaje</Label>
        <Select value={selected} onValueChange={(value) => onSelect(value as EditableTipoKey)}>
          <SelectTrigger id="template-select" className="w-full" aria-label="Elegir mensaje">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_GROUPS.flatMap((group) => group.tipos.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>{group.label} · {tipoLabel(tipo)}</SelectItem>
            )))}
          </SelectContent>
        </Select>
      </div>

      <nav aria-label="Mensajes" onKeyDown={moveFocus} className="hidden space-y-4 rounded-xl border bg-card p-2 md:block">
        {TEMPLATE_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`} data-testid={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h2>
            <ul className="space-y-1">
              {group.tipos.map((tipo) => {
                const active = tipo === selected;
                return (
                  <li key={tipo}>
                    <button
                      type="button"
                      data-tipo={tipo}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => onSelect(tipo)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        active ? 'bg-accent' : 'hover:bg-accent/50',
                      )}
                    >
                      <span className="mt-1.5"><ChannelDot status={statusOf(tipo)} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-tight">{tipoLabel(tipo)}</span>
                        <span className="block text-xs leading-snug text-muted-foreground">{tipoCuando(tipo)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <ChannelLegend />
      </nav>
    </>
  );
}
