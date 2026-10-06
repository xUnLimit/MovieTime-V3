import type { BotDefinition, BotNode, BotOption, PurchaseBlockType } from '@/types/bot';
import {
  COPY_BLOCK_TYPES, COPY_CATALOG, blockCopyProblem, blockOfCopyKey, editableCopyKeysOfBlock, type CopyKey,
} from '@/modules/commerce-copy';
import { NODE_LIMITS } from './catalog';

type BlockOptionSpec = { id: string; copyKey: CopyKey; fixedNext?: PurchaseBlockType };
type BlockSpec = { id: string; name: string; body: string; options: readonly BlockOptionSpec[] };

/**
 * Bloques cerrados del flujo de compras: id, texto fijo y botones de cada uno. Lo que mueve dinero o inventario
 * (elegir, reservar, pagar, entregar) sigue en el servidor y en SQL; el grafo solo guarda textos y la salida de "cancelar".
 */
export const PURCHASE_BLOCKS: Record<PurchaseBlockType, BlockSpec> = {
  catalogo: {
    id: 'compra_catalogo', name: 'Compra: catálogo',
    body: 'Catálogo de compra. El cliente elige plataforma y plan; el servidor valida precios y cupos.',
    options: [{ id: 'resumen', copyKey: 'btnReview', fixedNext: 'resumen' }],
  },
  resumen: {
    id: 'compra_resumen', name: 'Compra: resumen',
    body: 'Resumen de compra. El cliente revisa su selección y la confirma antes de reservar.',
    options: [{ id: 'confirm', copyKey: 'btnConfirm', fixedNext: 'reserva' }, { id: 'cancel', copyKey: 'btnCancel' }],
  },
  reserva: {
    id: 'compra_reserva', name: 'Compra: reserva',
    body: 'Reserva de compra. El pedido queda apartado por un tiempo limitado; el servidor controla el cupo.',
    options: [{ id: 'pay', copyKey: 'btnPay', fixedNext: 'pago' }, { id: 'cancel', copyKey: 'btnCancel' }],
  },
  pago: {
    id: 'compra_pago', name: 'Compra: pago y entrega',
    body: 'Pago y entrega. Solo un pago verificado en el servidor entrega el acceso.',
    options: [{ id: 'cancel', copyKey: 'btnCancel' }],
  },
};

export const PURCHASE_BLOCK_TYPES: readonly PurchaseBlockType[] = COPY_BLOCK_TYPES;
export const hasPurchaseBlocks = (def: BotDefinition): boolean => def.nodes.some((node) => node.block !== undefined);

/** Boton con destino fijo (la cadena catalogo, resumen, reserva, pago) o con titulo que viene de un texto del bloque. */
export function blockOptionSpec(node: BotNode, optionId: string): BlockOptionSpec | undefined {
  return node.block ? PURCHASE_BLOCKS[node.block.type].options.find((option) => option.id === optionId) : undefined;
}

function effectiveText(def: BotDefinition, key: CopyKey): string {
  const owner = def.nodes.find((node) => node.block?.type === blockOfCopyKey(key));
  return owner?.block?.copy[key] ?? COPY_CATALOG[key].defaultText;
}

/** Los titulos de los botones del grafo copian los textos de botones del bloque (nunca al reves). */
function syncTitles(def: BotDefinition): BotDefinition {
  const nodes = def.nodes.map((node): BotNode => {
    if (!node.block) return node;
    const options = node.options.map((option): BotOption => {
      const spec = blockOptionSpec(node, option.id);
      return spec ? { ...option, title: effectiveText(def, spec.copyKey).slice(0, NODE_LIMITS.buttonTitleMax) } : option;
    });
    return { ...node, options };
  });
  return { ...def, nodes };
}

/**
 * Agrega los cuatro bloques (sembrados con los textos editados hoy, salvo los que el bot ya no usa) sin conectarlos:
 * falta enlazar el catalogo desde el recorrido.
 */
export function addPurchaseFlow(def: BotDefinition, overrides: Readonly<Record<string, string>> = {}): BotDefinition {
  const ids = new Set(def.nodes.map((node) => node.id));
  const taken = PURCHASE_BLOCK_TYPES.some((type) => ids.has(PURCHASE_BLOCKS[type].id));
  if (hasPurchaseBlocks(def) || taken || def.nodes.length + PURCHASE_BLOCK_TYPES.length > NODE_LIMITS.nodesMax) return def;
  const exit = def.nodes.some((node) => node.id === def.entryNodeId) ? def.entryNodeId : def.nodes[0]?.id;
  if (exit === undefined) return def;
  const nodes = PURCHASE_BLOCK_TYPES.map((type): BotNode => {
    const spec = PURCHASE_BLOCKS[type];
    const copy: Record<string, string> = {};
    for (const key of editableCopyKeysOfBlock(type)) {
      const text = overrides[key];
      if (typeof text === 'string' && blockCopyProblem(type, key, text) === null) copy[key] = text.trim();
    }
    return {
      id: spec.id, name: spec.name, kind: 'buttons', body: spec.body, block: { type, copy },
      options: spec.options.map((option) => ({ id: option.id, title: option.copyKey, next: option.fixedNext ? PURCHASE_BLOCKS[option.fixedNext].id : exit })),
    };
  });
  return syncTitles({ ...def, nodes: [...def.nodes, ...nodes] });
}

/**
 * El flujo de compras listo para editar sus textos: el mismo borrador si ya tiene los bloques y, si no, con los cuatro bloques
 * agregados sin conectar. Los bloques sin enlazar no cambian lo que el bot hace: solo guardan textos.
 */
export function withPurchaseBlocks(def: BotDefinition): BotDefinition {
  return hasPurchaseBlocks(def) ? def : addPurchaseFlow(def);
}

/** Quita los bloques y las opciones del recorrido que llevaban a ellos. */
export function removePurchaseFlow(def: BotDefinition): BotDefinition {
  const blockIds = new Set(def.nodes.filter((node) => node.block).map((node) => node.id));
  if (blockIds.size === 0 || blockIds.has(def.entryNodeId)) return def;
  return {
    ...def,
    nodes: def.nodes.filter((node) => !blockIds.has(node.id)).map((node) => (
      node.options.some((option) => blockIds.has(option.next))
        ? { ...node, options: node.options.filter((option) => !blockIds.has(option.next)) } : node)),
  };
}

/** Guarda o restaura (`null`) un texto del bloque. Una clave ajena o un texto invalido no cambia nada. */
export function setBlockCopy(def: BotDefinition, nodeId: string, key: string, text: string | null): BotDefinition {
  const node = def.nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.block) return def;
  const copy = { ...node.block.copy };
  if (text === null) delete copy[key];
  else if (blockCopyProblem(node.block.type, key, text) === null) copy[key] = text.trim();
  else return def;
  const block = { ...node.block, copy };
  return syncTitles({ ...def, nodes: def.nodes.map((candidate) => (candidate.id === nodeId ? { ...candidate, block } : candidate)) });
}

/** Textos de todos los bloques por clave, listos para el flujo de compras. Solo incluye los que cumplen las reglas del mensaje. */
export function blockCopyOverrides(def: BotDefinition): Record<string, string> {
  const result: Record<string, string> = {};
  for (const node of def.nodes) {
    if (!node.block) continue;
    for (const [key, text] of Object.entries(node.block.copy)) {
      if (blockCopyProblem(node.block.type, key, text) === null) result[key] = text;
    }
  }
  return result;
}
