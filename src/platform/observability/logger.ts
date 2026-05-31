/**
 * Logger central minimo con redaccion de campos sensibles.
 *
 * Objetivo (auditoria 2026-05-30, Fase 1 de observabilidad): dar a los modulos criticos
 * un punto unico de logging estructurado en vez de `console.*` disperso, y redactar
 * automaticamente credenciales/secretos antes de emitirlos.
 *
 * Hoy escribe a console con formato estructurado; la implementacion se puede sustituir
 * por Sentry/OTel/Logtail sin tocar a los callers.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMetadata = Record<string, unknown>;

const SENSITIVE_KEYS = [
  'password',
  'contrasena',
  'contraseña',
  'token',
  'auth',
  'authorization',
  'secret',
  'p256dh',
  'endpoint',
  'service_role',
  'apikey',
  'api_key',
  'anon_key',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive));
}

/** Redacta recursivamente valores de claves sensibles. No muta el objeto original. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]';
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? '[REDACTED]' : redact(val, depth + 1);
  }
  return result;
}

function emit(level: LogLevel, scope: string, message: string, metadata?: LogMetadata) {
  const safeMeta = metadata ? (redact(metadata) as LogMetadata) : undefined;
  const prefix = `[${scope}]`;
  const consoleFn =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (safeMeta) {
    consoleFn(`${prefix} ${message}`, safeMeta);
  } else {
    consoleFn(`${prefix} ${message}`);
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
