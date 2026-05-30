import { OFFLINE_COLLECTIONS } from './offline-constants';
import { applyOfflineFilters, isOfflineEnvironment, sortOfflineRows } from './offline-helpers';
import { getOfflineSnapshot } from './offline-db';
import { isOfflineAuthSessionActive } from './offline-auth';
import type { CollectionName, QueryFilter } from '@/platform/supabase/entities';
import type { Configuracion } from '@/types';
import type { OfflineAppSnapshot, OfflineDashboardHomeSnapshot } from './offline-types';

export async function shouldUseOfflineRead(): Promise<boolean> {
  if (!isOfflineEnvironment() && !isOfflineAuthSessionActive()) return false;
  const snapshot = await getOfflineSnapshot();
  return snapshot !== null;
}

export async function readOfflineCollection<T>(
  collectionName: CollectionName,
  filters: QueryFilter[] = []
): Promise<T[]> {
  const snapshot = await getOfflineSnapshot();
  if (!snapshot) return [];
  const rows = (snapshot.collections[collectionName] ?? []) as T[];
  return applyOfflineFilters(rows, collectionName, filters);
}

export async function readOfflineCollectionById<T>(
  collectionName: CollectionName,
  id: string
): Promise<T | null> {
  const rows = await readOfflineCollection<T>(collectionName, [{ field: 'id', operator: '==', value: id }]);
  return rows[0] ?? null;
}

export async function countOfflineCollection(
  collectionName: CollectionName,
  filters: QueryFilter[] = []
): Promise<number> {
  const rows = await readOfflineCollection(collectionName, filters);
  return rows.length;
}

export async function getOfflinePaginated<T>(
  collectionName: CollectionName,
  options: {
    pageSize: number;
    orderByField?: string;
    orderDirection?: 'asc' | 'desc';
    startAfterDoc?: number;
    filters?: QueryFilter[];
  }
): Promise<{ docs: T[]; lastDoc: number | null; hasMore: boolean }> {
  const filtered = await readOfflineCollection<T>(collectionName, options.filters ?? []);
  const sorted = sortOfflineRows(
    filtered,
    options.orderByField ?? 'createdAt',
    options.orderDirection ?? 'desc'
  );
  const start = options.startAfterDoc ?? 0;
  const slice = sorted.slice(start, start + options.pageSize);
  return {
    docs: slice,
    lastDoc: slice.length > 0 ? start + slice.length : null,
    hasMore: start + options.pageSize < sorted.length,
  };
}

export async function getOfflineDashboardHome(): Promise<OfflineDashboardHomeSnapshot | null> {
  const snapshot = await getOfflineSnapshot();
  return snapshot?.dashboardHome ?? null;
}

export async function getOfflineConfig(): Promise<Configuracion | null> {
  const snapshot = await getOfflineSnapshot();
  return snapshot?.config ?? null;
}

export async function getOfflineSnapshotMeta(): Promise<Pick<OfflineAppSnapshot, 'syncedAt' | 'version'> | null> {
  const snapshot = await getOfflineSnapshot();
  if (!snapshot) return null;
  return {
    syncedAt: snapshot.syncedAt,
    version: snapshot.version,
  };
}

export function getOfflineCollectionsForSync(): CollectionName[] {
  return [...OFFLINE_COLLECTIONS];
}
