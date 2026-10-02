import type { BotDefinition } from '@/types/bot';
import { defaultDefinition } from './defaults';
import { defaultCatalogMessages } from './catalog-messages';

/** A draft only. No publication or database writes. */
export function defaultDefinitionV2(): BotDefinition {
  const definition = defaultDefinition();
  return {
    ...definition, schemaVersion: 2, catalogMessages: defaultCatalogMessages(),
    nodes: definition.nodes.map(node => node.id === 'menu' ? {
      ...node, options: [...node.options, { id: 'catalogo', title: 'Ver catálogo', next: 'catalogo' }],
    } : node).concat({ id: 'catalogo', name: 'Catálogo', kind: 'action', body: '', options: [], action: 'show_catalog' }),
  };
}
