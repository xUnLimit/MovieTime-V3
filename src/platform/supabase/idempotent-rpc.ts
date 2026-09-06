import { supabase } from './client';
import { createIdempotencyKey } from './idempotency';
import type { RpcResult } from './rpc-client';
import { assertRpcStringId } from '@/platform/utils/safety';

const pending = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
// These values are calculated again on retry; they do not define a new intent.
const derived = new Set(['p_fecha_pago', 'p_exchange_rate', 'p_total_usd', 'p_costo_usd', 'p_monto_usd', 'p_idempotency_key']);

async function requestFingerprint(operation: string, payload: { p_idempotency_key?: string | null }): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Inicia sesion antes de registrar la operacion.');
  const values = Object.entries(payload).filter(([key]) => !derived.has(key)).sort(([a], [b]) => a.localeCompare(b));
  const bytes = new TextEncoder().encode(JSON.stringify([data.session.user.id, operation, payload.p_idempotency_key || values]));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return `movietime:pending-rpc:${Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')}`;
}

function readKey(fingerprint: string): string | undefined {
  try {
    return sessionStorage.getItem(fingerprint) || pending.get(fingerprint);
  } catch {
    return pending.get(fingerprint);
  }
}

function saveKey(fingerprint: string, key: string) {
  pending.set(fingerprint, key);
  try { sessionStorage.setItem(fingerprint, key); } catch { /* Memory still protects retries in this page. */ }
}

function clearKey(fingerprint: string) {
  pending.delete(fingerprint);
  try { sessionStorage.removeItem(fingerprint); } catch { /* Storage can be disabled by the browser. */ }
}

/** Only use for RPCs whose SQL implementation stores the result atomically. */
export async function executeIdempotentRpc<T extends { p_idempotency_key?: string | null }>(
  operation: string,
  payload: T,
  send: (payload: T) => PromiseLike<RpcResult>,
): Promise<string> {
  const fingerprint = await requestFingerprint(operation, payload);
  const running = inFlight.get(fingerprint);
  if (running) return running;
  // Pending keys are stored without credentials/form data. Explicit intents must
  // retain their key; legacy callers recover by semantic fingerprint on retry.
  const key = readKey(fingerprint) ?? payload.p_idempotency_key ?? createIdempotencyKey();
  saveKey(fingerprint, key);
  const run = (async () => {
    const { data, error } = await send({ ...payload, p_idempotency_key: key });
    if (error) throw new Error(error.message);
    const id = assertRpcStringId(data, operation);
    clearKey(fingerprint);
    return id;
  })();
  inFlight.set(fingerprint, run);
  try { return await run; } finally { inFlight.delete(fingerprint); }
}
