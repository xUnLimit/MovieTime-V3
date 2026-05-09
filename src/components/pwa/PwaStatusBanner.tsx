'use client';

import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { usePwaStore } from '@/store/pwaStore';

function formatSyncDate(date: Date | null) {
  if (!date) return 'Sin copia offline';
  return date.toLocaleString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function PwaStatusBanner() {
  const { isOnline, lastSyncAt, syncStatus, isOfflineReady, syncOfflineData } = usePwaStore();

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
        La app todavia no tiene una copia offline lista.
        <Button variant="ghost" size="sm" className="ml-2 h-7 px-2" onClick={handleRefresh} disabled={syncStatus === 'syncing'}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
          Sincronizar
        </Button>
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
