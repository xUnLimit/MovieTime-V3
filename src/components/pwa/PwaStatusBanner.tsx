'use client';

import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatSyncDate } from '@/lib/pwa/format-sync-date';
import { usePwaStore } from '@/store/pwaStore';

export function PwaStatusBanner() {
  const { isOnline, lastSyncAt, syncStatus, syncProgress, isOfflineReady, syncOfflineData } = usePwaStore();

  const handleRefresh = async () => {
    try {
      await syncOfflineData();
      toast.success('Copia offline actualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la copia offline.');
    }
  };

  if (isOnline && !isOfflineReady) {
    return (
      <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <div className="flex flex-wrap items-center gap-2">
          <span>La app todavia no tiene una copia offline lista.</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleRefresh} disabled={syncStatus === 'syncing'}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
        {syncStatus === 'syncing' && syncProgress ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate">{syncProgress.label}</span>
              <span className="shrink-0 font-medium">{syncProgress.percentage}%</span>
            </div>
            <Progress value={syncProgress.percentage} aria-label="Progreso de sincronizacion offline" />
          </div>
        ) : null}
      </div>
    );
  }

  if (isOnline) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-red-300/50 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Sin conexion. Lectura offline activa con datos de {formatSyncDate(lastSyncAt)}.
        </span>
      </div>
      <Wifi className="h-4 w-4 shrink-0 opacity-40" />
    </div>
  );
}
