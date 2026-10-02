import { z } from '@/platform/validation/zod';
import { extractConfirmationCode } from './confirmation-code';

// El comprobante es solo una pista: el pago lo confirma unicamente el correo de Yappy.
export type ReceiptInput = { typedCode?: string | null; imageMediaId?: string | null };
export type ReceiptReading = { code: string | null; source: 'texto' | 'vision' | 'ninguna' };

export interface ReceiptReader {
  read(input: ReceiptInput): Promise<ReceiptReading>;
}

/** Lector manual: solo el texto o codigo que escribio el cliente. Es el valor por defecto. */
export function createManualReceiptReader(): ReceiptReader {
  return {
    async read(input) {
      const code = extractConfirmationCode(input.typedCode);
      return { code, source: code ? 'texto' : 'ninguna' };
    },
  };
}

/** Texto -> imagen: primero el texto del cliente; la imagen solo si hay un lector de vision. */
export function createChainedReceiptReader(primary: ReceiptReader, fallback: ReceiptReader | null): ReceiptReader {
  return {
    async read(input) {
      const first = await primary.read(input);
      if (first.code || !fallback || !input.imageMediaId) return first;
      return fallback.read(input);
    },
  };
}

const visionReplySchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).min(1).max(20),
});
const visionJsonSchema = z.object({ codigo: z.string().max(64).nullable() });

/** Interpreta la respuesta de la Messages API. Cualquier forma inesperada devuelve null. */
export function parseVisionReply(body: unknown): string | null {
  const reply = visionReplySchema.safeParse(body);
  if (!reply.success) return null;
  const text = reply.data.content.find((block) => block.type === 'text')?.text;
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try { raw = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  const parsed = visionJsonSchema.safeParse(raw);
  return parsed.success ? extractConfirmationCode(parsed.data.codigo) : null;
}

export type ReceiptImage = { base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' };
export type VisionReaderOptions = {
  apiKey: string; model: string; loadImage(mediaId: string): Promise<ReceiptImage | null>;
  fetchImpl?: typeof fetch; timeoutMs?: number;
};

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const PROMPT = 'Lee este comprobante de Yappy. Responde solo JSON: {"codigo": "<codigo de confirmacion o null>"}. '
  + 'El codigo tiene letras, un guion y digitos. No inventes datos.';

/**
 * OPCIONAL y APAGADO por defecto. Solo se crea con la bandera `RECEIPT_VISION_ENABLED=true` junto con
 * `ANTHROPIC_API_KEY` y `RECEIPT_VISION_MODEL`; ver `createReceiptReaderFromEnv`. La imagen se envia a la
 * Messages API y nunca se registra. Un fallo devuelve "sin codigo": el cliente puede escribirlo.
 */
export function createVisionReceiptReader(options: VisionReaderOptions): ReceiptReader {
  const doFetch = options.fetchImpl ?? fetch;
  return {
    async read(input) {
      if (!input.imageMediaId) return { code: null, source: 'ninguna' };
      try {
        const image = await options.loadImage(input.imageMediaId);
        if (!image) return { code: null, source: 'ninguna' };
        const response = await doFetch(MESSAGES_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: options.model, max_tokens: 100, messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
            { type: 'text', text: PROMPT },
          ] }] }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
        });
        if (!response.ok) return { code: null, source: 'ninguna' };
        const code = parseVisionReply(await response.json());
        return { code, source: code ? 'vision' : 'ninguna' };
      } catch {
        return { code: null, source: 'ninguna' };
      }
    },
  };
}

export type ReceiptReaderEnv = {
  RECEIPT_VISION_ENABLED?: string; ANTHROPIC_API_KEY?: string; RECEIPT_VISION_MODEL?: string;
};

/** Lector configurado por entorno: manual salvo que la bandera y las credenciales esten completas. */
export function createReceiptReaderFromEnv(
  env: ReceiptReaderEnv, loadImage: VisionReaderOptions['loadImage'], fetchImpl?: typeof fetch,
): ReceiptReader {
  const manual = createManualReceiptReader();
  if (env.RECEIPT_VISION_ENABLED !== 'true' || !env.ANTHROPIC_API_KEY || !env.RECEIPT_VISION_MODEL) return manual;
  return createChainedReceiptReader(manual, createVisionReceiptReader({
    apiKey: env.ANTHROPIC_API_KEY, model: env.RECEIPT_VISION_MODEL, loadImage, fetchImpl,
  }));
}
