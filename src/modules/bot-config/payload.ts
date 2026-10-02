import type { BotDefinition, BotNode, BotOption } from '@/types/bot';
import { NODE_LIMITS } from './catalog';

export type BotOutboundMessage =
  | { kind: 'text'; text: string }
  | { kind: 'buttons'; body: string; buttons: { id: string; title: string }[] }
  | { kind: 'list'; body: string; buttonLabel: string; rows: { id: string; title: string; description?: string }[] };

const REPLY_PREFIX = 'BOT:';
const REPLY_ID_MAX = 256;
const REPLY_ID_PATTERN = /^BOT:([a-z][a-z0-9_]{1,31}):([a-z][a-z0-9_]{0,31})$/;

// Recorta sin partir un par sustituto (WhatsApp rechaza JSON con medios pares).
function clip(text: string, max: number): string {
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return text.length > max && last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

export function optionReplyId(nodeId: string, optionId: string): string {
  return `${REPLY_PREFIX}${nodeId}:${optionId}`;
}

/** Devuelve null ante cualquier id ajeno, mal formado o demasiado largo; nunca lanza. */
export function parseOptionReplyId(id: string): { nodeId: string; optionId: string } | null {
  if (typeof id !== 'string' || new TextEncoder().encode(id).length > REPLY_ID_MAX) return null;
  const match = REPLY_ID_PATTERN.exec(id);
  return match ? { nodeId: match[1], optionId: match[2] } : null;
}

/** Mensaje de WhatsApp de un nodo, recortado a los limites para que nunca sea rechazado por tamano. */
export function buildNodeMessage(node: BotNode): BotOutboundMessage {
  const body = clip(node.body, NODE_LIMITS.bodyMax);
  if (node.kind === 'buttons' && node.options.length > 0) {
    return {
      kind: 'buttons', body,
      buttons: node.options.slice(0, NODE_LIMITS.buttonsMax).map((option) => ({
        id: optionReplyId(node.id, option.id), title: clip(option.title, NODE_LIMITS.buttonTitleMax),
      })),
    };
  }
  if (node.kind === 'list' && node.options.length > 0) {
    return {
      kind: 'list', body,
      buttonLabel: clip(node.listButtonLabel ?? '', NODE_LIMITS.listButtonMax),
      rows: node.options.slice(0, NODE_LIMITS.listRowsMax).map((option) => ({
        id: optionReplyId(node.id, option.id), title: clip(option.title, NODE_LIMITS.listTitleMax),
        ...(option.description ? { description: clip(option.description, NODE_LIMITS.listDescriptionMax) } : {}),
      })),
    };
  }
  return { kind: 'text', text: body };
}

/** Busca nodo, opcion y destino; null si algo ya no existe en la definicion. */
export function resolveOption(def: BotDefinition, nodeId: string, optionId: string):
  { node: BotNode; option: BotOption; target: BotNode } | null {
  const node = def.nodes.find((candidate) => candidate.id === nodeId);
  const option = node?.options.find((candidate) => candidate.id === optionId);
  const target = option ? def.nodes.find((candidate) => candidate.id === option.next) : undefined;
  return node && option && target ? { node, option, target } : null;
}
