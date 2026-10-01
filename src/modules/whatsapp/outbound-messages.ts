import { CloudApiError, type OutboundPayload } from './cloud-api-client';
import { requiresOpenWindow } from './outbound-payload';
import { WHATSAPP_TEMPLATE_LANGUAGE, type TemplateCatalog } from './template-catalog';

// Ventana de atencion de Meta: el texto libre solo se entrega si el cliente
// escribio en las ultimas 24 horas; fuera de ella solo se permiten plantillas.
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type OutboundStatus = 'pending' | 'accepted' | 'failed';

export type OutboundRecord = {
  id: string;
  sendStatus: OutboundStatus;
  waMessageId: string | null;
  errorTitle: string | null;
};

export type NewOutboundMessage = {
  idempotencyKey: string;
  toWaId: string;
  payload: OutboundPayload;
  // NULL identifies a server generated message; the column is nullable in the original inbox migration.
  sentBy: string | null;
  storedTextBody?: string;
};

export type OutboundStore = {
  findByIdempotencyKey(key: string): Promise<OutboundRecord | null>;
  lastInboundAt(waId: string): Promise<string | null>;
  // Devuelve null si otra solicitud ya reservo la misma clave de idempotencia.
  insertPending(message: NewOutboundMessage): Promise<OutboundRecord | null>;
  markAccepted(id: string, waMessageId: string): Promise<void>;
  markFailed(id: string, code: number | null, title: string): Promise<void>;
  retryFailed(id: string): Promise<boolean>;
};

export type OutboundDeps = {
  store: OutboundStore;
  catalog: TemplateCatalog;
  send: (to: string, payload: OutboundPayload) => Promise<{ waMessageId: string }>;
  now?: () => Date;
};

export type OutboundResult = OutboundRecord & { replayed: boolean };

export class CustomerWindowClosedError extends Error {
  constructor() {
    super('The 24h customer service window is closed for this conversation.');
    this.name = 'CustomerWindowClosedError';
  }
}

export class InvalidTemplateParamsError extends Error {
  constructor() {
    super('Template parameters do not match the approved template.');
    this.name = 'InvalidTemplateParamsError';
  }
}

export class TemplateNotApprovedError extends Error {
  constructor() {
    super('Template is not approved or is retired.');
    this.name = 'TemplateNotApprovedError';
  }
}

export function isWindowOpen(lastInboundAt: string | null, now: Date): boolean {
  if (!lastInboundAt) return false;
  const elapsed = now.getTime() - new Date(lastInboundAt).getTime();
  return elapsed >= 0 && elapsed < CUSTOMER_SERVICE_WINDOW_MS;
}

async function replay(store: OutboundStore, key: string): Promise<OutboundResult | null> {
  const existing = await store.findByIdempotencyKey(key);
  return existing ? { ...existing, replayed: true } : null;
}

export async function sendOutboundMessage(
  message: NewOutboundMessage,
  { store, catalog, send, now = () => new Date() }: OutboundDeps
): Promise<OutboundResult> {
  const previous = await replay(store, message.idempotencyKey);
  if (previous && previous.sendStatus !== 'failed') return previous;

  if (message.payload.kind === 'template') {
    const approved = await catalog.getApproved(message.payload.templateName, WHATSAPP_TEMPLATE_LANGUAGE);
    if (!approved) throw new TemplateNotApprovedError();
    if (message.payload.params.length !== approved.paramCount
      || (message.payload.buttonPayloads?.length ?? 0) !== approved.buttons.length
      || approved.buttons.some((button) => button.type !== 'QUICK_REPLY')) {
      throw new InvalidTemplateParamsError();
    }
  } else if (requiresOpenWindow(message.payload) && !isWindowOpen(await store.lastInboundAt(message.toWaId), now())) {
    throw new CustomerWindowClosedError();
  }

  if (previous && !await store.retryFailed(previous.id)) {
    const current = await replay(store, message.idempotencyKey);
    return current?.sendStatus === 'failed'
      ? { ...current, sendStatus: 'pending' }
      : current ?? { ...previous, sendStatus: 'pending' };
  }

  const pending = previous ?? await store.insertPending(message);
  if (!pending) {
    const raced = await replay(store, message.idempotencyKey);
    if (raced) return raced;
    throw new Error('Outbound message reservation disappeared.');
  }

  try {
    const { waMessageId } = await send(message.toWaId, message.payload);
    await store.markAccepted(pending.id, waMessageId);
    return { id: pending.id, sendStatus: 'accepted', waMessageId, errorTitle: null, replayed: false };
  } catch (error) {
    const code = error instanceof CloudApiError ? error.code : null;
    const title = message.storedTextBody
      ? 'Sensitive WhatsApp message failed'
      : error instanceof CloudApiError ? error.title : 'Unexpected send failure';
    await store.markFailed(pending.id, code, title);
    if (!(error instanceof CloudApiError) || error.code === null) throw error;
    return { id: pending.id, sendStatus: 'failed', waMessageId: null, errorTitle: title, replayed: false };
  }
}
