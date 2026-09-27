import { WHATSAPP_TEMPLATE_LANGUAGE, type WhatsAppTemplateName } from './template-catalog';

const GRAPH_API_VERSION = 'v23.0';
const REQUEST_TIMEOUT_MS = 10_000;

export type CloudApiConfig = {
  accessToken: string;
  phoneNumberId: string;
};

export type OutboundPayload =
  | { kind: 'text'; text: string }
  | { kind: 'template'; templateName: WhatsAppTemplateName; params: string[] };

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

function toRequestBody(to: string, payload: OutboundPayload) {
  if (payload.kind === 'text') {
    return { messaging_product: 'whatsapp', to, type: 'text', text: { body: payload.text, preview_url: false } };
  }
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: payload.templateName,
      language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
      components: payload.params.length === 0
        ? []
        : [{ type: 'body', parameters: payload.params.map((text) => ({ type: 'text', text })) }],
    },
  };
}

type GraphSendResponse = {
  messages?: Array<{ id?: unknown }>;
  error?: { code?: unknown; message?: unknown; error_user_title?: unknown };
};

// Sin reintentos automaticos: Meta no deduplica envios, asi que un reintento
// podria duplicar el mensaje. La idempotencia vive en la tabla de salida.
export async function sendCloudApiMessage(
  config: CloudApiConfig,
  to: string,
  payload: OutboundPayload,
  fetchImpl: typeof fetch = fetch
): Promise<{ waMessageId: string }> {
  let response: Response;
  try {
    response = await fetchImpl(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(config.phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(toRequestBody(to, payload)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new CloudApiError(null, timedOut ? 'Request timed out' : 'Network error');
  }

  let body: GraphSendResponse = {};
  try {
    body = (await response.json()) as GraphSendResponse;
  } catch {
    body = {};
  }

  const waMessageId = body.messages?.[0]?.id;
  if (response.ok && typeof waMessageId === 'string') {
    return { waMessageId };
  }

  const code = typeof body.error?.code === 'number' ? body.error.code : null;
  const title = typeof body.error?.error_user_title === 'string'
    ? body.error.error_user_title
    : typeof body.error?.message === 'string'
      ? body.error.message
      : `HTTP ${response.status}`;
  throw new CloudApiError(code, title.slice(0, 512));
}
