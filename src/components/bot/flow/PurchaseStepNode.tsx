'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/platform/utils';

export type PurchaseStepData = {
  title: string;
  description: string;
  /** Texto principal del paso tal como lo vería el cliente (con datos de ejemplo). */
  preview: string;
  total: number;
  edited: number;
  /** Tarjeta del estudio: más angosta y con menos texto, porque el paso se edita en el inspector. */
  compact?: boolean;
};
export type PurchaseStepFlowNode = Node<PurchaseStepData, 'step'>;

const SIDES = [['left', Position.Left], ['top', Position.Top], ['right', Position.Right], ['bottom', Position.Bottom]] as const;

/** Tarjeta de un paso de la compra: nombre, burbuja con su mensaje principal y cuántos textos lleva editados. */
function PurchaseStepCard({ title, description, preview, total, edited, compact = false, selected }: PurchaseStepData & { selected?: boolean }) {
  return <div className={cn('space-y-2 rounded-xl border bg-card p-3 text-sm', compact ? 'w-56' : 'w-72', selected && 'ring-2 ring-ring')}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 leading-tight">
        <p className="truncate font-medium">{title}</p>
        <p className={cn('text-xs text-muted-foreground', compact ? 'hidden' : 'line-clamp-2')}>{description}</p>
      </div>
      {edited > 0 ? <StatusBadge tone="info">{edited} {edited === 1 ? 'editado' : 'editados'}</StatusBadge> : null}
    </div>
    <p className={cn('rounded-lg rounded-tl-none border bg-muted px-2 py-1.5 text-xs whitespace-pre-wrap', compact ? 'line-clamp-2' : 'line-clamp-4')}>{preview || 'Sin mensaje'}</p>
    <p className="text-xs text-muted-foreground">{total} {total === 1 ? 'texto editable' : 'textos editables'}</p>
  </div>;
}

/** Nodo del diagrama de compra: solo se lee y se elige; la estructura del flujo es fija. */
export function PurchaseStepNode({ data, selected }: NodeProps<PurchaseStepFlowNode>) {
  return <div>
    {SIDES.map(([side, position]) => <Handle key={`in-${side}`} id={`in-${side}`} type="target" position={position} className="opacity-0" isConnectable={false} />)}
    {SIDES.map(([side, position]) => <Handle key={`out-${side}`} id={`out-${side}`} type="source" position={position} className="opacity-0" isConnectable={false} />)}
    <PurchaseStepCard {...data} selected={selected} />
  </div>;
}
