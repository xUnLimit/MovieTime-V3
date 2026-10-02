import { encodeEntityReplyId } from '@/modules/bot-config/entity-reply-codec';
import type { NoticeGroup } from '@/modules/messaging/message-data';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import { awaitCodeRequest } from './runtime';
import type { V2Deps } from './contracts';

export type CodeWelcome = (group: NoticeGroup, waId: string, payload: OutboundPayload, now: Date, buttonTexts: string[]) => Promise<{
  payload: OutboundPayload; accepted(): Promise<void>;
} | null>;
/** Attach only to a single owned code-enabled sale; a template must already have the approved button. */
export function createCodeWelcome(deps: Pick<V2Deps, 'states' | 'identity' | 'definition' | 'version'>): CodeWelcome {
  return async (group, waId, payload, now, buttonTexts) => {
    if (deps.definition.schemaVersion !== 2 || group.ventas.length !== 1 || !group.ventas[0].accesoPorCodigo) return null;
    const ventaId = group.ventas[0].ventaId;
    if ((await deps.states.load(waId))?.state.owner === 'humano' || !await deps.identity.codeSale(waId, ventaId)) return null;
    const id = encodeEntityReplyId({ kind: 'CODE', entityId: ventaId });
    let shown: OutboundPayload;
    if (payload.kind === 'text') shown = { kind: 'buttons', body: payload.text.slice(0, 1024), buttons: [{ id, title: 'Solicitar código' }] };
    else if (payload.kind === 'template') {
      const index = buttonTexts.findIndex(title => title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === 'solicitar codigo');
      if (index < 0 || !payload.buttonPayloads) return null;
      shown = { ...payload, buttonPayloads: payload.buttonPayloads.map((value, i) => i === index ? id : value) };
    } else return null;
    return {
      payload: shown,
      accepted: () => awaitCodeRequest(waId, ventaId, deps, now),
    };
  };
}
