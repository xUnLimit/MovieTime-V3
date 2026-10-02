'use client';

import { useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BotAdminApi } from '@/types/bot';
import { OverviewTab } from './OverviewTab';
import { FlowTab } from './FlowTab';
import { MessagesTab } from './MessagesTab';
import { RulesTab } from './RulesTab';
import { ActivityTab } from './ActivityTab';
import { VersionsTab } from './VersionsTab';
import { PublishBar } from './PublishBar';

const tabs = [
  { id: 'resumen', label: 'Resumen', Component: OverviewTab },
  { id: 'flujo', label: 'Flujo', Component: FlowTab },
  { id: 'mensajes', label: 'Mensajes', Component: MessagesTab },
  { id: 'reglas', label: 'Reglas', Component: RulesTab },
  { id: 'actividad', label: 'Actividad', Component: ActivityTab },
  { id: 'versiones', label: 'Versiones', Component: VersionsTab },
] as const;

export function BotView({ api }: { api: BotAdminApi }) {
  useEffect(() => {
    if (!api.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const warnNavigation = (event: MouseEvent) => {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest('a[href]') : null;
      if (!anchor) return;
      const destination = new URL(anchor.getAttribute('href') ?? '', window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      if (!window.confirm('Hay cambios sin publicar. ¿Quieres salir de esta página?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', warnNavigation, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', warnNavigation, true); };
  }, [api.dirty]);

  return <div className="min-w-0 space-y-4 pb-36">
    <PageHeader title="Bot" description="Administra las respuestas automáticas de WhatsApp." />
    <Tabs defaultValue="resumen" className="min-w-0">
      <TabsList className="max-w-full overflow-x-auto" aria-label="Secciones del bot">
        {tabs.map(tab => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
      </TabsList>
      {tabs.map(({ id, Component }) => <TabsContent key={id} value={id}><Component api={api} /></TabsContent>)}
    </Tabs>
    <PublishBar api={api} />
  </div>;
}
