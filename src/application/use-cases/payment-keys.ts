import { createHash } from 'node:crypto';

/** UUID determinista (forma v5) para claves de idempotencia de envios del servidor. */
export function hashedKey(scope: string, value: string): string {
  const hex = createHash('sha256').update(`${scope}:${value}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
