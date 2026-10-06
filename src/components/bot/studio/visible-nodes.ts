import { hasPurchaseBlocks } from '@/modules/bot-config';
import { reachableNodeIds } from '@/modules/bot-config/graph';
import type { BotDefinition } from '@/types/bot';

/**
 * El recorrido sin los bloques de compra que ningún botón alcanza. Esos bloques solo guardan los textos de la compra (se editan
 * en el flujo de compra): dibujarlos en el lienzo sería ruido. En cuanto un botón lleva a uno, el flujo entero aparece.
 */
export function hideUnlinkedBlocks(def: BotDefinition): BotDefinition {
  if (!hasPurchaseBlocks(def)) return def;
  const reachable = reachableNodeIds(def);
  const nodes = def.nodes.filter((node) => node.block === undefined || reachable.has(node.id));
  return nodes.length === def.nodes.length ? def : { ...def, nodes };
}
