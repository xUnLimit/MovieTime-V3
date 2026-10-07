'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommerceCopy } from '@/hooks/use-commerce-copy';
import { COPY_CATALOG, editableCopyKeysOfBlock, type CopyKey } from '@/modules/commerce-copy';
import type { CopyStepId } from '@/modules/commerce-copy/catalog';
import { stepDescription, stepTitle } from '@/modules/commerce-copy/flow';
import { renderCopyText, sampleValues } from '@/modules/commerce-copy/render';
import type { BotNode } from '@/types/bot';
import { CopyEditor } from './CopyEditor';
import type { FlowActions } from './flow-actions';

type StepCopyListProps = {
  /** Nodo de bloque de compra que guarda los textos. */
  node: BotNode;
  /** Pasos de la conversación cuyos textos se listan; sin valor, todos los del bloque. */
  steps?: readonly CopyStepId[];
  actions: FlowActions;
};

const GROUPS = [
  { kind: 'message', title: 'Mensajes al cliente' },
  { kind: 'button', title: 'Botones y opciones' },
  { kind: 'label', title: 'Detalles de listas y resumen' },
] as const;

/**
 * Textos que el bot envía en uno o varios pasos de la compra. Cada texto muestra lo que el bot manda de verdad: el del bloque,
 * si no el guardado fuera del recorrido y si no el original; al abrirlo se edita con su burbuja de WhatsApp.
 */
export function StepCopyList({ node, steps, actions }: StepCopyListProps) {
  const [selected, setSelected] = useState<CopyKey | null>(null);
  const stored = useCommerceCopy();
  const block = node.block;
  if (!block) return null;
  const inherited: Partial<Record<string, string>> = stored.data?.overrides ?? {};
  const keys = editableCopyKeysOfBlock(block.type);
  const shown = steps ?? [...new Set(keys.map((key) => COPY_CATALOG[key].step))];
  const effective = (key: CopyKey) => block.copy[key] ?? inherited[key] ?? COPY_CATALOG[key].defaultText;

  if (stored.isPending) return <div aria-busy="true" className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-32 w-full" /><span className="sr-only">Cargando los textos del bloque</span></div>;
  if (stored.isError) {
    return <div role="alert" className="space-y-2">
      <p className="text-sm text-danger">No se pudieron leer los textos que el bot usa hoy. Reintenta antes de cambiarlos.</p>
      <Button variant="outline" size="sm" onClick={() => void stored.refetch()}>Reintentar</Button>
    </div>;
  }
  return <>{shown.map((step) => <section key={step} aria-label={`Textos de ${stepTitle(step)}`} className="space-y-1.5">
    <div>
      <h3 className="text-sm font-semibold">{stepTitle(step)}</h3>
      <p className="text-xs text-muted-foreground">{stepDescription(step)}</p>
    </div>
    {GROUPS.map((group) => {
      // Los botones que abren listas usan los límites de una etiqueta en el catálogo, pero el cliente los ve como botones.
      const items = keys.filter((key) => COPY_CATALOG[key].step === step && (key.startsWith('listButton') ? 'button' : COPY_CATALOG[key].kind) === group.kind);
      if (items.length === 0) return null;
      return <div key={group.kind} className="space-y-2 pt-3">
        <h4 className="text-xs font-medium text-muted-foreground">{group.title}</h4>
        <ul aria-label={group.title} className="rounded-md border">
      {items.map((key) => {
        const text = effective(key);
        const open = selected === key;
        const panelId = `texto-${node.id}-${key}`;
        return <li key={key} className="border-t first:border-t-0">
          <Button type="button" variant="ghost" className="h-auto w-full justify-between gap-2 py-2 text-left" aria-expanded={open} aria-controls={panelId}
            onClick={() => setSelected(open ? null : key)}>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate">{COPY_CATALOG[key].label}</span>
              <span className="block text-xs font-normal whitespace-normal text-muted-foreground">{COPY_CATALOG[key].when}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{renderCopyText(text, sampleValues(key)).replace(/\s+/g, ' ')}</span>
            </span>
            {text.trim() === COPY_CATALOG[key].defaultText.trim() ? null : <StatusBadge tone="info">Editado</StatusBadge>}
          </Button>
          {open ? <div id={panelId} className="border-t px-3 py-3">
            <CopyEditor key={`${key}:${block.copy[key] ?? ''}`} copyKey={key} saved={block.copy[key]} inherited={inherited[key]}
              onSave={(value) => actions.setBlockCopy(node.id, key, value)} />
          </div> : null}
        </li>;
      })}
        </ul>
      </div>;
    })}
  </section>)}</>;
}
