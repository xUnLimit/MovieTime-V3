'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/platform/utils';
import type { BotNode } from '@/types/bot';
import { KIND_LABELS } from './flow-actions';
import { nodePreview, type FlowNode } from './FlowNodeCard';
import { optionLabel } from './option-label';

export const kindLabel = (node: BotNode) => (node.block ? 'Bloque de compra' : node.condition ? 'Condición'
  : node.kind === 'text' && node.after ? `Texto · ${node.after.mode === 'wait' ? 'espera la respuesta' : 'continúa solo'}` : KIND_LABELS[node.kind]);

/** Nodo del estudio: solo estructura (nombre, tipo, texto y salidas). Todo lo editable vive en el inspector. */
export function CompactNodeCard({ data, selected }: NodeProps<FlowNode>) {
  const { node, isEntry, issues, active } = data;
  const hasError = issues.some((issue) => issue.severity === 'error');
  const tone = hasError ? 'border-danger-border' : issues.length > 0 ? 'border-warning-border' : 'border-border';
  const noun = node.kind === 'list' ? 'fila' : node.kind === 'text' ? 'respuesta' : 'botón';
  return <div className={cn('w-56 rounded-lg border bg-card text-sm', tone, active && 'border-primary', selected && 'ring-2 ring-ring')}>
    <Handle type="target" position={Position.Left} role="img" aria-label={`Entrada de ${node.name}`} />
    <div className="space-y-1 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 truncate font-medium">{node.name}</p>
        {isEntry ? <StatusBadge tone="brand">Entrada</StatusBadge> : null}
        {issues.length > 0 ? <StatusBadge tone={hasError ? 'danger' : 'warning'}>{hasError ? 'Error' : 'Aviso'}</StatusBadge> : null}
      </div>
      <p className="text-xs text-muted-foreground">{kindLabel(node)}</p>
      <p className="line-clamp-2 text-xs whitespace-pre-wrap text-muted-foreground">{nodePreview(node)}</p>
    </div>
    {node.options.length > 0 ? <ul aria-label={`Opciones de ${node.name}`} className="border-t">
      {node.options.map((option, index) => <li key={option.id} className="relative flex h-8 items-center border-b px-3 text-xs last:border-b-0">
        <span className="truncate">{optionLabel(node, option)}</span>
        <Handle type="source" id={option.id} position={Position.Right} role="img" aria-label={`Salida del ${noun} ${index + 1} de ${node.name}`} />
      </li>)}
    </ul> : null}
  </div>;
}
