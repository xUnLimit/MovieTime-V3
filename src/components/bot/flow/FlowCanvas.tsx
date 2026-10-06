'use client';

import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, Controls, MarkerType, Panel as FlowPanel, ReactFlow, type Connection, type NodeChange, type BuiltInEdge,
} from '@xyflow/react';
import { LayoutGrid, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/platform/utils';
import { COMPACT_SPACING, canAddHandoffOption, issuesByNode, layoutNodes, type NodePosition } from '@/modules/bot-config';
import type { BotDefinition, BotIssue } from '@/types/bot';
import type { FlowActions } from './flow-actions';
import { clearFlowLayout, loadFlowLayout, saveFlowLayout } from './flow-layout-storage';
import { CompactNodeCard } from './CompactNodeCard';
import { FlowNodeCard, type FlowNode } from './FlowNodeCard';

const nodeTypes = { flow: FlowNodeCard };
const compactNodeTypes = { flow: CompactNodeCard };
const CARD_WIDTH = 288;
const CARD_HEIGHT = 220;
const COMPACT_WIDTH = 224;
const COMPACT_HEIGHT = 130;
type Size = { width: number; height: number };

/** Ctrl o Cmd + rueda acerca el lienzo; la rueda sola desplaza la pagina para no atrapar el scroll. */
const ZOOM_KEYS = ['Control', 'Meta'];

type FlowCanvasProps = {
  def: BotDefinition;
  issues: readonly BotIssue[];
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  actions: FlowActions;
  /** Dentro del estudio: nodos compactos (solo estructura; se editan en el inspector) y el lienzo llena su columna. */
  embedded?: boolean;
  /** Nodo que la simulación está mostrando. */
  activeId?: string | null;
};

/**
 * Lienzo de React Flow. Las posiciones que el usuario deja al arrastrar se recuerdan en este navegador (`flow-layout-storage`),
 * no en la definición del bot: sobreviven a recargar y los nodos nuevos o sin mover se acomodan solos.
 */
export function FlowCanvas({ def, issues, selectedId, onSelect, actions, embedded = false, activeId = null }: FlowCanvasProps) {
  const variant = embedded ? 'compact' : 'card';
  const spacing = embedded ? COMPACT_SPACING : undefined;
  const [positions, setPositions] = useState<Record<string, NodePosition>>(() => loadFlowLayout(variant));
  const dragged = useRef<Record<string, NodePosition>>({});
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const heights = Object.fromEntries(Object.entries(sizes).map(([id, size]) => [id, size.height]));
  if (def.nodes.some((node) => !(node.id in positions))) setPositions(layoutNodes(def, positions, heights, spacing));

  const targets = useMemo(() => def.nodes.map((node) => ({ id: node.id, name: node.name, exit: node.block === undefined })), [def.nodes]);
  const problems = useMemo(() => issuesByNode(issues), [issues]);
  const nodes = useMemo<FlowNode[]>(() => def.nodes.map((node) => ({
    id: node.id, type: 'flow', position: positions[node.id] ?? { x: 0, y: 0 }, measured: sizes[node.id], initialWidth: embedded ? COMPACT_WIDTH : CARD_WIDTH, initialHeight: embedded ? COMPACT_HEIGHT : CARD_HEIGHT,
    selected: node.id === selectedId, ariaLabel: `Nodo ${node.name}`,
    data: { node, isEntry: node.id === def.entryNodeId, issues: problems[node.id] ?? [], targets, actions, canHandoff: canAddHandoffOption(def, node), active: node.id === activeId },
  })), [def, positions, sizes, selectedId, problems, targets, actions, activeId, embedded]);
  // Las lineas del nodo elegido (entrantes y salientes) suben al frente, se engrosan y se rotulan con el boton que las origina.
  const edges = useMemo<BuiltInEdge[]>(() => def.nodes.flatMap((node) => node.options
    .filter((option) => def.nodes.some((target) => target.id === option.next))
    .map((option) => {
      const active = selectedId !== null && (node.id === selectedId || option.next === selectedId);
      const color = active ? 'var(--primary)' : 'var(--muted-foreground)';
      return {
        id: `${node.id}:${option.id}`, source: node.id, sourceHandle: option.id, target: option.next, type: 'smoothstep' as const,
        pathOptions: { borderRadius: 14, offset: 28 }, zIndex: active ? 1000 : 0, focusable: false,
        style: { stroke: color, strokeWidth: active ? 2.5 : 1.75, opacity: selectedId === null || active ? 1 : 0.55 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        label: active ? option.title : undefined,
        labelShowBg: true, labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 6,
        labelStyle: { fill: 'var(--foreground)', fontSize: 12, fontWeight: 500 },
        labelBgStyle: { fill: 'var(--card)', stroke: 'var(--border)' },
      } satisfies BuiltInEdge;
    })), [def.nodes, selectedId]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    for (const change of changes) {
      if (change.type === 'position' && (change.position || change.dragging === false)) {
        const { id } = change;
        const position = (change.position ?? dragged.current[id]) as NodePosition | undefined;
        if (!position) continue;
        setPositions((current) => ({ ...current, [id]: position }));
        dragged.current[id] = position;
        // Se guarda al soltar el nodo, no en cada cuadro del arrastre.
        if (change.dragging !== true) saveFlowLayout({ [id]: position }, variant);
      } else if (change.type === 'dimensions' && change.dimensions) {
        const { id, dimensions } = change;
        setSizes((current) => ({ ...current, [id]: dimensions }));
      } else if (change.type === 'select' && change.selected) {
        onSelect(change.id);
      }
    }
  }, [onSelect, variant]);
  const onConnect = useCallback((connection: Connection) => {
    if (connection.sourceHandle) actions.connect(connection.source, connection.sourceHandle, connection.target);
  }, [actions]);

  const arrange = useCallback(() => {
    clearFlowLayout(def.nodes.map((node) => node.id), variant);
    dragged.current = {};
    setPositions(layoutNodes(def, {}, Object.fromEntries(Object.entries(sizes).map(([id, size]) => [id, size.height])), spacing));
  }, [def, sizes, variant, spacing]);

  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [expanded]);

  return <div className={cn('w-full bg-muted', embedded ? 'h-full' : 'rounded-md border', expanded ? 'fixed inset-3 z-50 h-auto rounded-md border bg-background' : !embedded && 'h-[min(40rem,75vh)]')} role="region" aria-label="Lienzo del recorrido">
    <ReactFlow<FlowNode> nodes={nodes} edges={edges} nodeTypes={embedded ? compactNodeTypes : nodeTypes} onNodesChange={onNodesChange} onConnect={onConnect}
      isValidConnection={(connection) => connection.source !== connection.target}
      zoomOnScroll={false} preventScrolling={false} zoomActivationKeyCode={ZOOM_KEYS} elevateEdgesOnSelect
      deleteKeyCode={null} edgesFocusable={false} fitView fitViewOptions={{ maxZoom: 1, padding: 0.15 }} minZoom={0.2}>
      <Background gap={16} />
      <Controls showInteractive={false} />
      <FlowPanel position="top-right" className="flex items-center gap-2">
        {embedded ? null : <span className="hidden rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground sm:block">Arrastra el fondo para mover · Ctrl + rueda para acercar</span>}
        <Button type="button" size="sm" variant="outline" aria-label="Ordenar automáticamente" title="Vuelve a acomodar los nodos con el orden automático" onClick={arrange}><LayoutGrid />Ordenar</Button>
        <Button type="button" size="icon-sm" variant="outline" aria-pressed={expanded} aria-label={expanded ? 'Salir de pantalla completa' : 'Ampliar el lienzo'}
          onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 /> : <Maximize2 />}</Button>
      </FlowPanel>
    </ReactFlow>
  </div>;
}
