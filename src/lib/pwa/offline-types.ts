import type { CollectionName, QueryFilter } from '@/lib/supabase/entities';
import type { Configuracion, DashboardCounts, DashboardStats } from '@/types';
import type { ActivityLog } from '@/types';

export type OfflineSyncStatus = 'idle' | 'syncing' | 'ready' | 'error';

export interface OfflineDashboardHomeSnapshot {
  stats: DashboardStats;
  counts: DashboardCounts;
  recentActivity: ActivityLog[];
}

export interface OfflineAppSnapshot {
  version: number;
  syncedAt: string;
  collections: Partial<Record<CollectionName, unknown[]>>;
  dashboardHome: OfflineDashboardHomeSnapshot | null;
  config: Configuracion | null;
}

export interface OfflineStateSnapshot {
  lastSyncAt: string | null;
  syncStatus: OfflineSyncStatus;
  isOfflineReady: boolean;
  error: string | null;
}

export interface OfflineQueryOptions {
  collectionName: CollectionName;
  filters?: QueryFilter[];
}
