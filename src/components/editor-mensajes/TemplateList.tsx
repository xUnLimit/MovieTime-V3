'use client';

import type { KeyboardEvent } from 'react';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/platform/utils';
import type { ChannelStatus } from '@/modules/messaging/meta-template-mapping';
import type { EditableTipoKey } from '@/modules/messaging/template-tipos';
import { ChannelDot, ChannelLegend } from './ChannelStatus';
import { TEMPLATE_GROUPS, tipoCuando, tipoLabel } from './editor-constants';
import { PanelFooter, PanelHeader } from './PanelFrame';

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
      <div className="space-y-1 p-4 md:hidden">
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

      <nav aria-label="Mensajes" onKeyDown={moveFocus} className="hidden h-full min-h-0 flex-col bg-muted/30 md:flex">
        <PanelHeader tone="strong" title="Mensajes" description="Elige cuál editar" />
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pb-2">
          {TEMPLATE_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`group-${group.id}`} data-testid={`group-${group.id}`}>
              <h3 id={`group-${group.id}`} className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-medium text-muted-foreground after:h-px after:flex-1 after:bg-border">
                {group.label}
              </h3>
              <ul className="space-y-0.5 px-2">
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
                          'flex h-12 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors',
                          'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          active ? 'bg-card ring-1 ring-border' : 'hover:bg-card/60',
                        )}
                      >
                        <ChannelDot status={statusOf(tipo)} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium leading-tight">{tipoLabel(tipo)}</span>
                          <span className="block truncate text-xs leading-snug text-muted-foreground">{tipoCuando(tipo)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <PanelFooter tone="strong"><ChannelLegend /></PanelFooter>
      </nav>
    </>
  );
}
