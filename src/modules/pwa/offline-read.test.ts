import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), environment: vi.fn(), auth: vi.fn() }));
vi.mock('./offline-db', () => ({ getOfflineSnapshot: mocks.snapshot }));
vi.mock('./offline-auth', () => ({ isOfflineAuthSessionActive: mocks.auth }));
vi.mock('./offline-helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('./offline-helpers')>();
  return { ...original, isOfflineEnvironment: mocks.environment };
});

import {
  countOfflineCollection, getOfflineCollectionsForSync, getOfflineConfig,
  getOfflineDashboardHome, getOfflinePaginated, getOfflineSnapshotMeta,
  readOfflineCollection, readOfflineCollectionById, shouldUseOfflineRead,
} from './offline-read';

const snapshot = {
  version: 1,
  syncedAt: new Date('2026-01-01T00:00:00Z'),
  collections: {
    servicios: [
      { id: 's1', activo: true, createdAt: new Date(2026, 0, 1) },
      { id: 's2', activo: false, createdAt: new Date(2026, 0, 2) },
      { id: 's3', activo: true, createdAt: new Date(2026, 0, 3) },
    ],
  },
  dashboardHome: { stats: { ventasActivas: 2 } },
  config: { id: 'global' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.environment.mockReturnValue(false);
  mocks.auth.mockReturnValue(false);
  mocks.snapshot.mockResolvedValue(snapshot);
});

describe('offline reads', () => {
  it('only uses offline reads when environment or offline auth is active and a snapshot exists', async () => {
    expect(await shouldUseOfflineRead()).toBe(false);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    mocks.environment.mockReturnValue(true);
    expect(await shouldUseOfflineRead()).toBe(true);
    mocks.snapshot.mockResolvedValueOnce(null);
    expect(await shouldUseOfflineRead()).toBe(false);
    mocks.environment.mockReturnValue(false);
    mocks.auth.mockReturnValue(true);
    expect(await shouldUseOfflineRead()).toBe(true);
  });

  it('reads, filters, locates and counts snapshot collections', async () => {
    expect(await readOfflineCollection('servicios', [{ field: 'activo', operator: '==', value: true }])).toHaveLength(2);
    expect(await readOfflineCollectionById<{ id: string }>('servicios', 's2')).toEqual(expect.objectContaining({ id: 's2' }));
    expect(await readOfflineCollectionById('servicios', 'missing')).toBeNull();
    expect(await countOfflineCollection('servicios', [{ field: 'activo', operator: '==', value: true }])).toBe(2);
    expect(await readOfflineCollection('ventas')).toEqual([]);
    mocks.snapshot.mockResolvedValueOnce(null);
    expect(await readOfflineCollection('servicios')).toEqual([]);
  });

  it('paginates sorted rows with defaults and terminal metadata', async () => {
    expect(await getOfflinePaginated<{ id: string }>('servicios', { pageSize: 2 })).toEqual({
      docs: [expect.objectContaining({ id: 's3' }), expect.objectContaining({ id: 's2' })],
      lastDoc: 2, hasMore: true,
    });
    expect(await getOfflinePaginated<{ id: string }>('servicios', {
      pageSize: 2, startAfterDoc: 2, orderByField: 'createdAt', orderDirection: 'asc',
    })).toEqual({ docs: [expect.objectContaining({ id: 's3' })], lastDoc: 3, hasMore: false });
    expect(await getOfflinePaginated('ventas', { pageSize: 2 })).toEqual({ docs: [], lastDoc: null, hasMore: false });
  });

  it('reads dashboard, config and metadata with null fallbacks', async () => {
    expect(await getOfflineDashboardHome()).toEqual(snapshot.dashboardHome);
    expect(await getOfflineConfig()).toEqual(snapshot.config);
    expect(await getOfflineSnapshotMeta()).toEqual({ syncedAt: snapshot.syncedAt, version: 1 });
    mocks.snapshot.mockResolvedValue(null);
    expect(await getOfflineDashboardHome()).toBeNull();
    expect(await getOfflineConfig()).toBeNull();
    expect(await getOfflineSnapshotMeta()).toBeNull();
    expect(getOfflineCollectionsForSync()).toContain('servicios');
  });
});
