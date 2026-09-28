'use client';

import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useMetaTemplates, useSyncMetaTemplates } from '@/hooks/use-templates';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';

function lastSyncLabel(times: number[]) {
  if (times.length === 0) return 'Aún no se ha sincronizado.';
  return `Última sincronización: ${new Date(Math.max(...times)).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' })}`;
}

// Acción global: trae de Meta el catálogo de plantillas que se pueden vincular a cada mensaje.
export function SyncMetaButton() {
  const { data: metaTemplates = [] } = useMetaTemplates();
  const syncMeta = useSyncMetaTemplates();
  const times = metaTemplates.map((item) => new Date(item.syncedAt).getTime()).filter(Number.isFinite);

  const handleSync = () => {
    syncMeta.mutate(undefined, {
      onSuccess: ({ count }) => toast.success('Plantillas sincronizadas', { description: `Se actualizaron ${count} plantillas desde Meta.` }),
      onError: (error) => toast.error('No se pudo sincronizar', { description: getPublicErrorMessage(error, 'No se pudo sincronizar con Meta.') }),
    });
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={syncMeta.isPending}>
        <RefreshCw className={syncMeta.isPending ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden />
        {syncMeta.isPending ? 'Sincronizando...' : 'Sincronizar con Meta'}
      </Button>
      <span className="text-xs text-muted-foreground">{lastSyncLabel(times)}</span>
    </div>
  );
}
