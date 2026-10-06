import type { BotDefinition, BotNode } from '@/types/bot';
import {
  ACTION_CATALOG, ACTION_KEYS, MAX_CONTINUE_HOPS, NODE_ID_PATTERN, NODE_KINDS, NODE_LIMITS, NODE_NAME_MAX_LENGTH, OPTION_ID_PATTERN, WAIT_HOURS,
} from './catalog';
import { reachableNodeIds } from './graph';
import { NODE_VARIABLE_NAMES } from './extensions';
import { templateVariables } from './render';

type Report = (path: string, message: string, severity?: 'error' | 'warning') => void;

/** Un texto que continúa solo o que espera la respuesta del cliente: cuántas salidas lleva y cómo se escriben sus respuestas. */
function checkTextAfter(node: BotNode, report: Report): void {
  const base = `nodes[${node.id}]`;
  const after = node.after;
  if (after?.mode === 'continue') {
    if (node.options.length !== 1) report(`${base}.options`, 'Elige a qué paso continúa este mensaje.');
    return;
  }
  if (after?.mode !== 'wait') return;
  const minutes = after.unit === 'minutes';
  const value = minutes ? after.hours * 60 : after.hours;
  const max = WAIT_HOURS.max * (minutes ? 60 : 1);
  if (!Number.isFinite(value) || Math.abs(value - Math.round(value)) > 1e-9 || value < 1 || value > max) {
    report(`${base}.after`, `El tiempo de espera debe ser un número entero de ${minutes ? 'minutos' : 'horas'} entre 1 y ${max}.`);
  }
  if (node.options.length === 0) report(`${base}.options`, 'Agrega al menos una respuesta o «cualquier otra respuesta».');
  if (node.options.length > NODE_LIMITS.listRowsMax) report(`${base}.options`, `Máximo ${NODE_LIMITS.listRowsMax} respuestas en un texto que espera al cliente.`);
  if (node.options.filter((option) => option.any).length > 1) report(`${base}.options`, 'Solo puede haber una «cualquier otra respuesta».');
}

function checkOptions(node: BotNode, ids: ReadonlySet<string>, report: Report): void {
  const base = `nodes[${node.id}]`;
  const max = node.kind === 'buttons' ? NODE_LIMITS.buttonsMax : NODE_LIMITS.listRowsMax;
  const textAfter = node.kind === 'text' && node.after !== undefined;
  if (node.kind === 'buttons' || node.kind === 'list') {
    if (node.options.length === 0) report(`${base}.options`, 'Agrega al menos una opción.');
    if (node.options.length > max) {
      report(`${base}.options`, `Máximo ${max} opciones en un nodo de ${node.kind === 'buttons' ? 'botones' : 'lista'}.`);
    }
  } else if (textAfter) {
    checkTextAfter(node, report);
  } else if (node.options.length > 0) {
    report(`${base}.options`, 'Este tipo de nodo no admite opciones.');
  }
  if (node.kind !== 'text' && node.after !== undefined) report(`${base}.after`, 'Solo los textos continúan o esperan una respuesta; se ignorará.', 'warning');
  const titleMax = node.kind === 'list' ? NODE_LIMITS.listTitleMax : NODE_LIMITS.buttonTitleMax;
  const taken = new Set<string>();
  node.options.forEach((option, index) => {
    const path = `${base}.options[${index}]`;
    if (!OPTION_ID_PATTERN.test(option.id)) report(`${path}.id`, 'El id de la opción debe ser un slug (minúsculas, números y guion bajo, hasta 32).');
    if (taken.has(option.id)) report(`${path}.id`, `El id de opción «${option.id}» está repetido en este nodo.`);
    taken.add(option.id);
    if (textAfter) {
      // En un texto que continúa el título no se usa; en uno que espera, son las palabras de la respuesta (salvo «cualquier otra»).
      if (node.after?.mode === 'wait' && !option.any) {
        if (option.title.trim() === '') report(`${path}.title`, 'Escribe las palabras de la respuesta (por ejemplo: sí, claro) o quítala.');
        if (option.title.length > NODE_LIMITS.answerMax) report(`${path}.title`, `Las palabras de la respuesta superan ${NODE_LIMITS.answerMax} caracteres.`);
      }
    } else {
      if (option.title.trim() === '') report(`${path}.title`, 'El título no puede estar vacío.');
      if (option.title.length > titleMax) report(`${path}.title`, `El título supera ${titleMax} caracteres.`);
    }
    if (option.description !== undefined && !textAfter) {
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
  // Un texto que continúa solo con otro nodo no termina nada: el final está donde llegue. Uno que espera al cliente sí se puede dejar ahí.
  const exits = new Set(def.nodes.filter((node) => (node.kind === 'text' && node.after?.mode !== 'continue') || node.kind === 'action').map((node) => node.id));
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

const CHAIN_JOIN = 2;

/**
 * Los textos que continúan solos viajan juntos en un único mensaje: la cadena no puede dar vueltas, no puede ser muy larga y su
 * texto junto con el del paso donde termina debe caber en un mensaje (si no, WhatsApp lo cortaría).
 */
function checkContinueChains(def: BotDefinition, report: Report): void {
  const byId = new Map(def.nodes.map((node) => [node.id, node]));
  for (const start of def.nodes.filter((node) => node.kind === 'text' && node.after?.mode === 'continue')) {
    const path = `nodes[${start.id}]`;
    const seen = new Set([start.id]);
    let current: BotNode = start;
    let length = start.body.length;
    for (let steps = 0; ; steps += 1) {
      const next = byId.get(current.options[0]?.next ?? '');
      if (!next || next.condition) break;
      if (seen.has(next.id)) {
        report(path, 'Estos mensajes se enviarían en bucle sin esperar al cliente. Quita una de las continuaciones.');
        break;
      }
      if (steps >= MAX_CONTINUE_HOPS) {
        report(path, `No puede haber más de ${MAX_CONTINUE_HOPS} mensajes seguidos sin esperar al cliente.`);
        break;
      }
      seen.add(next.id);
      const separate = current.after?.mode === 'continue' && current.after.delivery === 'separate';
      if (separate && length > NODE_LIMITS.bodyMax) report(path, `Estos textos juntos superan ${NODE_LIMITS.bodyMax} caracteres: se cortarían. Acórtalos o sepáralos.`);
      if (next.kind === 'action') {
        if (next.action !== 'handoff' && !separate) report(path, `El texto no se enviará: el paso siguiente («${next.name}») es una acción que no admite un texto antes.`, 'warning');
        break;
      }
      if (separate) {
        length = next.body.length;
      } else length += CHAIN_JOIN + next.body.length;
      if (next.kind === 'text' && next.after?.mode === 'continue') { current = next; continue; }
      if (length > NODE_LIMITS.bodyMax) report(path, `Este texto junto con el paso siguiente supera ${NODE_LIMITS.bodyMax} caracteres: se cortaría. Acórtalos o sepáralos.`);
      break;
    }
  }
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
    // Un bloque de compra sin enlazar no es un error: solo guarda los textos de la compra y el bot no lo recorre.
    if (reachable.has(node.id) || node.block !== undefined) continue;
    const label = node.kind === 'action' && node.action && ACTION_KEYS.includes(node.action)
      ? `Ningún botón lleva a la acción «${ACTION_CATALOG[node.action].label}». Conéctala a un botón o quítala.`
      : `Ningún botón lleva a «${node.name}». Conéctalo o márcalo como entrada.`;
    report(`nodes[${node.id}]`, label);
  }
  checkContinueChains(def, report);
  for (const id of deadEndNodes(def, reachable)) {
    report(`nodes[${id}]`, 'Desde este nodo el cliente da vueltas sin terminar. Agrega un botón que lleve a un mensaje final o a una acción.');
  }
}

export type { Report };
