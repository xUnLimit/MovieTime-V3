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
import { AutomationsTab } from './AutomationsTab';
import { VersionsTab } from './VersionsTab';
import { PublishBar } from './PublishBar';

const tabs = [
  { id: 'resumen', label: 'Resumen', render: (api: BotAdminApi) => <OverviewTab api={api} /> },
  { id: 'flujo', label: 'Flujo', render: (api: BotAdminApi) => <FlowTab api={api} /> },
  { id: 'mensajes', label: 'Mensajes', render: (api: BotAdminApi) => <MessagesTab api={api} /> },
  { id: 'reglas', label: 'Reglas', render: (api: BotAdminApi) => <RulesTab api={api} /> },
  { id: 'automatizaciones', label: 'Automatizaciones', render: () => <AutomationsTab /> },
  { id: 'actividad', label: 'Actividad', render: (api: BotAdminApi) => <ActivityTab api={api} /> },
  { id: 'versiones', label: 'Versiones', render: (api: BotAdminApi) => <VersionsTab api={api} /> },
];

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
      {tabs.map(({ id, render }) => <TabsContent key={id} value={id}>{render(api)}</TabsContent>)}
    </Tabs>
    <PublishBar api={api} />
  </div>;
}
