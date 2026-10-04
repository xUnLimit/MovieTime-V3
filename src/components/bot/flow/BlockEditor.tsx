'use client';

import { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { CopyEditor } from '@/components/compras/CopyEditor';
import { PURCHASE_BLOCKS } from '@/modules/bot-config';
import { COPY_CATALOG, copyKeysOfBlock, type CopyKey } from '@/modules/commerce-copy';
import { stepTitle } from '@/modules/commerce-copy/flow';
import type { BotNode } from '@/types/bot';
import { BlockOptionRow } from './BlockOptionRow';
import type { FlowActions, FlowTarget } from './flow-actions';

type BlockEditorProps = { node: BotNode; targets: readonly FlowTarget[]; exits: readonly FlowTarget[]; actions: FlowActions };

/** Textos y salidas de un bloque cerrado de compra. Reservar, cobrar y entregar siguen siendo reglas del servidor. */
export function BlockEditor({ node, targets, exits, actions }: BlockEditorProps) {
  const [selected, setSelected] = useState<CopyKey | null>(null);
  const block = node.block;
  if (!block) return null;
  const copy = block.copy;
  const keys = copyKeysOfBlock(block.type);
  const steps = [...new Set(keys.map((key) => COPY_CATALOG[key].step))];
  return <Panel title={`Bloque cerrado: ${PURCHASE_BLOCKS[block.type].name}`}
    description="Aquí cambias lo que dice el bot y a dónde vuelve el cliente. Las reglas de reserva, pago y entrega no se editan.">
    <div className="space-y-4">
      {steps.map((step) => <section key={step} aria-label={`Textos de ${stepTitle(step)}`} className="space-y-1.5">
        <h3 className="text-sm font-semibold">{stepTitle(step)}</h3>
        <ul className="rounded-md border">
          {keys.filter((key) => COPY_CATALOG[key].step === step).map((key) => <li key={key} className="border-t first:border-t-0">
            <Button type="button" variant="ghost" className="h-auto w-full justify-between gap-2 py-2 text-left" aria-pressed={selected === key}
              onClick={() => setSelected(key)}>
              <span className="min-w-0 truncate">{COPY_CATALOG[key].label}</span>
              {copy[key] === undefined ? null : <StatusBadge tone="info">Editado</StatusBadge>}
            </Button>
          </li>)}
        </ul>
      </section>)}
      {selected ? <CopyEditor key={`${selected}:${copy[selected] ?? ''}`} copyKey={selected} saved={copy[selected]} saving={false}
        onSave={(text) => actions.setBlockCopy(node.id, selected, text)} /> : null}
      <section aria-label="Salidas del bloque" className="space-y-1.5">
        <h3 className="text-sm font-semibold">Salidas</h3>
        <ul aria-label={`Opciones de ${node.name}`} className="rounded-md border">
          {node.options.map((option) => <BlockOptionRow key={option.id} node={node} option={option} exits={exits} targets={targets} actions={actions} />)}
        </ul>
      </section>
    </div>
  </Panel>;
}
