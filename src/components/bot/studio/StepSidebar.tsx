'use client';

import { useMemo, useState } from 'react';
import { GitBranch, KeyRound, Plus, Search, ShoppingCart } from 'lucide-react';
import { CONDITION_CATALOG, CONDITION_TYPES, canAddNode, issuesByNode, normalizeText } from '@/modules/bot-config';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/platform/utils';
import type { BotDefinition, BotIssue } from '@/types/bot';
import { kindLabel } from '../flow/CompactNodeCard';
import { KINDS, KIND_LABELS, type FlowActions } from '../flow/flow-actions';

type StepSidebarProps = {
  def: BotDefinition;
  issues: readonly BotIssue[];
  selectedId: string;
  onSelect: (nodeId: string) => void;
  actions: FlowActions;
  extensionsEnabled: boolean;
  /** Hay bloques de compra enlazados desde el recorrido: se ofrece quitarlos. Los textos de compra se editan sin agregarlos. */
  purchaseLinked: boolean;
  className?: string;
};


/** Menú único para agregar: tipos de paso, condiciones y flujo de compras. */
function AddStepMenu({ def, actions, extensionsEnabled, purchaseLinked }: Pick<StepSidebarProps, 'def' | 'actions' | 'extensionsEnabled' | 'purchaseLinked'>) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Agregar paso"><Plus /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-60">
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Nuevo paso</DropdownMenuLabel>
      {KINDS.map((kind) => <DropdownMenuItem key={kind} disabled={!canAddNode(def)} onSelect={() => actions.addNode(kind)}>{KIND_LABELS[kind]}</DropdownMenuItem>)}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!canAddNode(def)} onSelect={() => actions.addActionNode('service_access')}><KeyRound />Datos de acceso del cliente</DropdownMenuItem>
      {extensionsEnabled ? <>
        <DropdownMenuSeparator />
        {CONDITION_TYPES.map((type) => <DropdownMenuItem key={type} disabled={!canAddNode(def)} onSelect={() => actions.addCondition(type)}><GitBranch />Condición: {CONDITION_CATALOG[type].label.toLowerCase()}</DropdownMenuItem>)}
      </> : null}
      {purchaseLinked ? <>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={actions.removePurchaseFlow}><ShoppingCart />Quitar flujo de compras</DropdownMenuItem>
      </> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Lista de pasos con buscador: es la entrada de teclado y de celular al recorrido, y el índice del lienzo. */
export function StepSidebar({ def, issues, selectedId, onSelect, actions, extensionsEnabled, purchaseLinked, className }: StepSidebarProps) {
  const [query, setQuery] = useState('');
  const problems = useMemo(() => issuesByNode(issues), [issues]);
  const needle = normalizeText(query);
  const visible = def.nodes.filter((node) => normalizeText(node.name).includes(needle));
  return <div className={cn('flex min-h-0 flex-col', className)}>
    <div className="flex items-center gap-2 border-b p-3">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" type="search" aria-label="Buscar paso" placeholder="Buscar paso…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <AddStepMenu def={def} actions={actions} extensionsEnabled={extensionsEnabled} purchaseLinked={purchaseLinked} />
    </div>
    <ul aria-label="Pasos del recorrido" className="min-h-0 flex-1 overflow-y-auto p-1.5">
      {visible.map((node) => {
        const nodeIssues = problems[node.id] ?? [];
        const hasError = nodeIssues.some((issue) => issue.severity === 'error');
        const outputs = node.options.length;
        return <li key={node.id}>
          <button type="button" aria-current={node.id === selectedId ? 'true' : undefined} onClick={() => onSelect(node.id)}
            className={cn('flex min-h-12 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-14',
              node.id === selectedId && 'bg-accent')}>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{node.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{kindLabel(node)}{outputs > 0 ? ` · ${outputs} ${outputs === 1 ? 'salida' : 'salidas'}` : ''}</span>
            </span>
            {node.id === def.entryNodeId ? <StatusBadge tone="brand">Entrada</StatusBadge> : null}
            {nodeIssues.length > 0 ? <StatusBadge tone={hasError ? 'danger' : 'warning'}>{hasError ? 'Error' : 'Aviso'}</StatusBadge> : null}
          </button>
        </li>;
      })}
      {visible.length === 0 ? <li className="px-2.5 py-6 text-center text-xs text-muted-foreground">Ningún paso coincide con «{query}».</li> : null}
    </ul>
  </div>;
}
