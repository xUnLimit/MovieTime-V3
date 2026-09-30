const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

const toCamel = (key: string): string =>
  key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const toSnake = (key: string): string =>
  key.replace(/([A-Z])/g, '_$1').toLowerCase();

/**
 * Recursively convert all object keys from snake_case to camelCase.
 * Date instances and primitives pass through. ISO date strings are NOT
 * parsed automatically; use parseDateFields() if you need that.
 */
export function toCamelCase<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((v) => toCamelCase(v)) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[toCamel(k)] = toCamelCase(v);
    }
    return out as T;
  }
  return value as T;
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 * Drops `undefined` values (Postgres prefers absent over NULL when no value).
 */
export function toSnakeCase<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((v) => toSnakeCase(v)) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[toSnake(k)] = toSnakeCase(v);
    }
    return out as T;
  }
  return value as T;
}
