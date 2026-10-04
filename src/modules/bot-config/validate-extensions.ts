import type { BotDefinition, BotNode } from '@/types/bot';
import { CONDITION_OPTION_IDS, FALLBACK_VALUE, nodeVariablesIn } from './extensions';
import type { Report } from './validate-nodes';

function checkCondition(node: BotNode, def: BotDefinition, enabled: boolean, report: Report): void {
  const base = `nodes[${node.id}]`;
  if (!enabled) report(`${base}.condition`, 'Las condiciones no están activadas en este entorno y no se pueden publicar.');
  if (node.kind !== 'buttons') report(`${base}.kind`, 'Una condición es un nodo de botones y no se puede cambiar de tipo.');
  if (node.block) report(`${base}.condition`, 'Un bloque de compra no puede ser una condición.');
  if (node.id === def.entryNodeId) report('entryNodeId', 'El nodo de entrada no puede ser una condición: el cliente primero debe ver un menú.');
  const ids = node.options.map((option) => option.id);
  const exact = ids.length === 2 && Object.values(CONDITION_OPTION_IDS).every((id) => ids.includes(id));
  if (!exact) report(`${base}.options`, `Una condición tiene exactamente dos salidas: ${Object.values(CONDITION_OPTION_IDS).join(' y ')}.`);
  if (exact && node.options[0].next === node.options[1].next) {
    report(`${base}.options`, 'Las dos salidas de la condición llevan al mismo destino: la condición no cambia nada.', 'warning');
  }
}

/**
 * Reglas de las extensiones (condiciones y datos del pedido en los textos). Sin la bandera del servidor no se
 * pueden publicar, porque la version anterior de la aplicacion los mostraria como menus o marcadores sin resolver.
 */
export function validateExtensions(def: BotDefinition, report: Report, enabled: boolean): void {
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
