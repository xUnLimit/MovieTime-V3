import {
  countOfflineCollection,
  getOfflineCopyStatus,
  getOfflineDashboardHome,
  getOfflinePaginated,
  hasOfflineCopy,
  prepareOfflineCopy,
  readOfflineCollection,
  readOfflineCollectionById,
  shouldUseOfflineRead,
  assertOnlineMutation,
} from '@/lib/pwa/offline-copy';
import type { CollectionName, QueryFilter } from '@/lib/supabase/entities';
import type { OfflineSyncProgress } from '@/lib/pwa/offline-types';

export const offlineCopy = {
  prepare: (onProgress?: (progress: OfflineSyncProgress) => void) => prepareOfflineCopy(onProgress),
  status: getOfflineCopyStatus,
  hasSnapshot: hasOfflineCopy,
  shouldReadOffline: shouldUseOfflineRead,
  readDashboardHome: getOfflineDashboardHome,
  readCollection: <T>(collectionName: CollectionName, filters: QueryFilter[] = []) =>
    readOfflineCollection<T>(collectionName, filters),
  readById: <T>(collectionName: CollectionName, id: string) =>
    readOfflineCollectionById<T>(collectionName, id),
  count: (collectionName: CollectionName, filters: QueryFilter[] = []) =>
    countOfflineCollection(collectionName, filters),
  paginate: getOfflinePaginated,
  assertOnlineMutation,
};

export type { CollectionName, QueryFilter, OfflineSyncProgress };
