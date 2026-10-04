import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel } from '@/components/shared/Panel';
import type { AutomationsApi } from '@/hooks/use-automations';
import { AutoSendPanel } from './AutoSendPanel';
import { AutomationCardItem } from './AutomationCardItem';
import { RecentNoticesTable } from './RecentNoticesTable';

function Catalog({ api }: { api: AutomationsApi }) {
  if (api.loading) {
    return (
      <div aria-busy="true" className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" />
        <span className="sr-only">Cargando automatizaciones</span>
      </div>
    );
  }
  if (api.error) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5">
        <p className="text-sm">{api.error}</p>
        <Button variant="outline" onClick={() => void api.refresh()}>Reintentar</Button>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {api.activityFailed ? <p role="alert" className="text-sm text-danger">No se pudo cargar la actividad de 30 días; los conteos se muestran en cero.</p> : null}
      {api.groups.map((group) => (
        <section key={group.id} aria-label={group.label} className="space-y-2">
          <Panel title={group.label}><div className="divide-y">
            {group.cards.map((card) => <AutomationCardItem key={card.tipo} card={card} />)}
          </div></Panel>
        </section>
      ))}
    </div>
  );
}

/** Dónde están las acciones automáticas de WhatsApp, qué dicen y qué han hecho; la edición vive en sus pantallas. */
export function AutomationsView({ api }: { api: AutomationsApi }) {
  const [activityOpen, setActivityOpen] = useState(false);
  return (
    <div className="min-w-0 space-y-5">
      <AutoSendPanel auto={api.auto} />
      <Catalog api={api} />
      <Button variant="outline" aria-expanded={activityOpen} onClick={() => setActivityOpen(!activityOpen)}>{activityOpen ? 'Ocultar actividad reciente' : 'Ver actividad reciente'}</Button>
      {activityOpen ? <RecentNoticesTable recent={api.recent} onFilters={api.setFilters} onPage={api.setPage} onRetry={() => void api.refresh()} /> : null}
    </div>
  );
}
