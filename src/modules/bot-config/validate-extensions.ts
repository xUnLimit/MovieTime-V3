import type { BotDefinition, BotNode } from '@/types/bot';
import { CONDITION_OPTION_IDS, FALLBACK_VALUE, MAX_CONDITION_HOPS, nodeVariablesIn } from './extensions';
import type { Report } from './validate-nodes';

function checkCondition(node: BotNode, def: BotDefinition, enabled: boolean, report: Report): void {
  const base = `nodes[${node.id}]`;
  if (!enabled) report(`${base}.condition`, 'Las condiciones no están activadas en este entorno y no se pueden publicar.');
  if (node.kind !== 'buttons') report(`${base}.kind`, 'Una condición es un nodo de botones y no se puede cambiar de tipo.');
  if (node.block) report(`${base}.condition`, 'Un bloque de compra no puede ser una condición.');
  const ids = node.options.map((option) => option.id);
  const exact = ids.length === 2 && Object.values(CONDITION_OPTION_IDS).every((id) => ids.includes(id));
  if (!exact) report(`${base}.options`, `Una condición tiene exactamente dos salidas: ${Object.values(CONDITION_OPTION_IDS).join(' y ')}.`);
  if (exact && node.options[0].next === node.options[1].next) {
    // Como entrada, una condicion que lleva al mismo lugar no separa a clientes nuevos y existentes: es un error.
    const asEntry = node.id === def.entryNodeId;
    report(`${base}.options`, asEntry
      ? 'Las dos salidas de la entrada llevan al mismo lugar, así que no separan a clientes nuevos y existentes. Elige un destino distinto para cada una.'
      : 'Las dos salidas de la condición llevan al mismo destino: la condición no cambia nada.', asEntry ? 'error' : 'warning');
  }
}

/**
 * Si la entrada es una condicion, el servidor la resuelve antes de mostrar nada. Una cadena de condiciones que vuelve
 * sobre si misma, o de mas de MAX_CONDITION_HOPS seguidas, dejaria al cliente sin respuesta, asi que se bloquea.
 */
function checkEntryChain(def: BotDefinition, report: Report): void {
  const byId = new Map(def.nodes.map((node) => [node.id, node]));
  const entry = byId.get(def.entryNodeId);
  if (!entry?.condition) return;
  const walk = (node: BotNode, path: readonly string[]): string | null => {
    if (path.includes(node.id)) return 'Las condiciones de la entrada se llevan unas a otras en círculo. Haz que cada camino termine en un menú, un mensaje o una acción.';
    if (path.length >= MAX_CONDITION_HOPS) return `Hay más de ${MAX_CONDITION_HOPS} condiciones seguidas desde la entrada. Quita alguna para que el cliente llegue a un mensaje.`;
    for (const option of node.options) {
      const next = byId.get(option.next);
      const problem = next?.condition ? walk(next, [...path, node.id]) : null;
      if (problem) return problem;
    }
    return null;
  };
  const problem = walk(entry, []);
  if (problem) report('entryNodeId', problem);
}

/**
 * Reglas de las extensiones (condiciones y datos del pedido en los textos). Sin la bandera del servidor no se
 * pueden publicar, porque la version anterior de la aplicacion los mostraria como menus o marcadores sin resolver.
 */
export function validateExtensions(def: BotDefinition, report: Report, enabled: boolean): void {
  checkEntryChain(def, report);
  for (const node of def.nodes) {
    const base = `nodes[${node.id}]`;
    if (node.condition) checkCondition(node, def, enabled, report);
    const used = node.kind === 'action' ? [] : nodeVariablesIn(node.body);
    if (used.length > 0 && !enabled) {
      report(`${base}.body`, 'Los datos del pedido en los textos no están activados en este entorno y no se pueden publicar.');
    } else if (used.length > 0) {
      report(`${base}.body`, `Si el cliente no tiene un pedido abierto, los datos del pedido se mostrarán como «${FALLBACK_VALUE}».`, 'warning');
    }
    node.options.forEach((option, index) => {
      if (nodeVariablesIn(option.title).length > 0 || nodeVariablesIn(option.description ?? '').length > 0) {
        report(`${base}.options[${index}]`, 'Los títulos y descripciones de las opciones no admiten datos del pedido.');
      }
    });
  }
}
