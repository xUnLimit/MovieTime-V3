'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/platform/utils';
import type { BotDefinition, BotIssue } from '@/types/bot';
import { KIND_LABELS, type FlowActions } from './flow-actions';
import { IssueList } from './IssueList';

type NodeListProps = {
  def: BotDefinition;
  problems: Record<string, BotIssue[]>;
  selectedId: string;
  onSelect: (nodeId: string) => void;
  actions: FlowActions;
};

/** Vista alternativa del lienzo (teclado, lector de pantalla y celular): cada nodo, sus problemas y a donde lleva. */
export function NodeList({ def, problems, selectedId, onSelect, actions }: NodeListProps) {
  const names = new Map(def.nodes.map((node) => [node.id, node.name]));
  return <ul aria-label="Lista de nodos" className="space-y-2">{def.nodes.map((node, index) => {
    const issues = problems[node.id] ?? [];
    return <li key={node.id} className={cn('rounded-md border', node.id === selectedId && 'border-ring')}>
      <div className="flex min-w-0 items-center gap-1 p-1">
        <button type="button" onClick={() => onSelect(node.id)} aria-current={node.id === selectedId ? 'true' : undefined}
          className="flex min-h-8 min-w-0 flex-1 flex-col items-start justify-center rounded-md px-2 text-left text-sm pointer-coarse:min-h-10 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          <span className="flex max-w-full items-center gap-2"><span className="truncate font-medium">{node.name}</span>
            <StatusBadge>{KIND_LABELS[node.kind]}</StatusBadge>
            {node.id === def.entryNodeId ? <StatusBadge tone="brand">Entrada</StatusBadge> : null}
            {issues.length > 0 ? <StatusBadge tone={issues.some((issue) => issue.severity === 'error') ? 'danger' : 'warning'}>{issues.length} {issues.length === 1 ? 'problema' : 'problemas'}</StatusBadge> : null}
          </span>
          {node.options.length > 0 ? <span className="max-w-full truncate text-xs text-muted-foreground">
            {node.options.map((option) => `${option.title} → ${names.get(option.next) ?? 'destino inexistente'}`).join(' · ')}
          </span> : null}
        </button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Subir ${node.name}`} disabled={index === 0}
          onClick={() => actions.moveNode(index, index - 1)}><ChevronUp /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Bajar ${node.name}`} disabled={index === def.nodes.length - 1}
          onClick={() => actions.moveNode(index, index + 1)}><ChevronDown /></Button>
      </div>
      <IssueList issues={issues} label={`Problemas de ${node.name}`} />
    </li>;
  })}</ul>;
}
