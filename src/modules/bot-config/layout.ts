import type { BotDefinition, BotIssue } from '@/types/bot';
import { buildFlowGraph } from './graph';

export type NodePosition = { x: number; y: number };

const COLUMN_WIDTH = 400;
const CARD_BASE_HEIGHT = 150;
const OPTION_HEIGHT = 96;
const CARD_GAP = 32;

/**
 * Posiciones iniciales del lienzo: un nivel del recorrido por columna (calculado con `buildFlowGraph`) y
 * los nodos de cada nivel apilados segun la altura real medida en el lienzo (`measured`) o, si aun no existe, la estimada.
 * `saved` conserva lo que el usuario movio.
 */
export function layoutNodes(
  def: BotDefinition,
  saved: Readonly<Record<string, NodePosition>> = {},
  measured: Readonly<Record<string, number>> = {},
): Record<string, NodePosition> {
  const graph = buildFlowGraph(def);
  const optionCount = new Map(def.nodes.map((node) => [node.id, node.options.length]));
  const levels = [...new Set(graph.nodes.map((vertex) => vertex.y))].sort((a, b) => a - b);
  const positions: Record<string, NodePosition> = {};
  levels.forEach((level, column) => {
    let top = 0;
    graph.nodes.filter((vertex) => vertex.y === level).sort((a, b) => a.x - b.x).forEach((vertex) => {
      positions[vertex.id] = saved[vertex.id] ?? { x: column * COLUMN_WIDTH, y: top };
      top += (measured[vertex.id] ?? CARD_BASE_HEIGHT + (optionCount.get(vertex.id) ?? 0) * OPTION_HEIGHT) + CARD_GAP;
    });
  });
  return positions;
}

/** Agrupa los problemas por nodo afectado (rutas `nodes[id]...`). */
export function issuesByNode(issues: readonly BotIssue[]): Record<string, BotIssue[]> {
  const grouped: Record<string, BotIssue[]> = {};
  for (const issue of issues) {
    const id = /^nodes\[([^\]]+)\]/.exec(issue.path)?.[1];
    if (id !== undefined) (grouped[id] ??= []).push(issue);
  }
  return grouped;
}

/** Problemas del flujo completo que no pertenecen a un nodo (sin nodos, entrada inexistente, tope de nodos). */
export function flowWideIssues(issues: readonly BotIssue[]): BotIssue[] {
  return issues.filter((issue) => issue.path === 'nodes' || issue.path === 'entryNodeId');
}
