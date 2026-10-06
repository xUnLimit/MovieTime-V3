import { useCallback, useMemo, useState } from 'react';
import { MarkerType, type BuiltInEdge, type NodeChange } from '@xyflow/react';
import type { CopyStepId } from '@/modules/commerce-copy/catalog';
import { PURCHASE_DIAGRAM } from '@/modules/commerce-copy/flow';
import type { PurchaseStepData, PurchaseStepFlowNode } from './PurchaseStepNode';

/** Medidas del diagrama: la vista completa usa tarjetas anchas y el estudio, tarjetas compactas. */
const SIZES = {
  card: { width: 288, height: 210, column: 430, row: 250 },
  compact: { width: 224, height: 120, column: 350, row: 170 },
};

type DiagramInput = {
  steps: readonly { id: CopyStepId }[];
  data: ReadonlyMap<CopyStepId, PurchaseStepData>;
  current: CopyStepId | undefined;
  compact?: boolean;
};

/** Nodos y flechas del flujo de compra, con la medición que React Flow necesita para terminar de dibujar. */
export function usePurchaseDiagram({ steps, data, current, compact = false }: DiagramInput) {
  const size = SIZES[compact ? 'compact' : 'card'];
  // React Flow mide las tarjetas y avisa por `onNodesChange`; sin guardarlas los nodos nunca terminan de medirse.
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const onNodesChange = useCallback((changes: NodeChange<PurchaseStepFlowNode>[]) => {
    for (const change of changes) {
      if (change.type === 'dimensions' && change.dimensions) {
        const { id, dimensions } = change;
        setSizes((previous) => (previous[id]?.width === dimensions.width && previous[id]?.height === dimensions.height ? previous : { ...previous, [id]: dimensions }));
      }
    }
  }, []);
  const nodes = useMemo<PurchaseStepFlowNode[]>(() => steps.flatMap((step) => {
    const place = PURCHASE_DIAGRAM.positions[step.id];
    const info = data.get(step.id);
    return place && info ? [{ id: step.id, type: 'step' as const, position: { x: place.column * size.column, y: place.row * size.row }, data: { ...info, compact }, selected: step.id === current, measured: sizes[step.id], initialWidth: size.width, initialHeight: size.height,
      draggable: false, connectable: false, ariaLabel: `Paso ${info.title}` }] : [];
  }), [steps, data, current, sizes, size, compact]);
  const edges = useMemo<BuiltInEdge[]>(() => PURCHASE_DIAGRAM.edges.filter((edge) => data.has(edge.from) && data.has(edge.to)).map((edge) => {
    const active = edge.from === current || edge.to === current;
    const color = active ? 'var(--primary)' : 'var(--muted-foreground)';
    return {
      id: `${edge.from}:${edge.to}`, source: edge.from, target: edge.to, sourceHandle: `out-${edge.out}`, targetHandle: `in-${edge.in}`, type: 'smoothstep' as const,
      pathOptions: { borderRadius: 14, offset: 24 }, zIndex: active ? 1000 : 0, focusable: false, label: edge.label,
      style: { stroke: color, strokeWidth: active ? 2.5 : 1.75, opacity: active ? 1 : 0.7 }, markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
      labelShowBg: true, labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 6,
      labelStyle: { fill: 'var(--foreground)', fontSize: 12, fontWeight: 500 }, labelBgStyle: { fill: 'var(--card)', stroke: 'var(--border)' },
    } satisfies BuiltInEdge;
  }), [data, current]);
  return { nodes, edges, onNodesChange };
}
