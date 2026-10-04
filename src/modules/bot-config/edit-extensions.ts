import type { BotConditionType, BotDefinition, BotNode, BotOption } from '@/types/bot';
import { NODE_LIMITS } from './catalog';
import { conditionOptions } from './condition-node';
import { uniqueId } from './edit';
import { CONDITION_CATALOG } from './extensions';

export const HANDOFF_NODE_ID = 'pasar_a_persona';
const HANDOFF_OPTION_TITLE = 'Hablar con alguien';

const handoffNode = (def: BotDefinition): BotNode | undefined => def.nodes.find((node) => node.kind === 'action' && node.action === 'handoff');

/** Nodo al que se lleva al cliente con una persona del equipo; reutiliza el que ya exista en el recorrido. */
export function findHandoffNode(def: BotDefinition): BotNode | undefined {
  return handoffNode(def);
}

/** Se puede agregar una salida «pasar a una persona» a este nodo (botones o lista con lugar y sin salida ya existente). */
export function canAddHandoffOption(def: BotDefinition, node: BotNode): boolean {
  if ((node.kind !== 'buttons' && node.kind !== 'list') || node.block || node.condition) return false;
  const max = node.kind === 'buttons' ? NODE_LIMITS.buttonsMax : NODE_LIMITS.listRowsMax;
  if (node.options.length >= max) return false;
  const existing = handoffNode(def);
  if (existing && node.options.some((option) => option.next === existing.id)) return false;
  return existing !== undefined || def.nodes.length < NODE_LIMITS.nodesMax;
}

/**
 * Agrega a un nodo una salida «Hablar con alguien» que lleva a una persona. Si el recorrido ya tiene un nodo de
 * pase a una persona lo reutiliza; si no, lo crea. Sin lugar o con la salida ya hecha, no cambia nada.
 */
export function addHandoffOption(def: BotDefinition, nodeId: string): BotDefinition {
  const node = def.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || !canAddHandoffOption(def, node)) return def;
  const existing = handoffNode(def);
  const target: BotNode = existing ?? {
    id: uniqueId(HANDOFF_NODE_ID, def.nodes.map((item) => item.id)), name: 'Pasar a una persona',
    kind: 'action', body: '', options: [], action: 'handoff',
  };
  const option: BotOption = { id: uniqueId('persona', node.options.map((item) => item.id)), title: HANDOFF_OPTION_TITLE, next: target.id };
  const nodes = def.nodes.map((item) => (item.id === nodeId ? { ...item, options: [...item.options, option] } : item));
  return { ...def, nodes: existing ? nodes : [...nodes, target] };
}

/** Agrega una condicion con sus dos salidas (si / no) apuntando de inicio al nodo de entrada. */
export function addConditionNode(def: BotDefinition, type: BotConditionType): BotDefinition {
  if (def.nodes.length >= NODE_LIMITS.nodesMax) return def;
  const spec = CONDITION_CATALOG[type];
  const next = def.nodes.some((node) => node.id === def.entryNodeId) ? def.entryNodeId : def.nodes[0]?.id;
  if (next === undefined) return def;
  const node: BotNode = {
    id: uniqueId(spec.label, def.nodes.map((item) => item.id)), name: spec.label, kind: 'buttons',
    body: spec.body, options: conditionOptions(type, next), condition: { type },
  };
  return { ...def, nodes: [...def.nodes, node] };
}
