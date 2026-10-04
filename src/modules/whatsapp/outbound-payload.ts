import { WHATSAPP_TEMPLATE_LANGUAGE } from './template-catalog';

type InteractiveButton = { id: string; title: string };
type InteractiveRow = { id: string; title: string; description?: string; section?: string };

/** Agrupa las filas por `section` conservando el orden; sin seccion van en "Opciones". La seccion no se envia como campo de la fila. */
function listSections(rows: InteractiveRow[]) {
  const sections = new Map<string, { id: string; title: string; description?: string }[]>();
  for (const { section, ...row } of rows) sections.set(section ?? 'Opciones', [...(sections.get(section ?? 'Opciones') ?? []), row]);
  return [...sections.entries()].map(([title, sectionRows]) => ({ title, rows: sectionRows }));
}
type SharedContact = { name: string; phone: string };
type SharedLocation = { latitude: number; longitude: number; name?: string; address?: string };

// Todo lo que el sistema puede enviar. Solo las plantillas funcionan con la
// ventana de 24 h cerrada; el resto exige que el cliente haya escrito antes.
export type OutboundPayload =
  | { kind: 'text'; text: string; replyTo?: string }
  | { kind: 'template'; templateName: string; params: string[]; buttonPayloads?: string[] }
  | { kind: 'image' | 'document' | 'audio'; mediaId: string; mimeType: string; filename?: string; caption?: string; replyTo?: string }
  | { kind: 'sticker'; mediaId: string; mimeType: string; replyTo?: string }
  | { kind: 'reaction'; targetWaMessageId: string; emoji: string }
  | { kind: 'buttons'; body: string; buttons: InteractiveButton[]; replyTo?: string }
  | { kind: 'list'; body: string; buttonLabel: string; rows: InteractiveRow[]; replyTo?: string }
  | { kind: 'location'; location: SharedLocation; replyTo?: string }
  | { kind: 'contacts'; contacts: SharedContact[]; replyTo?: string };

export function requiresOpenWindow(payload: OutboundPayload) {
  return payload.kind !== 'template';
}

// Tipo guardado en la tabla de salida (botones y listas son "interactive").
export function storedKind(payload: OutboundPayload) {
  return payload.kind === 'buttons' || payload.kind === 'list' ? 'interactive' : payload.kind;
}

// Texto que se muestra en el historial para cada envio.
export function storedText(payload: OutboundPayload): string | null {
  switch (payload.kind) {
    case 'text':
      return payload.text;
    case 'image':
    case 'document':
    case 'audio':
      return payload.caption?.trim() || null;
    case 'sticker':
      return null;
    case 'buttons':
    case 'list':
      return payload.body;
    case 'location':
      return payload.location.name || payload.location.address || 'Ubicación';
    case 'contacts':
      return payload.contacts.map((contact) => contact.name).join(', ');
    default:
      return null;
  }
}

function withContext<T extends object>(body: T, replyTo: string | undefined) {
  return replyTo ? { ...body, context: { message_id: replyTo } } : body;
}

function mediaBody(payload: Extract<OutboundPayload, { kind: 'image' | 'document' | 'audio' }>) {
  const caption = payload.caption?.trim();
  if (payload.kind === 'audio') return { audio: { id: payload.mediaId } };
  if (payload.kind === 'image') return { image: { id: payload.mediaId, ...(caption ? { caption } : {}) } };
  return {
    document: {
      id: payload.mediaId,
      ...(payload.filename ? { filename: payload.filename } : {}),
      ...(caption ? { caption } : {}),
    },
  };
}

export function toCloudApiBody(to: string, payload: OutboundPayload) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
  switch (payload.kind) {
    case 'text':
      return withContext({ ...base, type: 'text', text: { body: payload.text, preview_url: false } }, payload.replyTo);
    case 'template':
      return {
        ...base,
        type: 'template',
        template: {
          name: payload.templateName,
          language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
          components: [
            ...(payload.params.length === 0 ? [] : [{ type: 'body', parameters: payload.params.map((text) => ({ type: 'text', text })) }]),
            ...(payload.buttonPayloads ?? []).map((buttonPayload, index) => ({
              type: 'button', sub_type: 'quick_reply', index: String(index),
              parameters: [{ type: 'payload', payload: buttonPayload }],
            })),
          ],
        },
      };
    case 'image':
    case 'document':
    case 'audio':
      return withContext({ ...base, type: payload.kind, ...mediaBody(payload) }, payload.replyTo);
    case 'sticker':
      return withContext({ ...base, type: 'sticker', sticker: { id: payload.mediaId } }, payload.replyTo);
    case 'reaction':
      return { ...base, type: 'reaction', reaction: { message_id: payload.targetWaMessageId, emoji: payload.emoji } };
    case 'buttons':
      return withContext({
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: payload.body },
          action: { buttons: payload.buttons.map((button) => ({ type: 'reply', reply: button })) },
        },
      }, payload.replyTo);
    case 'list':
      return withContext({
        ...base,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: payload.body },
          action: { button: payload.buttonLabel, sections: listSections(payload.rows) },
        },
      }, payload.replyTo);
    case 'location':
      return withContext({ ...base, type: 'location', location: payload.location }, payload.replyTo);
    case 'contacts':
      return withContext({
        ...base,
        type: 'contacts',
        contacts: payload.contacts.map((contact) => ({
          name: { formatted_name: contact.name, first_name: contact.name.split(' ')[0] || contact.name },
          phones: [{ phone: contact.phone, type: 'CELL' }],
        })),
      }, payload.replyTo);
  }
}
