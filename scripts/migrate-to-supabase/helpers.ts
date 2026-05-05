import type { MigrationContext, FirestoreDoc, InsertRow } from './types';

const DEFAULT_BATCH_SIZE = 500;

export function normalizeFirestoreValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (Object.prototype.toString.call(value) === '[object Object]') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        normalizeFirestoreValue(nested),
      ])
    );
  }
  return value;
}

export async function readCollection<T extends FirestoreDoc = FirestoreDoc>(
  ctx: MigrationContext,
  collectionName: string
): Promise<T[]> {
  const snapshot = await ctx.firestore.collection(collectionName).get();
  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(normalizeFirestoreValue(doc.data()) as Record<string, unknown>),
  })) as T[];
  ctx.report.setCount(`firestore.${collectionName}`, docs.length);
  return docs;
}

export function cleanRow<T extends InsertRow>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as T;
}

export function cleanRows<T extends InsertRow>(rows: T[]): T[] {
  return rows.map(cleanRow);
}

export async function upsertRows(
  ctx: MigrationContext,
  table: string,
  rows: InsertRow[],
  onConflict = 'id'
) {
  if (rows.length === 0) return;
  ctx.report.addCount(`supabase.${table}.planned`, rows.length);
  if (ctx.options.dryRun) return;

  const batchSize = ctx.options.batchSize || DEFAULT_BATCH_SIZE;
  const supabase = ctx.supabase as unknown as {
    from: (tableName: string) => {
      upsert: (
        values: InsertRow[],
        options: { onConflict: string; ignoreDuplicates?: boolean }
      ) => Promise<{ error: Error | null }>;
    };
  };

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = cleanRows(rows.slice(index, index + batchSize));
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`Supabase upsert failed for ${table}: ${error.message}`);
    ctx.report.addCount(`supabase.${table}.upserted`, batch.length);
  }
}

export async function insertLegacyOrphans(ctx: MigrationContext) {
  const rows = ctx.report.orphans.map((orphan) =>
    cleanRow({
      source_collection: String(orphan.sourceCollection),
      source_id: String(orphan.sourceId),
      orphan_reason: String(orphan.reason),
      payload: orphan.payload as never,
    })
  );
  await upsertRows(ctx, 'legacy_orphan_records', rows, 'source_collection,source_id');
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function asOptionalString(value: unknown): string | undefined {
  const normalized = asString(value).trim();
  return normalized || undefined;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

export function toIso(value: unknown, fallback = new Date()): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback.toISOString();
}

export function toDateOnly(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return undefined;
}

export function requiredDateOnly(value: unknown, fallback = new Date()): string {
  return toIso(value, fallback).slice(0, 10);
}

export function isCycle(value: unknown): value is 'mensual' | 'trimestral' | 'semestral' | 'anual' {
  return value === 'mensual' || value === 'trimestral' || value === 'semestral' || value === 'anual';
}

export function cycleOrDefault(value: unknown): 'mensual' | 'trimestral' | 'semestral' | 'anual' {
  return isCycle(value) ? value : 'mensual';
}

export function makeMap<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}
