'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { COPY_CATALOG, type CopyKey, type CopyStepId } from '@/modules/commerce-copy/catalog';
import { stepTitle, type FlowStep } from '@/modules/commerce-copy/flow';
import { createCopy } from '@/modules/commerce-copy/render';
import { cn } from '@/platform/utils/cn';

interface FlowStepCardProps {
  step: FlowStep;
  number: number;
  keys: CopyKey[];
  overrides: Record<string, string>;
  selected: CopyKey | null;
  onSelect: (key: CopyKey) => void;
  onJump: (id: CopyStepId) => void;
}

/** Un paso del flujo: lo que dice el bot, a donde puede ir el cliente despues y que textos se pueden editar. */
export function FlowStepCard({ step, number, keys, overrides, selected, onSelect, onJump }: FlowStepCardProps) {
  const text = createCopy(overrides);
  return (
    <div id={`paso-${step.id}`} className="scroll-mt-4">
      <Panel
        title={<span className="inline-flex items-center gap-2"><span aria-hidden className="grid size-5 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{number}</span>{step.title}</span>}
        description={step.description}
        contentClassName="space-y-1.5"
        footer={step.next.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Después puede ir a</span>
            {step.next.map(id => (
              <Button key={id} type="button" size="xs" variant="outline" onClick={() => onJump(id)}>
                <ArrowRight />{stepTitle(id)}
              </Button>
            ))}
          </div>
        ) : undefined}
      >
        <ul className="space-y-1.5" aria-label={`Textos del paso ${step.title}`}>
          {keys.map(key => {
            const spec = COPY_CATALOG[key];
            const edited = overrides[key] !== undefined;
            return (
              <li key={key}>
                <button
                  type="button" onClick={() => onSelect(key)} aria-pressed={selected === key}
                  className={cn('block w-full rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected === key ? 'border-primary bg-accent' : 'hover:bg-accent')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{spec.label}</span>
                    {edited ? <StatusBadge tone="info">Editado</StatusBadge> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{text(key).replace(/\s+/g, ' ')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
