import type { BotDefinition } from '@/types/bot';
import { defaultDefinition } from './defaults';
import { PURCHASE_BLOCKS, addPurchaseFlow } from './purchase-blocks';

export type FlowTemplateId = 'base' | 'base_compras';

export const FLOW_TEMPLATES: readonly { id: FlowTemplateId; label: string; description: string }[] = [
  { id: 'base', label: 'Recorrido base', description: 'Menú principal, códigos de Netflix y soporte con una persona.' },
  {
    id: 'base_compras', label: 'Recorrido base + compras',
    description: 'El recorrido base con un botón «Comprar servicios» que abre el flujo de compras.',
  },
];

/**
 * Definicion completa de una plantilla. Reemplaza el borrador entero (nodos, mensajes, numeros y palabras clave).
 * `overrides` son los textos de compras editados hoy, para que la plantilla no los cambie.
 */
export function applyFlowTemplate(id: FlowTemplateId, overrides: Readonly<Record<string, string>> = {}): BotDefinition {
  const base = defaultDefinition();
  if (id === 'base') return base;
  const withEntry: BotDefinition = {
    ...base,
    nodes: base.nodes.map((node) => (node.id === base.entryNodeId
      ? { ...node, options: [...node.options, { id: 'comprar', title: 'Comprar servicios', next: PURCHASE_BLOCKS.catalogo.id }] }
      : node)),
  };
  return addPurchaseFlow(withEntry, overrides);
}
