import type { BotDefinition, BotNode } from '@/types/bot';
import {
  ACTION_CATALOG, ACTION_KEYS, NODE_ID_PATTERN, NODE_KINDS, NODE_LIMITS, NODE_NAME_MAX_LENGTH, OPTION_ID_PATTERN,
} from './catalog';
import { reachableNodeIds } from './graph';
import { NODE_VARIABLE_NAMES } from './extensions';
import { templateVariables } from './render';

type Report = (path: string, message: string, severity?: 'error' | 'warning') => void;

function checkOptions(node: BotNode, ids: ReadonlySet<string>, report: Report): void {
  const base = `nodes[${node.id}]`;
  const max = node.kind === 'buttons' ? NODE_LIMITS.buttonsMax : NODE_LIMITS.listRowsMax;
  if (node.kind === 'buttons' || node.kind === 'list') {
    if (node.options.length === 0) report(`${base}.options`, 'Agrega al menos una opción.');
    if (node.options.length > max) {
      report(`${base}.options`, `Máximo ${max} opciones en un nodo de ${node.kind === 'buttons' ? 'botones' : 'lista'}.`);
    }
  } else if (node.options.length > 0) {
    report(`${base}.options`, 'Este tipo de nodo no admite opciones.');
  }
  const titleMax = node.kind === 'list' ? NODE_LIMITS.listTitleMax : NODE_LIMITS.buttonTitleMax;
  const taken = new Set<string>();
  node.options.forEach((option, index) => {
    const path = `${base}.options[${index}]`;
    if (!OPTION_ID_PATTERN.test(option.id)) report(`${path}.id`, 'El id de la opción debe ser un slug (minúsculas, números y guion bajo, hasta 32).');
    if (taken.has(option.id)) report(`${path}.id`, `El id de opción «${option.id}» está repetido en este nodo.`);
    taken.add(option.id);
    if (option.title.trim() === '') report(`${path}.title`, 'El título no puede estar vacío.');
    if (option.title.length > titleMax) report(`${path}.title`, `El título supera ${titleMax} caracteres.`);
    if (option.description !== undefined) {
      if (node.kind !== 'list') report(`${path}.description`, 'La descripción solo se usa en listas y se ignorará.', 'warning');
      else if (option.description.length > NODE_LIMITS.listDescriptionMax) {
        report(`${path}.description`, `La descripción supera ${NODE_LIMITS.listDescriptionMax} caracteres.`);
      }
    }
    if (!ids.has(option.next)) report(`${path}.next`, `El destino «${option.next}» no existe.`);
  });
}

function checkNode(node: BotNode, ids: ReadonlySet<string>, report: Report): void {
  const base = `nodes[${node.id}]`;
  if (!NODE_KINDS.includes(node.kind)) report(`${base}.kind`, 'El tipo de nodo no es válido.');
  if (node.name.trim() === '') report(`${base}.name`, 'El nombre no puede estar vacío.');
  if (node.name.length > NODE_NAME_MAX_LENGTH) report(`${base}.name`, `El nombre supera ${NODE_NAME_MAX_LENGTH} caracteres.`);
  if (node.kind === 'action') {
    if (node.action === undefined || !ACTION_KEYS.includes(node.action)) {
      report(`${base}.action`, 'Elige una acción válida para este nodo.');
    }
    if (node.body.trim() !== '') report(`${base}.body`, 'Los nodos de acción no muestran texto; se ignorará.', 'warning');
  } else {
    if (node.body.trim() === '') report(`${base}.body`, 'El texto del mensaje no puede estar vacío.');
    if (node.action !== undefined) report(`${base}.action`, 'Solo los nodos de acción llevan acción; se ignorará.', 'warning');
  }
  if (node.body.length > NODE_LIMITS.bodyMax) report(`${base}.body`, `El texto supera ${NODE_LIMITS.bodyMax} caracteres.`);
  for (const name of templateVariables(node.body).filter((variable) => !NODE_VARIABLE_NAMES.includes(variable))) {
    report(`${base}.body`, `Los textos de los nodos no admiten el marcador {{${name}}}; quítalo o usa un dato del pedido permitido.`);
  }
  if (node.kind === 'list') {
    const label = node.listButtonLabel ?? '';
    if (label.trim() === '') report(`${base}.listButtonLabel`, 'Escribe el texto del botón que abre la lista.');
    if (label.length > NODE_LIMITS.listButtonMax) {
      report(`${base}.listButtonLabel`, `El texto del botón supera ${NODE_LIMITS.listButtonMax} caracteres.`);
    }
  }
  checkOptions(node, ids, report);
}

/**
 * Nodos alcanzables desde los que ningun camino llega a un texto o una accion (salidas reales). Un ciclo que
 * puede volver al menu o salir hacia un nodo final NO cuenta: solo los ciclos inescapables bloquean publicar.
 */
function deadEndNodes(def: BotDefinition, reachable: ReadonlySet<string>): string[] {
  const exits = new Set(def.nodes.filter((node) => node.kind === 'text' || node.kind === 'action').map((node) => node.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of def.nodes) {
      if (!exits.has(node.id) && node.options.some((option) => exits.has(option.next))) {
        exits.add(node.id);
        grew = true;
      }
    }
  }
  return [...new Set(def.nodes.map((node) => node.id))].filter((id) => reachable.has(id) && !exits.has(id));
}

/** Reglas de la seccion 4 que dependen del grafo de nodos. */
export function validateNodes(def: BotDefinition, report: Report): void {
  if (def.nodes.length === 0) report('nodes', 'El flujo necesita al menos un nodo.');
  if (def.nodes.length > NODE_LIMITS.nodesMax) report('nodes', `El flujo supera ${NODE_LIMITS.nodesMax} nodos.`);
  const ids = new Set(def.nodes.map((node) => node.id));
  if (!ids.has(def.entryNodeId)) report('entryNodeId', `El nodo de entrada «${def.entryNodeId}» no existe.`);
  const seen = new Set<string>();
  for (const node of def.nodes) {
    if (!NODE_ID_PATTERN.test(node.id)) report(`nodes[${node.id}].id`, 'El id del nodo debe ser un slug (minúsculas, números y guion bajo, de 2 a 32).');
    if (seen.has(node.id)) report(`nodes[${node.id}].id`, `El id de nodo «${node.id}» está repetido.`);
    seen.add(node.id);
    checkNode(node, ids, report);
  }
  const reachable = reachableNodeIds(def);
  for (const node of def.nodes) {
    if (reachable.has(node.id)) continue;
    const label = node.kind === 'action' && node.action && ACTION_KEYS.includes(node.action)
      ? `Ningún botón lleva a la acción «${ACTION_CATALOG[node.action].label}». Conéctala a un botón o quítala.`
      : `Ningún botón lleva a «${node.name}». Conéctalo o márcalo como entrada.`;
    report(`nodes[${node.id}]`, label);
  }
  for (const id of deadEndNodes(def, reachable)) {
    report(`nodes[${id}]`, 'Desde este nodo el cliente da vueltas sin terminar. Agrega un botón que lleve a un mensaje final o a una acción.');
  }
}

export type { Report };
