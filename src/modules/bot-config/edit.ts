import type { BotDefinition, BotMessageKey, BotNode, BotNodeKind, BotOption, BotParams } from '@/types/bot';
import { NODE_LIMITS, PARAM_CATALOG } from './catalog';
import { normalizeText } from './render';

const ID_MAX = 32;
const KIND_LABEL: Record<BotNodeKind, string> = {
  buttons: 'botones', list: 'lista', text: 'texto', action: 'accion', input: 'entrada', condition: 'condicion',
};
const DEFAULT_BODY = 'Escribe aquí el mensaje para el cliente.';
const DEFAULT_LIST_LABEL = 'Ver opciones';

/** Slug en minusculas sin acentos (letras, numeros y guion bajo); puede quedar vacio. */
export function slugify(text: string): string {
  const slug = normalizeText(text).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, ID_MAX).replace(/_+$/, '');
  return /^[0-9]/.test(slug) ? `n_${slug}`.slice(0, ID_MAX) : slug;
}

/** Id con formato slug que no esta en `taken`; agrega `_2`, `_3`... si hace falta. */
export function uniqueId(base: string, taken: readonly string[]): string {
  let root = slugify(base) || 'nodo';
  if (root.length < 2) root = `${root}_1`;
  if (!taken.includes(root)) return root;
  for (let n = 2; ; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${root.slice(0, ID_MAX - suffix.length)}${suffix}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

function mapNode(def: BotDefinition, nodeId: string, change: (node: BotNode) => BotNode): BotDefinition {
  if (!def.nodes.some((node) => node.id === nodeId)) return def;
  const nodes = def.nodes.map((node) => (node.id === nodeId ? change(node) : node));
  return nodes.every((node, index) => node === def.nodes[index]) ? def : { ...def, nodes };
}

export function addNode(def: BotDefinition, kind: BotNodeKind, name: string): BotDefinition {
  if (def.nodes.length >= NODE_LIMITS.nodesMax) return def;
  const label = name.trim() || `Nuevo nodo de ${KIND_LABEL[kind]}`;
  const id = uniqueId(slugify(label) || kind, def.nodes.map((node) => node.id));
  const node: BotNode = kind === 'action'
    ? { id, name: label, kind, body: '', options: [], action: 'handoff' }
    : {
      id, name: label, kind, body: DEFAULT_BODY, options: [],
      ...(kind === 'list' ? { listButtonLabel: DEFAULT_LIST_LABEL } : {}),
    };
  return { ...def, nodes: [...def.nodes, node] };
}

/** No permite borrar el nodo de entrada; limpia las opciones que apuntaban al nodo borrado. */
export function removeNode(def: BotDefinition, nodeId: string): BotDefinition {
  if (nodeId === def.entryNodeId || !def.nodes.some((node) => node.id === nodeId)) return def;
  return {
    ...def,
    nodes: def.nodes.filter((node) => node.id !== nodeId).map((node) => (
      node.options.some((option) => option.next === nodeId)
        ? { ...node, options: node.options.filter((option) => option.next !== nodeId) }
        : node
    )),
  };
}

function adaptKind(node: BotNode, kind: BotNodeKind): BotNode {
  const common = { id: node.id, name: node.name, kind, body: node.body };
  if (kind === 'action') return { ...common, body: '', options: [], action: node.action ?? 'handoff' };
  if (kind === 'text') return { ...common, options: [] };
  if (kind === 'list') return { ...common, options: node.options, listButtonLabel: node.listButtonLabel ?? DEFAULT_LIST_LABEL };
  return {
    ...common,
    options: node.options.slice(0, NODE_LIMITS.buttonsMax).map((option): BotOption => ({ id: option.id, title: option.title, next: option.next })),
  };
}

/** El id no se puede cambiar; al cambiar el tipo se ajustan opciones y campos propios del tipo. */
export function updateNode(def: BotDefinition, nodeId: string, patch: Partial<Omit<BotNode, 'id'>>): BotDefinition {
  return mapNode(def, nodeId, (node) => {
    const base = patch.kind !== undefined && patch.kind !== node.kind ? adaptKind(node, patch.kind) : node;
    return { ...base, ...patch, id: node.id };
  });
}

export function addOption(def: BotDefinition, nodeId: string): BotDefinition {
  return mapNode(def, nodeId, (node) => {
    const max = node.kind === 'buttons' ? NODE_LIMITS.buttonsMax : NODE_LIMITS.listRowsMax;
    if ((node.kind !== 'buttons' && node.kind !== 'list') || node.options.length >= max) return node;
    const target = def.entryNodeId !== node.id && def.nodes.some((n) => n.id === def.entryNodeId)
      ? def.entryNodeId : (def.nodes.find((n) => n.id !== node.id)?.id ?? node.id);
    const option: BotOption = {
      id: uniqueId('opcion', node.options.map((o) => o.id)), title: 'Nueva opción', next: target,
    };
    return { ...node, options: [...node.options, option] };
  });
}

export function removeOption(def: BotDefinition, nodeId: string, optionId: string): BotDefinition {
  return mapNode(def, nodeId, (node) => ({ ...node, options: node.options.filter((o) => o.id !== optionId) }));
}

/** Mueve una opcion de posicion; indices fuera de rango dejan la definicion igual. */
export function moveOption(def: BotDefinition, nodeId: string, from: number, to: number): BotDefinition {
  return mapNode(def, nodeId, (node) => {
    const last = node.options.length - 1;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from > last || to > last || from === to) return node;
    const options = [...node.options];
    const [moved] = options.splice(from, 1);
    options.splice(to, 0, moved);
    return { ...node, options };
  });
}

export function setMessage(def: BotDefinition, key: BotMessageKey, text: string): BotDefinition {
  return { ...def, messages: { ...def.messages, [key]: text } };
}

/** Redondea y ajusta al rango del catalogo; un valor no numerico no cambia nada. */
export function setParam(def: BotDefinition, key: keyof BotParams, value: number): BotDefinition {
  if (!Number.isFinite(value)) return def;
  const { min, max } = PARAM_CATALOG[key];
  return { ...def, params: { ...def.params, [key]: Math.min(max, Math.max(min, Math.round(value))) } };
}

/** Normaliza (sin acentos, minusculas), quita vacias y repetidas y respeta el tope. */
export function setKeywords(def: BotDefinition, keywords: string[]): BotDefinition {
  const clean = [...new Set(keywords.map(normalizeText).filter((word) => word !== ''))].slice(0, NODE_LIMITS.keywordsMax);
  return { ...def, keywords: clean };
}
