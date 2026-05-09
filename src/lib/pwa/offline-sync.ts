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

async function cacheOfflineRoutes(routes: string[]) {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  const cache = await caches.open(OFFLINE_ROUTE_CACHE_NAME);
  await Promise.allSettled(
    routes.map(async (route) => {
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

export async function createOfflineSnapshot(): Promise<OfflineAppSnapshot> {
  const collectionNames = getOfflineCollectionsForSync();
  const results = await Promise.all(collectionNames.map((collectionName) => fetchCollection(collectionName)));
  const collections = collectionNames.reduce<SnapshotCollectionMap>((acc, collectionName, index) => {
    acc[collectionName] = results[index];
    return acc;
  }, {});
  const detailRoutes = buildOfflineDetailRoutes(collections);

  const [dashboardHome, config] = await Promise.all([
    getDashboardHome(),
    getConfig(),
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

export async function syncOfflineSnapshot(): Promise<OfflineAppSnapshot> {
  const snapshot = await createOfflineSnapshot();
  await saveOfflineSnapshot(snapshot);
  await cacheOfflineRoutes(snapshot.detailRoutes).catch((error) => {
    console.warn('Error caching offline routes:', error);
  });
  return snapshot;
}
