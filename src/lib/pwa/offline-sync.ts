'use client';

import { getDashboardHome } from '@/lib/services/dashboardStatsService';
import { getCategoriasFull } from '@/lib/supabase/categorias-repository';
import { getConfig } from '@/lib/supabase/config-repository';
import { queryNotifications } from '@/lib/supabase/notifications-repository';
import { ENTITIES, type CollectionName } from '@/lib/supabase/entities';
import { getAll as getAllRecords } from '@/lib/supabase/record-core';
import { OFFLINE_DB_VERSION } from './offline-constants';
import { saveOfflineSnapshot } from './offline-db';
import { getOfflineCollectionsForSync } from './offline-read';
import type { OfflineAppSnapshot } from './offline-types';

type SnapshotCollectionMap = Partial<Record<CollectionName, unknown[]>>;

async function fetchCollection(collectionName: CollectionName): Promise<unknown[]> {
  if (collectionName === ENTITIES.CATEGORIAS) {
    return getCategoriasFull();
  }
  if (collectionName === ENTITIES.NOTIFICACIONES) {
    return queryNotifications([]);
  }
  return getAllRecords(collectionName);
}

export async function createOfflineSnapshot(): Promise<OfflineAppSnapshot> {
  const collectionNames = getOfflineCollectionsForSync();
  const results = await Promise.all(collectionNames.map((collectionName) => fetchCollection(collectionName)));
  const collections = collectionNames.reduce<SnapshotCollectionMap>((acc, collectionName, index) => {
    acc[collectionName] = results[index];
    return acc;
  }, {});

  const [dashboardHome, config] = await Promise.all([
    getDashboardHome(),
    getConfig(),
  ]);

  return {
    version: OFFLINE_DB_VERSION,
    syncedAt: new Date().toISOString(),
    collections,
    dashboardHome,
    config,
  };
}

export async function syncOfflineSnapshot(): Promise<OfflineAppSnapshot> {
  const snapshot = await createOfflineSnapshot();
  await saveOfflineSnapshot(snapshot);
  return snapshot;
}
