'use client';

import type { ReactNode } from 'react';
import { blockOptionSpec } from '@/modules/bot-config';
import type { BotNode, BotOption } from '@/types/bot';
import type { FlowActions, FlowTarget } from './flow-actions';
import { SELECT_CLASS } from './OptionRow';

type BlockOptionRowProps = {
  node: BotNode;
  option: BotOption;
  /** Nodos del recorrido (sin bloques de compra) a los que puede volver "cancelar". */
  exits: readonly FlowTarget[];
  targets: readonly FlowTarget[];
  actions: FlowActions;
  children?: ReactNode;
};

/** Boton de un bloque de compra: el titulo viene del texto del bloque y la conexion entre bloques es fija; solo "cancelar" elige destino. */
export function BlockOptionRow({ node, option, exits, targets, actions, children }: BlockOptionRowProps) {
  const fixed = blockOptionSpec(node, option.id)?.fixedNext !== undefined;
  const label = `botón ${option.title} de ${node.name}`;
  return <li className="relative space-y-1.5 border-t px-3 py-2">
    <p className="text-sm font-medium">{option.title}</p>
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {fixed
        ? <span>Continúa en {targets.find((target) => target.id === option.next)?.name ?? option.next} (fijo)</span>
        : <>
          <span className="shrink-0">Lleva a</span>
          <select className={`${SELECT_CLASS} nodrag`} aria-label={`Destino del ${label}`} value={option.next}
            onChange={(event) => actions.connect(node.id, option.id, event.target.value)}>
            {exits.some((target) => target.id === option.next) ? null : <option value={option.next}>Elige un destino</option>}
            {exits.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
          </select>
        </>}
    </div>
    {children}
  </li>;
}
