import type { BotDefinition, BotNode, PurchaseBlockType } from '@/types/bot';
import { blockCopyProblem } from '@/modules/commerce-copy';
import { PURCHASE_BLOCKS, PURCHASE_BLOCK_TYPES } from './purchase-blocks';
import type { Report } from './validate-nodes';

/** Destinos que solo puede alcanzar el bloque anterior de la cadena: el orden protege reservas, pagos y entregas. */
const ORDER_RULES: Partial<Record<PurchaseBlockType, string>> = {
  resumen: 'El resumen solo se alcanza desde el catálogo de compra: el cliente debe revisar lo que eligió.',
  reserva: 'No se puede reservar sin confirmar el resumen: la reserva solo se alcanza desde el resumen.',
  pago: 'No se puede llegar al pago ni a la entrega sin reservar: el pago solo se alcanza desde la reserva.',
};

function checkBlockNode(node: BotNode, type: PurchaseBlockType, report: Report): void {
  const base = `nodes[${node.id}]`;
  const spec = PURCHASE_BLOCKS[type];
  if (node.id !== spec.id) report(`${base}.id`, `El bloque «${spec.name}» tiene una identidad fija: su id debe ser ${spec.id}.`);
  if (node.kind !== 'buttons') report(`${base}.kind`, 'Los bloques de compra son de botones y no se pueden cambiar de tipo.');
  const optionIds = node.options.map((option) => option.id);
  if (optionIds.length !== spec.options.length || spec.options.some((option) => !optionIds.includes(option.id))) {
    report(`${base}.options`, `Los botones de este bloque son fijos: ${spec.options.map((option) => option.id).join(', ')}.`);
  }
  node.options.forEach((option, index) => {
    const fixed = spec.options.find((candidate) => candidate.id === option.id)?.fixedNext;
    if (fixed && option.next !== PURCHASE_BLOCKS[fixed].id) {
      report(`${base}.options[${index}].next`, `Esta conexión es fija: continúa en «${PURCHASE_BLOCKS[fixed].name}».`);
    }
  });
  for (const [key, text] of Object.entries(node.block?.copy ?? {})) {
    const problem = blockCopyProblem(type, key, text);
    if (problem) report(`${base}.block.copy.${key}`, problem);
  }
}

/**
 * Reglas de los bloques de compra. Sin la bandera del servidor no se pueden publicar; con ella, la cadena
 * catalogo, resumen, reserva y pago debe estar completa, en orden y sin atajos desde el resto del recorrido.
 */
export function validateBlocks(def: BotDefinition, report: Report, enabled: boolean): void {
  const blocks = def.nodes.filter((node) => node.block !== undefined);
  if (blocks.length === 0) return;
  if (!enabled) {
    for (const node of blocks) report(`nodes[${node.id}].block`, 'Los bloques de compra no están activados en este entorno y no se pueden publicar.');
  }
  const blockIds = new Set(def.nodes.filter((node) => node.block).map((node) => node.id));
  for (const type of PURCHASE_BLOCK_TYPES) {
    const found = blocks.filter((node) => node.block?.type === type);
    if (found.length === 0) report('nodes', `Falta el bloque «${PURCHASE_BLOCKS[type].name}»: el flujo de compras debe estar completo o quitarse.`);
    if (found.length > 1) report(`nodes[${found[1].id}].block`, `El bloque «${PURCHASE_BLOCKS[type].name}» está repetido.`);
    found.forEach((node) => checkBlockNode(node, type, report));
  }
  for (const node of def.nodes.filter((candidate) => !candidate.block && PURCHASE_BLOCK_TYPES.some((type) => PURCHASE_BLOCKS[type].id === candidate.id))) {
    report(`nodes[${node.id}].id`, 'Este id está reservado para un bloque de compra.');
  }
  if (blockIds.has(def.entryNodeId)) report('entryNodeId', 'El nodo de entrada no puede ser un bloque de compra.');
  for (const node of def.nodes) {
    node.options.forEach((option, index) => {
      const target = def.nodes.find((candidate) => candidate.id === option.next)?.block;
      const rule = target ? ORDER_RULES[target.type] : undefined;
      if (!target || !rule) return;
      const previous = PURCHASE_BLOCK_TYPES[PURCHASE_BLOCK_TYPES.indexOf(target.type) - 1];
      if (node.block?.type !== previous) report(`nodes[${node.id}].options[${index}].next`, rule);
    });
    const own = node.block;
    if (own) {
      node.options.forEach((option, index) => {
        const spec = PURCHASE_BLOCKS[own.type].options.find((candidate) => candidate.id === option.id);
        if (spec && !spec.fixedNext && blockIds.has(option.next)) {
          report(`nodes[${node.id}].options[${index}].next`, 'Al cancelar, el cliente debe volver al recorrido, no a otro bloque de compra.');
        }
      });
    }
  }
}
