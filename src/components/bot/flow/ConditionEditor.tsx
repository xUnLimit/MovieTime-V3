'use client';

import { Trash2 } from 'lucide-react';
import { CONDITION_CATALOG, CONDITION_TYPES, NODE_LIMITS } from '@/modules/bot-config';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BotConditionType, BotNode } from '@/types/bot';
import { BlockOptionRow } from './BlockOptionRow';
import type { FlowActions, FlowTarget } from './flow-actions';
import { SELECT_CLASS } from './OptionRow';

type ConditionEditorProps = { node: BotNode; targets: readonly FlowTarget[]; isEntry: boolean; actions: FlowActions };

/** Condicion: el servidor elige la salida con datos que ya existen; aqui solo se elige el tipo y a donde lleva cada respuesta. */
export function ConditionEditor({ node, targets, isEntry, actions }: ConditionEditorProps) {
  const condition = node.condition;
  if (!condition) return null;
  return <Panel title={`Condición: ${node.name}`} description={CONDITION_CATALOG[condition.type].description}
    actions={<Button variant="destructive" disabled={isEntry} onClick={() => actions.removeNode(node.id)}><Trash2 />Eliminar nodo</Button>}>
    <div className="space-y-3">
      <label className="block text-sm font-medium">Nombre
        <Input value={node.name} onChange={(event) => actions.updateNode(node.id, { name: event.target.value })} /></label>
      <label className="block text-sm font-medium">Condición
        <select className={SELECT_CLASS} value={condition.type}
          onChange={(event) => actions.updateNode(node.id, { condition: { type: event.target.value as BotConditionType } })}>
          {CONDITION_TYPES.map((type) => <option key={type} value={type}>{CONDITION_CATALOG[type].label}</option>)}</select></label>
      <label className="block text-sm font-medium">Texto de respaldo
        <Textarea maxLength={NODE_LIMITS.bodyMax} value={node.body} onChange={(event) => actions.updateNode(node.id, { body: event.target.value })} />
        <span className="text-xs font-normal text-muted-foreground">Solo lo ve el cliente si la versión anterior del bot lee este recorrido.</span></label>
      <section aria-label="Salidas de la condición" className="space-y-1.5">
        <h3 className="text-sm font-semibold">Salidas</h3>
        <ul aria-label={`Opciones de ${node.name}`} className="rounded-md border">
          {node.options.map((option) => <BlockOptionRow key={option.id} node={node} option={option} exits={targets} targets={targets} actions={actions} />)}
        </ul>
      </section>
    </div>
  </Panel>;
}
