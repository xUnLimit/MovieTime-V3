import { isOfflineAuthSessionActive } from '@/lib/pwa/offline-auth';
import { getOfflineSnapshot } from '@/lib/pwa/offline-db';
import { isOfflineEnvironment, offlineMutationError } from '@/lib/pwa/offline-helpers';
import {
  countOfflineCollection,
  getOfflineCollectionsForSync,
  getOfflineConfig,
  getOfflineDashboardHome,
  getOfflinePaginated,
  getOfflineSnapshotMeta,
  readOfflineCollection,
  readOfflineCollectionById,
  shouldUseOfflineRead,
} from '@/lib/pwa/offline-read';
import { syncOfflineSnapshot } from '@/lib/pwa/offline-sync';
import type { CollectionName, QueryFilter } from '@/platform/supabase/entities';
import type { OfflineSyncProgress } from '@/lib/pwa/offline-types';

export async function prepareOfflineCopy(onProgress?: (progress: OfflineSyncProgress) => void) {
  return syncOfflineSnapshot(onProgress);
}

export async function getOfflineCopyStatus() {
  const meta = await getOfflineSnapshotMeta();
  return {
    isReady: Boolean(meta?.syncedAt),
    syncedAt: meta?.syncedAt ?? null,
    version: meta?.version ?? null,
  };
}

export async function hasOfflineCopy() {
  return (await getOfflineSnapshot()) !== null;
}

export function assertOnlineMutation(): void {
  if (isOfflineEnvironment() || isOfflineAuthSessionActive()) {
    throw offlineMutationError();
  }
}

export {
  countOfflineCollection,
  getOfflineCollectionsForSync,
  getOfflineConfig,
  getOfflineDashboardHome,
  getOfflinePaginated,
  readOfflineCollection,
  readOfflineCollectionById,
  shouldUseOfflineRead,
};

export type { CollectionName, QueryFilter };
