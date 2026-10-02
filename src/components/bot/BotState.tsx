import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import type { BotAdminApi } from '@/types/bot';

export function BotState({ api, empty, children }: { api: BotAdminApi; empty?: boolean; children: React.ReactNode }) {
  if (api.loading) return <div aria-busy="true" className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /><span className="sr-only">Cargando bot</span></div>;
  if (api.error) return <div role="alert" className="space-y-3 rounded-xl border p-5"><p>{api.error}</p><Button variant="outline" onClick={() => void api.refresh()}>Reintentar</Button></div>;
  if (empty) return <EmptyState message="Todavía no hay datos" description="Los datos aparecerán cuando estén disponibles." />;
  return children;
}
