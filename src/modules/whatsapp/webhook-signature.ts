import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';
const HEX_SHA256 = /^[a-f0-9]{64}$/i;

// Meta firma el cuerpo crudo con HMAC-SHA256 usando el App Secret y lo envia en
// X-Hub-Signature-256. Se compara en tiempo constante sobre digests de tamano fijo.
export function isValidWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!appSecret || !signatureHeader?.startsWith(SIGNATURE_PREFIX)) return false;

  const provided = signatureHeader.slice(SIGNATURE_PREFIX.length);
  if (!HEX_SHA256.test(provided)) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  return timingSafeEqual(Buffer.from(provided.toLowerCase(), 'hex'), Buffer.from(expected, 'hex'));
}

// Verificacion del handshake GET: compara el token sin filtrar su longitud.
export function isValidVerifyToken(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
