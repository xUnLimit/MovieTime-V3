'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { NODE_LIMITS } from '@/modules/bot-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BotNode, BotOption } from '@/types/bot';
import type { FlowActions, FlowTarget } from './flow-actions';

export const SELECT_CLASS = 'h-8 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm pointer-coarse:h-10';

type OptionRowProps = {
  node: BotNode;
  option: BotOption;
  index: number;
  targets: readonly FlowTarget[];
  actions: FlowActions;
  /** Punto de conexion del lienzo (Handle) que sale de esta opcion. */
  children?: ReactNode;
};

/** Boton o fila editable: renombrar, reordenar, borrar y elegir a donde lleva. Lo usan el nodo y el panel. */
export function OptionRow({ node, option, index, targets, actions, children }: OptionRowProps) {
  const label = `${node.kind === 'list' ? 'fila' : 'botón'} ${index + 1} de ${node.name}`;
  const titleMax = node.kind === 'list' ? NODE_LIMITS.listTitleMax : NODE_LIMITS.buttonTitleMax;
  const knownTarget = targets.some((target) => target.id === option.next);
  return <li className="relative space-y-1.5 border-t px-3 py-2">
    <div className="flex items-center gap-1">
      <Input className="nodrag min-w-0 flex-1" aria-label={`Título del ${label}`} maxLength={titleMax} value={option.title}
        onChange={(event) => actions.updateOption(node.id, option.id, { title: event.target.value })} />
      <Button type="button" size="icon-sm" variant="ghost" className="nodrag" aria-label={`Subir ${label}`} disabled={index === 0}
        onClick={() => actions.moveOption(node.id, index, index - 1)}><ChevronUp /></Button>
      <Button type="button" size="icon-sm" variant="ghost" className="nodrag" aria-label={`Bajar ${label}`} disabled={index === node.options.length - 1}
        onClick={() => actions.moveOption(node.id, index, index + 1)}><ChevronDown /></Button>
      <Button type="button" size="icon-sm" variant="ghost" className="nodrag" aria-label={`Quitar ${label}`}
        onClick={() => actions.removeOption(node.id, option.id)}><Trash2 /></Button>
    </div>
    {node.kind === 'list' ? <Input className="nodrag" aria-label={`Descripción de la ${label}`} maxLength={NODE_LIMITS.listDescriptionMax}
      placeholder="Descripción (opcional)" value={option.description ?? ''}
      onChange={(event) => actions.updateOption(node.id, option.id, { description: event.target.value })} /> : null}
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="shrink-0">Lleva a</span>
      <select className={`${SELECT_CLASS} nodrag`} aria-label={`Destino del ${label}`} value={option.next}
        onChange={(event) => actions.connect(node.id, option.id, event.target.value)}>
        {knownTarget ? null : <option value={option.next}>Destino inexistente</option>}
        {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select>
    </div>
    {children}
  </li>;
}
