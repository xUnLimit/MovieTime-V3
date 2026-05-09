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
import type { OfflineAppSnapshot, OfflineSyncProgress } from './offline-types';

type SnapshotCollectionMap = Partial<Record<CollectionName, unknown[]>>;
type OfflineSyncProgressCallback = (progress: OfflineSyncProgress) => void;

const OFFLINE_ROUTE_CACHE_NAME = 'movietime-pwa-v2';
const STATIC_OFFLINE_ROUTES = [
  '/dashboard',
  '/usuarios',
  '/servicios',
  '/ventas',
  '/notificaciones',
  '/categorias',
  '/metodos-pago',
  '/gastos',
  '/reposo',
  '/editor-mensajes',
  '/log-actividad',
];

function getRecordId(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;
  const id = (record as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function getRecordField(record: unknown, field: string): string | null {
  if (!record || typeof record !== 'object') return null;
  const value = (record as Record<string, unknown>)[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

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
    [ENTITIES.USUARIOS]: 'usuarios',
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
  const routes = new Set(STATIC_OFFLINE_ROUTES);

  for (const venta of collections[ENTITIES.VENTAS] ?? []) {
    const id = getRecordId(venta);
    if (id) routes.add(`/ventas/${id}`);
  }

  for (const servicio of collections[ENTITIES.SERVICIOS] ?? []) {
    const id = getRecordId(servicio);
    const categoriaId = getRecordField(servicio, 'categoriaId');
    if (id) routes.add(`/servicios/detalle/${id}`);
    if (categoriaId) routes.add(`/servicios/${categoriaId}`);
  }

  for (const usuario of collections[ENTITIES.USUARIOS] ?? []) {
    const id = getRecordId(usuario);
    if (id) routes.add(`/usuarios/${id}`);
  }

  for (const categoria of collections[ENTITIES.CATEGORIAS] ?? []) {
    const id = getRecordId(categoria);
    if (id) routes.add(`/categorias/${id}`);
  }

  for (const metodoPago of collections[ENTITIES.METODOS_PAGO] ?? []) {
    const id = getRecordId(metodoPago);
    if (id) routes.add(`/metodos-pago/${id}`);
  }

  return Array.from(routes);
}

async function cacheOfflineRoutes(routes: string[], onProgress?: OfflineSyncProgressCallback) {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  const cache = await caches.open(OFFLINE_ROUTE_CACHE_NAME);
  let completedRoutes = 0;
  const totalRoutes = Math.max(routes.length, 1);

  await Promise.allSettled(
    routes.map(async (route) => {
      try {
        const response = await fetch(route, { cache: 'reload', credentials: 'same-origin' });
        if (response.ok) {
          const routeResponse = response.clone();
          await cache.put(route, response);

          const contentType = routeResponse.headers.get('content-type') ?? '';
          if (contentType.includes('text/html')) {
            const html = await routeResponse.text();
            const assetUrls = extractNextStaticAssetUrls(html, window.location.origin);
            await Promise.allSettled(
              assetUrls.map(async (assetUrl) => {
                const assetResponse = await fetch(assetUrl, { cache: 'reload', credentials: 'same-origin' });
                if (assetResponse.ok) {
                  await cache.put(assetUrl, assetResponse);
                }
              })
            );
          }
        }
      } finally {
        completedRoutes += 1;
        emitProgress(onProgress, {
          phase: 'routes',
          percentage: 84 + (completedRoutes / totalRoutes) * 14,
          completed: completedRoutes,
          total: routes.length,
          label: `Guardando rutas offline (${completedRoutes}/${routes.length})`,
        });
      }
    })
  );
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
    phase: 'routes',
    percentage: 84,
    completed: 0,
    total: snapshot.detailRoutes.length,
    label: 'Preparando rutas offline',
  });
  await cacheOfflineRoutes(snapshot.detailRoutes, onProgress).catch((error) => {
    console.warn('Error caching offline routes:', error);
  });
  emitProgress(onProgress, {
    phase: 'done',
    percentage: 100,
    completed: 1,
    total: 1,
    label: 'Copia offline lista',
  });
  return snapshot;
}
