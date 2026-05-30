'use client';

import { getDashboardHome } from '@/modules/dashboard-read-models';
import { getCategoriasFull } from '@/platform/supabase/categorias-repository';
import { getConfig } from '@/platform/supabase/config-repository';
import { queryNotifications } from '@/platform/supabase/notifications-repository';
import { ENTITIES, type CollectionName } from '@/platform/supabase/entities';
import { getAll as getAllRecords } from '@/platform/supabase/record-core';
import { OFFLINE_DB_VERSION } from './offline-constants';
import { saveOfflineSnapshot } from './offline-db';
import { getOfflineCollectionsForSync } from './offline-read';
import type { OfflineAppSnapshot, OfflineSyncProgress } from './offline-types';

type SnapshotCollectionMap = Partial<Record<CollectionName, unknown[]>>;
type OfflineSyncProgressCallback = (progress: OfflineSyncProgress) => void;

const STATIC_OFFLINE_ROUTES: string[] = [];

function emitProgress(
  onProgress: OfflineSyncProgressCallback | undefined,
  progress: Omit<OfflineSyncProgress, 'percentage'> & { percentage: number }
) {
  onProgress?.({
    ...progress,
    percentage: Math.min(100, Math.max(0, Math.round(progress.percentage))),
  });
}

function formatCollectionLabel(collectionName: CollectionName): string {
  const labels: Partial<Record<CollectionName, string>> = {
    [ENTITIES.TERCEROS]: 'terceros',
    [ENTITIES.SERVICIOS]: 'servicios',
    [ENTITIES.CATEGORIAS]: 'categorias',
    [ENTITIES.METODOS_PAGO]: 'metodos de pago',
    [ENTITIES.TIPOS_GASTO]: 'tipos de gasto',
    [ENTITIES.ACTIVITY_LOG]: 'log de actividad',
    [ENTITIES.GASTOS]: 'gastos',
    [ENTITIES.TEMPLATES]: 'mensajes',
    [ENTITIES.NOTIFICACIONES]: 'notificaciones',
    [ENTITIES.PAGOS_SERVICIO]: 'pagos de servicios',
    [ENTITIES.VENTAS]: 'ventas',
    [ENTITIES.PAGOS_VENTA]: 'pagos de ventas',
  };

  return labels[collectionName] ?? collectionName;
}

export function extractNextStaticAssetUrls(html: string, baseUrl: string): string[] {
  const assetUrls = new Set<string>();
  const assetPattern = /(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g;

  for (const match of html.matchAll(assetPattern)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === new URL(baseUrl).origin) {
        assetUrls.add(url.href);
      }
    } catch {
      // Ignore malformed asset references in generated HTML.
    }
  }

  return Array.from(assetUrls);
}

export function buildOfflineDetailRoutes(collections: SnapshotCollectionMap): string[] {
  void collections;
  return [...STATIC_OFFLINE_ROUTES];
}

async function fetchCollection(collectionName: CollectionName): Promise<unknown[]> {
  if (collectionName === ENTITIES.CATEGORIAS) {
    return getCategoriasFull();
  }
  if (collectionName === ENTITIES.NOTIFICACIONES) {
    return queryNotifications([]);
  }
  return getAllRecords(collectionName);
}

export async function createOfflineSnapshot(onProgress?: OfflineSyncProgressCallback): Promise<OfflineAppSnapshot> {
  emitProgress(onProgress, {
    phase: 'preparing',
    percentage: 1,
    completed: 0,
    total: 1,
    label: 'Preparando sincronizacion offline',
  });

  const collectionNames = getOfflineCollectionsForSync();
  let completedCollections = 0;
  const totalCollections = collectionNames.length;

  const results = await Promise.all(
    collectionNames.map(async (collectionName) => {
      const rows = await fetchCollection(collectionName);
      completedCollections += 1;
      emitProgress(onProgress, {
        phase: 'collections',
        percentage: 5 + (completedCollections / totalCollections) * 55,
        completed: completedCollections,
        total: totalCollections,
        label: `Sincronizando ${formatCollectionLabel(collectionName)} (${completedCollections}/${totalCollections})`,
      });
      return rows;
    })
  );
  const collections = collectionNames.reduce<SnapshotCollectionMap>((acc, collectionName, index) => {
    acc[collectionName] = results[index];
    return acc;
  }, {});
  const detailRoutes = buildOfflineDetailRoutes(collections);

  let completedDashboardTasks = 0;
  const [dashboardHome, config] = await Promise.all([
    getDashboardHome().then((dashboard) => {
      completedDashboardTasks += 1;
      emitProgress(onProgress, {
        phase: 'dashboard',
        percentage: 60 + (completedDashboardTasks / 2) * 15,
        completed: completedDashboardTasks,
        total: 2,
        label: 'Sincronizando resumen del dashboard',
      });
      return dashboard;
    }),
    getConfig().then((configuracion) => {
      completedDashboardTasks += 1;
      emitProgress(onProgress, {
        phase: 'dashboard',
        percentage: 60 + (completedDashboardTasks / 2) * 15,
        completed: completedDashboardTasks,
        total: 2,
        label: 'Sincronizando configuracion',
      });
      return configuracion;
    }),
  ]);

  return {
    version: OFFLINE_DB_VERSION,
    syncedAt: new Date().toISOString(),
    collections,
    detailRoutes,
    dashboardHome,
    config,
  };
}

export async function syncOfflineSnapshot(onProgress?: OfflineSyncProgressCallback): Promise<OfflineAppSnapshot> {
  const snapshot = await createOfflineSnapshot(onProgress);
  emitProgress(onProgress, {
    phase: 'saving',
    percentage: 80,
    completed: 0,
    total: 1,
    label: 'Guardando copia local',
  });
  await saveOfflineSnapshot(snapshot);
  emitProgress(onProgress, {
    phase: 'done',
    percentage: 100,
    completed: 1,
    total: 1,
    label: 'Copia offline lista',
  });
  return snapshot;
}
