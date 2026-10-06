'use client';

import { ListTree } from 'lucide-react';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { PURCHASE_BLOCKS } from '@/modules/bot-config';
import type { BotNode } from '@/types/bot';
import { BlockOptionRow } from './BlockOptionRow';
import type { FlowActions, FlowTarget } from './flow-actions';
import { StepCopyList } from './StepCopyList';

type BlockEditorProps = {
  node: BotNode; targets: readonly FlowTarget[]; exits: readonly FlowTarget[]; actions: FlowActions;
  /** Abre el flujo de compra completo como diagrama. */
  onOpenPurchase?: () => void;
};

/**
 * Textos y salidas de un bloque cerrado de compra. Reservar, cobrar y entregar siguen siendo reglas del servidor.
 */
export function BlockEditor({ node, targets, exits, actions, onOpenPurchase }: BlockEditorProps) {
  const block = node.block;
  if (!block) return null;
  return <Panel title={`Bloque cerrado: ${PURCHASE_BLOCKS[block.type].name}`}
    actions={onOpenPurchase ? <Button variant="outline" onClick={onOpenPurchase}><ListTree />Ver flujo de compra completo</Button> : undefined}
    description="Aquí cambias lo que dice el bot y a dónde vuelve el cliente; los cambios llegan a los clientes al publicar. Las reglas de reserva, pago y entrega no se editan.">
    <div className="space-y-4">
      <StepCopyList node={node} actions={actions} />
      <section aria-label="Salidas del bloque" className="space-y-1.5">
        <h3 className="text-sm font-semibold">Salidas</h3>
        <ul aria-label={`Opciones de ${node.name}`} className="rounded-md border">
          {node.options.map((option) => <BlockOptionRow key={option.id} node={node} option={option} exits={exits} targets={targets} actions={actions} />)}
        </ul>
      </section>
    </div>
  </Panel>;
}
