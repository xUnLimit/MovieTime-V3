'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Plus, Trash2, UserRound } from 'lucide-react';
import { ACTION_CATALOG, canAddOption } from '@/modules/bot-config';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/platform/utils';
import type { BotIssue, BotNode } from '@/types/bot';
import { KIND_LABELS, type FlowActions, type FlowTarget } from './flow-actions';
import { EntryButton } from './EntryButton';
import { IssueList } from './IssueList';
import { BlockOptionRow } from './BlockOptionRow';
import { OptionRow } from './OptionRow';
import { optionLabel } from './option-label';

type FlowNodeData = {
  node: BotNode;
  isEntry: boolean;
  issues: BotIssue[];
  targets: FlowTarget[];
  actions: FlowActions;
  /** Se puede agregar a este nodo una salida que pasa a una persona. */
  canHandoff: boolean;
  /** Paso en el que va la simulación; el lienzo lo resalta. */
  active?: boolean;
};
export type FlowNode = Node<FlowNodeData, 'flow'>;

export function nodePreview(node: BotNode): string {
  if (node.kind === 'action') return node.action ? `Ejecuta: ${ACTION_CATALOG[node.action].label}` : 'Falta elegir la acción';
  return node.body;
}

/** Nodo del lienzo: encabezado, vista previa del texto, problemas y las opciones editables con su salida. */
export function FlowNodeCard({ data, selected }: NodeProps<FlowNode>) {
  const { node, isEntry, issues, targets, actions, canHandoff } = data;
  const hasError = issues.some((issue) => issue.severity === 'error');
  const tone = hasError ? 'border-danger-border' : issues.length > 0 ? 'border-warning-border' : 'border-border';
  const noun = node.kind === 'list' ? 'fila' : 'botón';
  const exits = targets.filter((target) => target.exit);
  return <div className={cn('w-72 rounded-xl border bg-card text-sm', tone, selected && 'ring-2 ring-ring')}>
    <Handle type="target" position={Position.Left} role="img" aria-label={`Entrada de ${node.name}`} />
    <div className="flex items-start gap-2 px-3 pt-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{node.name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <StatusBadge>{KIND_LABELS[node.kind]}</StatusBadge>
          {node.block ? <StatusBadge tone="info">Bloque de compra</StatusBadge> : null}
          {node.condition ? <StatusBadge tone="info">Condición</StatusBadge> : null}
          {isEntry ? <StatusBadge tone="brand">Entrada</StatusBadge> : null}
        </div>
      </div>
      <Button type="button" size="icon-sm" variant="ghost" className="nodrag" aria-label={`Eliminar ${node.name}`} disabled={isEntry || node.block !== undefined}
        onClick={() => actions.removeNode(node.id)}><Trash2 /></Button>
    </div>
    <p className="line-clamp-3 px-3 pt-2 pb-2 text-xs whitespace-pre-wrap text-muted-foreground">{nodePreview(node)}</p>
    <EntryButton node={node} isEntry={isEntry} actions={actions} className="nodrag mx-3 mb-2" />
    <IssueList issues={issues} label={`Problemas de ${node.name}`} />
    {node.kind === 'text' && node.after ? <ul aria-label={`Opciones de ${node.name}`} className="border-t">
      {node.options.map((option, index) => <li key={option.id} className="relative border-b px-3 py-2 text-xs last:border-b-0">
        {optionLabel(node, option)}
        <Handle type="source" id={option.id} position={Position.Right} role="img" aria-label={`Salida de la respuesta ${index + 1} de ${node.name}`} />
      </li>)}
    </ul> : null}
    {node.kind === 'buttons' || node.kind === 'list' ? <>
      <ul aria-label={`Opciones de ${node.name}`}>
        {node.options.map((option, index) => {
          const handle = <Handle type="source" id={option.id} position={Position.Right} role="img" aria-label={`Salida del ${noun} ${index + 1} de ${node.name}`} />;
          return node.block || node.condition
            ? <BlockOptionRow key={option.id} node={node} option={option} exits={node.condition ? targets : exits} targets={targets} actions={actions}>{handle}</BlockOptionRow>
            : <OptionRow key={option.id} node={node} option={option} index={index} targets={targets} actions={actions}>{handle}</OptionRow>;
        })}
      </ul>
      {node.block || node.condition ? null : <div className="flex gap-2 border-t px-3 py-2">
        <Button type="button" size="sm" variant="outline" className="nodrag flex-1" disabled={!canAddOption(node)}
          onClick={() => actions.addOption(node.id)}><Plus />Agregar {noun}</Button>
        <Button type="button" size="sm" variant="outline" className="nodrag flex-1" disabled={!canHandoff}
          aria-label={`Agregar salida a una persona en ${node.name}`} onClick={() => actions.addHandoffOption(node.id)}><UserRound />Persona</Button>
      </div>}
    </> : null}
  </div>;
}
