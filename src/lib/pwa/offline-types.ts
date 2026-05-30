import type { CollectionName, QueryFilter } from '@/platform/supabase/entities';
import type { Configuracion, DashboardCounts, DashboardStats } from '@/types';
import type { ActivityLog } from '@/types';

export type OfflineSyncStatus = 'idle' | 'syncing' | 'ready' | 'error';
export type OfflineSyncPhase = 'preparing' | 'collections' | 'dashboard' | 'saving' | 'routes' | 'done';

export interface OfflineSyncProgress {
  phase: OfflineSyncPhase;
  percentage: number;
  completed: number;
  total: number;
  label: string;
}

export interface OfflineDashboardHomeSnapshot {
  stats: DashboardStats;
  counts: DashboardCounts;
  recentActivity: ActivityLog[];
}

export interface OfflineAppSnapshot {
  version: number;
  syncedAt: string;
  collections: Partial<Record<CollectionName, unknown[]>>;
  detailRoutes: string[];
  dashboardHome: OfflineDashboardHomeSnapshot | null;
  config: Configuracion | null;
}

export interface OfflineStateSnapshot {
  lastSyncAt: string | null;
  syncStatus: OfflineSyncStatus;
  isOfflineReady: boolean;
  syncProgress: OfflineSyncProgress | null;
  error: string | null;
}

export interface OfflineQueryOptions {
  collectionName: CollectionName;
  filters?: QueryFilter[];
}
