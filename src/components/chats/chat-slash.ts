import type { SavedMessage } from '@/modules/whatsapp/saved-messages';
import type { VentaMessageContext } from '@/platform/utils/whatsapp-template-render';
import type { TemplateMensaje } from '@/types';
import { tipoLabel } from '@/modules/messaging/template-tipos';

import { renderTipoForChat } from './chat-templates';

export type SlashItem =
  | { kind: 'saved'; id: string; title: string; message: SavedMessage }
  | { kind: 'system'; id: string; title: string; body: string };

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');
}

function matches(title: string, term: string): boolean {
  return !term || fold(title).includes(term);
}

// Opciones del popup "/": mensajes guardados primero y luego los tipos activos del editor
// (texto libre) ya rellenados con la venta seleccionada.
export function buildSlashItems(input: {
  term: string;
  savedMessages: readonly SavedMessage[];
  tipos: readonly TemplateMensaje[];
  context: VentaMessageContext | null;
  fallbackName: string;
  now?: Date;
}): SlashItem[] {
  const term = fold(input.term);
  const saved: SlashItem[] = input.savedMessages
    .filter((message) => matches(message.title, term))
    .map((message) => ({ kind: 'saved', id: `saved:${message.id}`, title: message.title, message }));
  const system: SlashItem[] = input.tipos
    .filter((tipo) => tipo.activo !== false && tipo.contenido.trim() !== '')
    .map((tipo) => ({ tipo, title: tipoLabel(tipo.tipo) }))
    .filter(({ title }) => matches(title, term))
    .map(({ tipo, title }) => ({
      kind: 'system' as const,
      id: `system:${tipo.id}`,
      title,
      body: renderTipoForChat(tipo, input.context, input.fallbackName, input.now),
    }));
  return [...saved, ...system];
}
