import { toCloudApiBody, type OutboundPayload } from './outbound-payload';

export type { OutboundPayload } from './outbound-payload';

const GRAPH_API_VERSION = 'v23.0';
const REQUEST_TIMEOUT_MS = 10_000;
const UPLOAD_TIMEOUT_MS = 30_000;

export type CloudApiConfig = {
  accessToken: string;
  phoneNumberId: string;
};

// Error controlado de la Cloud API: conserva el codigo de Meta para auditoria
// sin exponer el cuerpo de la respuesta al cliente.
export class CloudApiError extends Error {
  constructor(
    readonly code: number | null,
    readonly title: string
  ) {
    super(`WhatsApp Cloud API error${code === null ? '' : ` ${code}`}: ${title}`);
    this.name = 'CloudApiError';
  }
}

type GraphResponse = {
  id?: unknown;
  success?: unknown;
  messages?: Array<{ id?: unknown }>;
  error?: { code?: unknown; message?: unknown; error_user_title?: unknown };
};

function phoneUrl(config: CloudApiConfig, path: 'messages' | 'media') {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(config.phoneNumberId)}/${path}`;
}

async function callGraph(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<GraphResponse> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new CloudApiError(null, timedOut ? 'Request timed out' : 'Network error');
  }

  let body: GraphResponse = {};
  try {
    body = (await response.json()) as GraphResponse;
  } catch {
    body = {};
  }
  if (response.ok) return body;

  const code = typeof body.error?.code === 'number' ? body.error.code : null;
  const title = typeof body.error?.error_user_title === 'string'
    ? body.error.error_user_title
    : typeof body.error?.message === 'string'
      ? body.error.message
      : `HTTP ${response.status}`;
  throw new CloudApiError(code, title.slice(0, 512));
}

function jsonInit(config: CloudApiConfig, body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// Sin reintentos automaticos: Meta no deduplica envios, asi que un reintento
// podria duplicar el mensaje. La idempotencia vive en la tabla de salida.
export async function sendCloudApiMessage(
  config: CloudApiConfig,
  to: string,
  payload: OutboundPayload,
  fetchImpl: typeof fetch = fetch
): Promise<{ waMessageId: string }> {
  const body = await callGraph(fetchImpl, phoneUrl(config, 'messages'), jsonInit(config, toCloudApiBody(to, payload)), REQUEST_TIMEOUT_MS);
  const waMessageId = body.messages?.[0]?.id;
  if (typeof waMessageId !== 'string') throw new CloudApiError(null, 'Message id missing');
  return { waMessageId };
}

// Muestra los ✓✓ azules en el telefono del cliente para ese mensaje y los anteriores.
export async function markCloudApiMessageRead(
  config: CloudApiConfig,
  waMessageId: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  await callGraph(
    fetchImpl,
    phoneUrl(config, 'messages'),
    jsonInit(config, { messaging_product: 'whatsapp', status: 'read', message_id: waMessageId }),
    REQUEST_TIMEOUT_MS
  );
}

export async function uploadCloudApiMedia(
  config: CloudApiConfig,
  file: Blob,
  mimeType: string,
  filename: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ mediaId: string }> {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([file], { type: mimeType }), filename);

  const body = await callGraph(
    fetchImpl,
    phoneUrl(config, 'media'),
    { method: 'POST', headers: { Authorization: `Bearer ${config.accessToken}` }, body: form },
    UPLOAD_TIMEOUT_MS
  );
  if (typeof body.id !== 'string') throw new CloudApiError(null, 'Media id missing');
  return { mediaId: body.id };
}
