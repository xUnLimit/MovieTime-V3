import { MESSAGE_CATALOG, VARIABLE_CATALOG, normalizeText, renderTemplate } from '@/modules/bot-config';
import { COPY_CATALOG, editableCopyKeysOfBlock, type CopyKey } from '@/modules/commerce-copy';
import { stepTitle } from '@/modules/commerce-copy/flow';
import { renderCopyText, sampleValues } from '@/modules/commerce-copy/render';
import type { BotDefinition, BotMessageKey } from '@/types/bot';

export type MessageItem =
  | { id: string; kind: 'bot'; key: BotMessageKey; label: string; hint: string; preview: string; edited: boolean }
  | { id: string; kind: 'copy'; key: CopyKey; nodeId: string; label: string; hint: string; preview: string; edited: boolean };
/** Ruta con la que la validación del borrador reporta los problemas de este texto. */
export const issuePath = (item: MessageItem): string => (item.kind === 'bot' ? `messages.${item.key}` : `nodes[${item.nodeId}].block.copy.${item.key}`);

export type MessageGroup = { id: string; title: string; items: MessageItem[] };

const examples = Object.fromEntries(Object.entries(VARIABLE_CATALOG).map(([key, variable]) => [key, variable.example]));
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
const GROUP_TITLES = { netflix: 'Netflix', sistema: 'Sistema' } as const;

/**
 * Todos los textos que el bot envía, agrupados: las respuestas dentro de la conversación y, si el recorrido tiene el flujo de
 * compras, los textos de cada bloque. `inherited` son los textos de compras guardados antes de existir los bloques.
 */
export function buildMessageGroups(def: BotDefinition, inherited: Readonly<Partial<Record<string, string>>>): MessageGroup[] {
  const groups: MessageGroup[] = (['netflix', 'sistema'] as const).map((group) => ({
    id: group, title: GROUP_TITLES[group],
    items: (Object.entries(MESSAGE_CATALOG) as [BotMessageKey, (typeof MESSAGE_CATALOG)[BotMessageKey]][])
      .filter(([, entry]) => entry.group === group)
      .map(([key, entry]) => ({
        id: `bot:${key}`, kind: 'bot' as const, key, label: entry.label, hint: entry.description,
        preview: oneLine(renderTemplate(def.messages[key] ?? '', examples)), edited: (def.messages[key] ?? '').trim() !== entry.defaultText.trim(),
      })),
  }));
  for (const node of def.nodes) {
    const block = node.block;
    if (!block) continue;
    const keys = editableCopyKeysOfBlock(block.type);
    // Un grupo por paso de la conversación (plataformas, planes, carrito...), en el orden en que lo vive el cliente.
    for (const step of [...new Set(keys.map((key) => COPY_CATALOG[key].step))]) {
      groups.push({
        id: `block:${node.id}:${step}`, title: `Compras · ${stepTitle(step)}`,
        items: keys.filter((key) => COPY_CATALOG[key].step === step).map((key) => {
          const text = block.copy[key] ?? inherited[key] ?? COPY_CATALOG[key].defaultText;
          return {
            id: `copy:${node.id}:${key}`, kind: 'copy' as const, key, nodeId: node.id, label: COPY_CATALOG[key].label, hint: COPY_CATALOG[key].when,
            preview: oneLine(renderCopyText(text, sampleValues(key))), edited: text.trim() !== COPY_CATALOG[key].defaultText.trim(),
          };
        }),
      });
    }
  }
  return groups;
}

/** Filtra por lo escrito en el buscador (sin acentos ni mayúsculas) sobre nombre, uso y texto; descarta grupos vacíos. */
export function filterMessageGroups(groups: readonly MessageGroup[], query: string): MessageGroup[] {
  const needle = normalizeText(query);
  if (!needle) return [...groups];
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => normalizeText(`${item.label} ${item.hint} ${item.preview}`).includes(needle)) }))
    .filter((group) => group.items.length > 0);
}
