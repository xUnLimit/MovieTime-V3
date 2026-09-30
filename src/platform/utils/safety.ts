import { createLogger } from '@/platform/observability/logger';

type AsyncSideEffectContext = {
  operation: string;
  entity?: string;
  entityId?: string | null;
  critical?: boolean;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function assertUuid(value: unknown, label: string): string {
  if (!isUuid(value)) {
    throw new Error(`${label} debe ser un UUID valido`);
  }
  return value;
}

export function assertRpcStringId(data: unknown, operation: string): string {
  if (typeof data !== 'string' || data.trim() === '') {
    throw new Error(`${operation} no retorno un id valido`);
  }
  return data;
}

export function assertRecordId(data: unknown, operation: string): string {
  if (!data || typeof data !== 'object' || !('id' in data)) {
    throw new Error(`${operation} no retorno un registro con id`);
  }

  const id = (data as { id?: unknown }).id;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error(`${operation} retorno un id invalido`);
  }

  return id;
}

export function toMoneyNumber(value: unknown, label = 'monto'): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`${label} debe ser un numero valido`);
  }
  return amount;
}

function isUnsafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return true;
  if (path.includes('\\')) return true;
  try {
    return decodeURIComponent(path).includes('\\');
  } catch {
    return true;
  }
}

export function safeInternalPath(value: unknown, fallback = '/'): string {
  const safeFallback =
    typeof fallback === 'string' && !isUnsafeInternalPath(fallback)
      ? fallback
      : '/';

  if (typeof value !== 'string') return safeFallback;

  const candidate = value.trim();
  if (isUnsafeInternalPath(candidate)) return safeFallback;

  try {
    const url = new URL(candidate, 'https://movietime.local');
    if (url.origin !== 'https://movietime.local') return safeFallback;

    const path = `${url.pathname}${url.search}${url.hash}`;
    return isUnsafeInternalPath(path) ? safeFallback : path;
  } catch {
    return safeFallback;
  }
}

export function safeAsyncSideEffect(
  promise: Promise<unknown>,
  context: AsyncSideEffectContext
): void {
  promise.catch((error) => {
    logAsyncSideEffectError(error, context);
  });
}

export function logAsyncSideEffectError(
  error: unknown,
  context: AsyncSideEffectContext
): void {
  const scope = [
    context.operation,
    context.entity ? `entity=${context.entity}` : null,
    context.entityId ? `id=${context.entityId}` : null,
  ].filter(Boolean).join(' ');

  // Via logger central: redacta secretos que puedan venir dentro del error.
  createLogger(context.critical ? 'SideEffect:CRITICAL' : 'SideEffect').error(scope, { error });
}
