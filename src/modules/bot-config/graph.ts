import type { BotDefinition, BotNodeKind } from '@/types/bot';
import { nodeEdges } from './node-edges';

type FlowGraphNode = {
  id: string; name: string; kind: BotNodeKind; x: number; y: number;
  width: number; height: number; reachable: boolean;
};
type FlowGraphEdge = { from: string; to: string; label: string };
export type FlowGraph = { nodes: FlowGraphNode[]; edges: FlowGraphEdge[]; width: number; height: number };

const NODE_WIDTH = 180;
const NODE_HEIGHT = 64;
const GAP_X = 32;
const GAP_Y = 56;
const PADDING = 16;
const ORPHANS_PER_ROW = 5;

/** Niveles por recorrido en anchura desde la entrada; tolera ciclos y destinos inexistentes. */
export function flowLevels(def: BotDefinition): string[][] {
  const byId = new Map(def.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const levels: string[][] = [];
  let current = byId.has(def.entryNodeId) ? [def.entryNodeId] : [];
  current.forEach((id) => seen.add(id));
  while (current.length > 0) {
    levels.push(current);
    const next: string[] = [];
    for (const id of current) {
      const node = byId.get(id);
      for (const option of node ? nodeEdges(node) : []) {
        if (!byId.has(option.next) || seen.has(option.next)) continue;
        seen.add(option.next);
        next.push(option.next);
      }
    }
    current = next;
  }
  return levels;
}

export function reachableNodeIds(def: BotDefinition): Set<string> {
  return new Set(flowLevels(def).flat());
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** Diseno determinista por niveles; los nodos inalcanzables van al final con `reachable: false`. */
export function buildFlowGraph(def: BotDefinition): FlowGraph {
  const reachable = reachableNodeIds(def);
  const orphans = [...new Set(def.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id))];
  const rows = [...flowLevels(def), ...chunk(orphans, ORPHANS_PER_ROW)];
  const byId = new Map(def.nodes.map((node) => [node.id, node]));
  const widest = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const innerWidth = widest === 0 ? 0 : widest * NODE_WIDTH + (widest - 1) * GAP_X;
  const nodes: FlowGraphNode[] = [];
  rows.forEach((row, level) => {
    const rowWidth = row.length * NODE_WIDTH + (row.length - 1) * GAP_X;
    const offset = Math.round((innerWidth - rowWidth) / 2);
    row.forEach((id, index) => {
      const node = byId.get(id);
      if (!node) return;
      nodes.push({
        id, name: node.name, kind: node.kind, reachable: reachable.has(id),
        x: PADDING + offset + index * (NODE_WIDTH + GAP_X),
        y: PADDING + level * (NODE_HEIGHT + GAP_Y),
        width: NODE_WIDTH, height: NODE_HEIGHT,
      });
    });
  });
  const edges: FlowGraphEdge[] = def.nodes.flatMap((node) => nodeEdges(node)
    .filter((option) => byId.has(option.next))
    .map((option) => ({ from: node.id, to: option.next, label: option.title })));
  const empty = rows.length === 0;
  return {
    nodes, edges,
    width: empty ? 0 : innerWidth + PADDING * 2,
    height: empty ? 0 : rows.length * NODE_HEIGHT + (rows.length - 1) * GAP_Y + PADDING * 2,
  };
}
