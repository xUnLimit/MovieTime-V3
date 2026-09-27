import type { WhatsAppChatMessage, WhatsAppSendMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { z } from '@/platform/validation/zod';

// Límites de WhatsApp Cloud API para mensajes interactivos de respuesta.
export const INTERACTIVE_LIMITS = {
  body: 1024,
  buttonTitle: 20,
  maxButtons: 3,
  listLabel: 20,
  rowTitle: 24,
  rowDescription: 72,
  maxRows: 10,
} as const;

export type InteractiveType = 'buttons' | 'list';
export type InteractiveOption = { title: string; description: string };
export type InteractiveDraft = {
  type: InteractiveType;
  body: string;
  buttonLabel: string;
  options: InteractiveOption[];
};
export type InteractiveSendMessage = Extract<WhatsAppSendMessage, { kind: InteractiveType }>;
export type InteractiveOptions =
  | { type: 'buttons'; buttons: Array<{ id: string; title: string }> }
  | { type: 'list'; buttonLabel: string; rows: Array<{ id: string; title: string; description?: string }> };

const optionSchema = z.object({ id: z.string().min(1), title: z.string().min(1) });
const buttonsPayloadSchema = z.object({ buttons: z.array(optionSchema).min(1).max(INTERACTIVE_LIMITS.maxButtons) });
const listPayloadSchema = z.object({
  buttonLabel: z.string().min(1),
  rows: z.array(optionSchema.extend({ description: z.string().optional() })).min(1).max(INTERACTIVE_LIMITS.maxRows),
});

export function isInteractiveKind(kind: string) {
  return kind === 'interactive' || kind === 'buttons' || kind === 'list';
}

// El payload viene de la base de datos: se valida su forma antes de mostrarlo.
export function readInteractiveOptions(payload: Record<string, unknown> | null | undefined): InteractiveOptions | null {
  const buttons = buttonsPayloadSchema.safeParse(payload);
  if (buttons.success) return { type: 'buttons', buttons: buttons.data.buttons };
  const list = listPayloadSchema.safeParse(payload);
  if (list.success) return { type: 'list', buttonLabel: list.data.buttonLabel, rows: list.data.rows };
  return null;
}

export function emptyInteractiveDraft(type: InteractiveType): InteractiveDraft {
  return { type, body: '', buttonLabel: type === 'list' ? 'Ver opciones' : '', options: [{ title: '', description: '' }] };
}

export function buildInteractiveMessage(
  draft: InteractiveDraft
): { ok: true; message: InteractiveSendMessage } | { ok: false; error: string } {
  const body = draft.body.trim();
  if (!body) return { ok: false, error: 'Escribe el texto del mensaje.' };
  if (body.length > INTERACTIVE_LIMITS.body) return { ok: false, error: `El texto no puede superar ${INTERACTIVE_LIMITS.body} caracteres.` };
  const isList = draft.type === 'list';
  const max = isList ? INTERACTIVE_LIMITS.maxRows : INTERACTIVE_LIMITS.maxButtons;
  const titleLimit = isList ? INTERACTIVE_LIMITS.rowTitle : INTERACTIVE_LIMITS.buttonTitle;
  const options = draft.options.map((option) => ({ title: option.title.trim(), description: option.description.trim() }));
  const noun = isList ? 'opción' : 'botón';
  if (options.length === 0 || options.length > max) return { ok: false, error: `Agrega entre 1 y ${max} ${isList ? 'opciones' : 'botones'}.` };
  if (options.some((option) => !option.title)) return { ok: false, error: `Cada ${noun} necesita un título.` };
  if (options.some((option) => option.title.length > titleLimit)) return { ok: false, error: `Cada título de ${noun} admite hasta ${titleLimit} caracteres.` };
  const titles = options.map((option) => option.title.toLocaleLowerCase('es'));
  if (new Set(titles).size !== titles.length) return { ok: false, error: 'No repitas títulos: WhatsApp los rechaza.' };
  if (!isList) {
    return { ok: true, message: { kind: 'buttons', body, buttons: options.map((option, index) => ({ id: `btn-${index + 1}`, title: option.title })) } };
  }
  const buttonLabel = draft.buttonLabel.trim();
  if (!buttonLabel) return { ok: false, error: 'Escribe el texto del botón que abre la lista.' };
  if (buttonLabel.length > INTERACTIVE_LIMITS.listLabel) return { ok: false, error: `El botón de la lista admite hasta ${INTERACTIVE_LIMITS.listLabel} caracteres.` };
  if (options.some((option) => option.description.length > INTERACTIVE_LIMITS.rowDescription)) {
    return { ok: false, error: `Cada descripción admite hasta ${INTERACTIVE_LIMITS.rowDescription} caracteres.` };
  }
  return { ok: true, message: { kind: 'list', body, buttonLabel, rows: options.map((option, index) => ({
    id: `row-${index + 1}`, title: option.title, ...(option.description ? { description: option.description } : {}),
  })) } };
}

// Reconstruye un mensaje interactivo enviado para reintentarlo tal cual.
export function rebuildInteractiveMessage(message: WhatsAppChatMessage): InteractiveSendMessage | null {
  if (!isInteractiveKind(message.kind) || !message.textBody) return null;
  const options = readInteractiveOptions(message.payload);
  if (!options) return null;
  const replyTo = message.contextWaMessageId ? { replyTo: message.contextWaMessageId } : {};
  return options.type === 'buttons'
    ? { kind: 'buttons', body: message.textBody, buttons: options.buttons, ...replyTo }
    : { kind: 'list', body: message.textBody, buttonLabel: options.buttonLabel, rows: options.rows, ...replyTo };
}
