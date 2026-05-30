/**
 * snake_case (DB) <-> camelCase (TS) mapping helpers.
 *
 * Database schema uses snake_case; the TypeScript domain types use camelCase.
 * Use these to translate at the supabase/queries layer; never let snake_case
 * names leak into UI components.
 */

type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : S;

type SnakeCase<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Tail extends Uncapitalize<Tail>
    ? `${Lowercase<Head>}${SnakeCase<Tail>}`
    : `${Lowercase<Head>}_${SnakeCase<Uncapitalize<Tail>>}`
  : S;

export type CamelCaseKeys<T> = T extends Array<infer U>
  ? Array<CamelCaseKeys<U>>
  : T extends object
    ? { [K in keyof T as K extends string ? CamelCase<K> : K]: CamelCaseKeys<T[K]> }
    : T;

export type SnakeCaseKeys<T> = T extends Array<infer U>
  ? Array<SnakeCaseKeys<U>>
  : T extends object
    ? { [K in keyof T as K extends string ? SnakeCase<K> : K]: SnakeCaseKeys<T[K]> }
    : T;

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

/**
 * Parse listed fields from ISO strings to Date objects in-place on a copy.
 * Use after toCamelCase() to hydrate timestamps.
 */
export function parseDateFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly (keyof T)[]
): T {
  const copy = { ...obj };
  for (const f of fields) {
    const val = copy[f];
    if (typeof val === 'string') {
      copy[f] = new Date(val) as T[keyof T];
    }
  }
  return copy;
}

/**
 * Standard timestamp fields present on most tables.
 */
export const COMMON_DATE_FIELDS = ['createdAt', 'updatedAt'] as const;
