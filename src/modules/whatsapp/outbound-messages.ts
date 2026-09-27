import { CloudApiError, type OutboundPayload } from './cloud-api-client';
import { requiresOpenWindow } from './outbound-payload';
import { hasValidTemplateParams } from './template-catalog';

// Ventana de atencion de Meta: el texto libre solo se entrega si el cliente
// escribio en las ultimas 24 horas; fuera de ella solo se permiten plantillas.
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  sentBy: string;
};

export type OutboundStore = {
  findByIdempotencyKey(key: string): Promise<OutboundRecord | null>;
  lastInboundAt(waId: string): Promise<string | null>;
  // Devuelve null si otra solicitud ya reservo la misma clave de idempotencia.
  insertPending(message: NewOutboundMessage): Promise<OutboundRecord | null>;
  markAccepted(id: string, waMessageId: string): Promise<void>;
  markFailed(id: string, code: number | null, title: string): Promise<void>;
};

export type OutboundDeps = {
  store: OutboundStore;
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
  { store, send, now = () => new Date() }: OutboundDeps
): Promise<OutboundResult> {
  const previous = await replay(store, message.idempotencyKey);
  if (previous) return previous;

  if (message.payload.kind === 'template') {
    if (!hasValidTemplateParams(message.payload.templateName, message.payload.params)) {
      throw new InvalidTemplateParamsError();
    }
  } else if (requiresOpenWindow(message.payload) && !isWindowOpen(await store.lastInboundAt(message.toWaId), now())) {
    throw new CustomerWindowClosedError();
  }

  const pending = await store.insertPending(message);
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
    const title = error instanceof CloudApiError ? error.title : 'Unexpected send failure';
    await store.markFailed(pending.id, code, title);
    if (!(error instanceof CloudApiError)) throw error;
    return { id: pending.id, sendStatus: 'failed', waMessageId: null, errorTitle: title, replayed: false };
  }
}
