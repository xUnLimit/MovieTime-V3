/** Logger central con redaccion de credenciales y datos personales. */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMetadata = Record<string, unknown>;

const SENSITIVE_KEYS = [
  'password', 'contrasena', 'contraseña', 'token', 'auth', 'authorization',
  'secret', 'p256dh', 'endpoint', 'service_role', 'apikey', 'api_key', 'anon_key',
  'email', 'telefono', 'phone', 'wa_id', 'text_body', 'payload', 'body', 'message_body',
];
const MAX_LOG_TEXT_LENGTH = 2000;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive));
}

/** Sanea texto libre antes de enviarlo al destino de logs. */
export function sanitizeText(value: string): string {
  const protectedValues: string[] = [];
  const protect = (match: string) => {
    const index = protectedValues.push(match) - 1;
    return `\uE000${index}\uE001`;
  };
  let safe = value
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, protect)
    .replace(/\b\d{4}-\d{2}-\d{2}T[0-9:.Z+-]{8,32}\b/g, protect)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, protect)
    .replace(/\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1')
    .replace(/"(password|token|secret|apikey|api_key|authorization)"\s*:\s*"(?:\\.|[^"\\])*"/gi, '"$1":"[redacted]"')
    .replace(/\b(password|token|secret|apikey|api_key|authorization)\s*=\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\bBearer\s+[^\s,;]+/gi, '[token]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/(?<![\w-])\+?\d[\d -]*\d(?![\w-])/g, (candidate) =>
      candidate.replace(/\D/g, '').length >= 8 ? '[phone]' : candidate);
  safe = safe.replace(/\uE000(\d+)\uE001/g, (_, index: string) => protectedValues[Number(index)]);
  return safe.length > MAX_LOG_TEXT_LENGTH
    ? `${safe.slice(0, MAX_LOG_TEXT_LENGTH)}[truncated]`
    : safe;
}

/** Redacta recursivamente valores de claves sensibles. No muta el objeto original. */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 4) return '[Truncated]';
  if (typeof value === 'string') return sanitizeText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  const errorDetails = serializeErrorLike(value, depth, seen);
  if (errorDetails) return errorDetails;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen));

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[sanitizeText(key)] = isSensitiveKey(key) ? '[REDACTED]' : redact(val, depth + 1, seen);
  }
  return result;
}

function serializeErrorLike(value: object, depth: number, seen: WeakSet<object>): Record<string, unknown> | null {
  const candidate = value as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
    name?: unknown;
    cause?: unknown;
  };
  if (typeof candidate.message !== 'string') return null;
  const result: Record<string, unknown> = {
    name: typeof candidate.name === 'string' ? sanitizeText(candidate.name) : 'Error',
    message: sanitizeText(candidate.message),
  };
  if (typeof candidate.code === 'string') result.code = sanitizeText(candidate.code);
  if (typeof candidate.details === 'string') result.details = sanitizeText(candidate.details);
  if (typeof candidate.hint === 'string') result.hint = sanitizeText(candidate.hint);
  if (candidate.cause !== undefined) result.cause = redact(candidate.cause, depth + 1, seen);
  return result;
}

function emit(level: LogLevel, scope: string, message: string, metadata?: LogMetadata) {
  const safeMeta = metadata ? (redact(metadata) as LogMetadata) : undefined;
  const prefix = `[${sanitizeText(scope)}]`;
  const consoleFn =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (safeMeta) {
    consoleFn(`${prefix} ${sanitizeText(message)}`, safeMeta);
  } else {
    consoleFn(`${prefix} ${sanitizeText(message)}`);
  }
}

/** Crea un logger con un scope fijo (ej: createLogger('CurrencyService')). */
export function createLogger(scope: string) {
  return {
    debug: (message: string, metadata?: LogMetadata) => emit('debug', scope, message, metadata),
    info: (message: string, metadata?: LogMetadata) => emit('info', scope, message, metadata),
    warn: (message: string, metadata?: LogMetadata) => emit('warn', scope, message, metadata),
    error: (message: string, metadata?: LogMetadata) => emit('error', scope, message, metadata),
  };
}

export function reportError(
  scope: string,
  message: string,
  error: unknown,
  metadata?: LogMetadata,
) {
  createLogger(scope).error(message, { ...metadata, error });
}

export type Logger = ReturnType<typeof createLogger>;
