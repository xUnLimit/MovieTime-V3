'use client';

import '@xyflow/react/dist/style.css';
import { useCallback, useMemo, useState } from 'react';
import {
  Background, Controls, MarkerType, ReactFlow, type Connection, type Edge, type NodeChange,
} from '@xyflow/react';
import { canAddHandoffOption, issuesByNode, layoutNodes, type NodePosition } from '@/modules/bot-config';
import type { BotDefinition, BotIssue } from '@/types/bot';
import type { FlowActions } from './flow-actions';
import { FlowNodeCard, type FlowNode } from './FlowNodeCard';

const nodeTypes = { flow: FlowNodeCard };
const CARD_WIDTH = 288;
const CARD_HEIGHT = 220;
type Size = { width: number; height: number };

type FlowCanvasProps = {
  def: BotDefinition;
  issues: readonly BotIssue[];
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  actions: FlowActions;
};

/** Lienzo de React Flow. Las posiciones viven solo en la sesion: el modelo persistido no guarda coordenadas. */
export function FlowCanvas({ def, issues, selectedId, onSelect, actions }: FlowCanvasProps) {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  if (def.nodes.some((node) => !(node.id in positions))) setPositions(layoutNodes(def, positions));

  const targets = useMemo(() => def.nodes.map((node) => ({ id: node.id, name: node.name, exit: node.block === undefined })), [def.nodes]);
  const problems = useMemo(() => issuesByNode(issues), [issues]);
  const nodes = useMemo<FlowNode[]>(() => def.nodes.map((node) => ({
    id: node.id, type: 'flow', position: positions[node.id] ?? { x: 0, y: 0 }, measured: sizes[node.id], initialWidth: CARD_WIDTH, initialHeight: CARD_HEIGHT,
    selected: node.id === selectedId, ariaLabel: `Nodo ${node.name}`,
    data: { node, isEntry: node.id === def.entryNodeId, issues: problems[node.id] ?? [], targets, actions, canHandoff: canAddHandoffOption(def, node) },
  })), [def, positions, sizes, selectedId, problems, targets, actions]);
  const edges = useMemo<Edge[]>(() => def.nodes.flatMap((node) => node.options
    .filter((option) => def.nodes.some((target) => target.id === option.next))
    .map((option) => ({
      id: `${node.id}:${option.id}`, source: node.id, sourceHandle: option.id, target: option.next,
      markerEnd: { type: MarkerType.ArrowClosed }, focusable: false,
    }))), [def.nodes]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        const { id, position } = change;
        setPositions((current) => ({ ...current, [id]: position as NodePosition }));
      } else if (change.type === 'dimensions' && change.dimensions) {
        const { id, dimensions } = change;
        setSizes((current) => ({ ...current, [id]: dimensions }));
      } else if (change.type === 'select' && change.selected) {
        onSelect(change.id);
      }
    }
  }, [onSelect]);
  const onConnect = useCallback((connection: Connection) => {
    if (connection.sourceHandle) actions.connect(connection.source, connection.sourceHandle, connection.target);
  }, [actions]);

  return <div className="h-[34rem] w-full rounded-md border bg-muted" role="region" aria-label="Lienzo del recorrido">
    <ReactFlow<FlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onConnect={onConnect}
      isValidConnection={(connection) => connection.source !== connection.target}
      deleteKeyCode={null} edgesFocusable={false} fitView fitViewOptions={{ maxZoom: 1, padding: 0.15 }} minZoom={0.2}>
      <Background gap={16} />
      <Controls showInteractive={false} />
    </ReactFlow>
  </div>;
}
