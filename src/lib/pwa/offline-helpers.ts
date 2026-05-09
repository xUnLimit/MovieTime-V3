import type { CollectionName, QueryFilter } from '@/lib/supabase/entities';

function normalizeComparableValue(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  return value;
}

function getFieldValue(record: Record<string, unknown>, field: string): unknown {
  return record[field];
}

function matchesOrIlike(record: Record<string, unknown>, value: unknown): boolean {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { fields?: unknown }).fields)) {
    return false;
  }

  const term = String((value as { value?: unknown }).value ?? '').trim().toLowerCase();
  if (!term) return true;

  const fields = (value as { fields: unknown[] }).fields.filter(
    (field): field is string => typeof field === 'string' && field.length > 0
  );

  return fields.some((field) => {
    const current = getFieldValue(record, field);
    return String(current ?? '').toLowerCase().includes(term);
  });
}

export function applyOfflineFilters<T>(
  rows: T[],
  _collectionName: CollectionName,
  filters: QueryFilter[] = []
): T[] {
  return rows.filter((row) => {
    const record = row as Record<string, unknown>;
    return filters.every((filter) => {
      const current = normalizeComparableValue(getFieldValue(record, filter.field));
      const expected = normalizeComparableValue(filter.value);

      if (filter.operator === '==') return current === expected;
      if (filter.operator === '!=') return current !== expected;
      if (filter.operator === '<') return Number(current) < Number(expected);
      if (filter.operator === '<=') return Number(current) <= Number(expected);
      if (filter.operator === '>') return Number(current) > Number(expected);
      if (filter.operator === '>=') return Number(current) >= Number(expected);
      if (filter.operator === 'in') return Array.isArray(expected) && expected.includes(current);
      if (filter.operator === 'is') return current === expected;
      if (filter.operator === 'ilike') {
        return String(current ?? '').toLowerCase().includes(String(expected ?? '').replace(/%/g, '').toLowerCase());
      }
      if (filter.operator === 'orIlike') return matchesOrIlike(record, filter.value);
      return true;
    });
  });
}

export function sortOfflineRows<T>(
  rows: T[],
  field: string,
  direction: 'asc' | 'desc'
): T[] {
  const copy = [...rows];
  copy.sort((left, right) => {
    const a = normalizeComparableValue((left as Record<string, unknown>)[field]);
    const b = normalizeComparableValue((right as Record<string, unknown>)[field]);
    if (a === b) return 0;
    if (a === undefined || a === null) return direction === 'asc' ? -1 : 1;
    if (b === undefined || b === null) return direction === 'asc' ? 1 : -1;
    if (a < b) return direction === 'asc' ? -1 : 1;
    return direction === 'asc' ? 1 : -1;
  });
  return copy;
}

export function isOfflineEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine;
}

export function offlineMutationError(): Error {
  return new Error('Esta accion requiere conexion a internet.');
}
