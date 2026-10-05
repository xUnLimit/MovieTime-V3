'use client';

import { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommerceCopy } from '@/hooks/use-commerce-copy';
import { PURCHASE_BLOCKS } from '@/modules/bot-config';
import { COPY_CATALOG, editableCopyKeysOfBlock, type CopyKey } from '@/modules/commerce-copy';
import { stepDescription, stepTitle } from '@/modules/commerce-copy/flow';
import { renderCopyText, sampleValues } from '@/modules/commerce-copy/render';
import type { BotNode } from '@/types/bot';
import { BlockOptionRow } from './BlockOptionRow';
import { CopyEditor } from './CopyEditor';
import type { FlowActions, FlowTarget } from './flow-actions';

type BlockEditorProps = { node: BotNode; targets: readonly FlowTarget[]; exits: readonly FlowTarget[]; actions: FlowActions };

/**
 * Textos y salidas de un bloque cerrado de compra. Cada texto muestra lo que el bot envia de verdad: el del bloque, si no
 * el guardado fuera del recorrido y si no el original. Reservar, cobrar y entregar siguen siendo reglas del servidor.
 */
export function BlockEditor({ node, targets, exits, actions }: BlockEditorProps) {
  const [selected, setSelected] = useState<CopyKey | null>(null);
  const stored = useCommerceCopy();
  const block = node.block;
  if (!block) return null;
  const inherited: Partial<Record<string, string>> = stored.data?.overrides ?? {};
  const keys = editableCopyKeysOfBlock(block.type);
  const steps = [...new Set(keys.map((key) => COPY_CATALOG[key].step))];
  const effective = (key: CopyKey) => block.copy[key] ?? inherited[key] ?? COPY_CATALOG[key].defaultText;

  const texts = stored.isPending
    ? <div aria-busy="true" className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-32 w-full" /><span className="sr-only">Cargando los textos del bloque</span></div>
    : stored.isError
      ? <div role="alert" className="space-y-2">
        <p className="text-sm text-danger">No se pudieron leer los textos que el bot usa hoy. Reintenta antes de cambiarlos.</p>
        <Button variant="outline" size="sm" onClick={() => void stored.refetch()}>Reintentar</Button>
      </div>
      : steps.map((step) => <section key={step} aria-label={`Textos de ${stepTitle(step)}`} className="space-y-1.5">
        <div>
          <h3 className="text-sm font-semibold">{stepTitle(step)}</h3>
          <p className="text-xs text-muted-foreground">{stepDescription(step)}</p>
        </div>
        <ul className="rounded-md border">
          {keys.filter((key) => COPY_CATALOG[key].step === step).map((key) => {
            const text = effective(key);
            const open = selected === key;
            const panelId = `texto-${node.id}-${key}`;
            return <li key={key} className="border-t first:border-t-0">
              <Button type="button" variant="ghost" className="h-auto w-full justify-between gap-2 py-2 text-left" aria-expanded={open} aria-controls={panelId}
                onClick={() => setSelected(open ? null : key)}>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate">{COPY_CATALOG[key].label}</span>
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
      </section>);

  return <Panel title={`Bloque cerrado: ${PURCHASE_BLOCKS[block.type].name}`}
    description="Aquí cambias lo que dice el bot y a dónde vuelve el cliente; los cambios llegan a los clientes al publicar. Las reglas de reserva, pago y entrega no se editan.">
    <div className="space-y-4">
      {texts}
      <section aria-label="Salidas del bloque" className="space-y-1.5">
        <h3 className="text-sm font-semibold">Salidas</h3>
        <ul aria-label={`Opciones de ${node.name}`} className="rounded-md border">
          {node.options.map((option) => <BlockOptionRow key={option.id} node={node} option={option} exits={exits} targets={targets} actions={actions} />)}
        </ul>
      </section>
    </div>
  </Panel>;
}
