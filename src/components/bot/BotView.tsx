'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { BotAdminApi } from '@/types/bot';
import { OverviewTab } from './OverviewTab';
import { FlowTab } from './FlowTab';
import { MessagesTab } from './MessagesTab';
import { RulesTab } from './RulesTab';
import { ActivityTab } from './ActivityTab';
import { VersionsTab } from './VersionsTab';
import { PublishBar } from './PublishBar';
import { useUnsavedNavigation } from '@/hooks/use-unsaved-navigation';

const tabs = [
  { id: 'resumen', label: 'Resumen', render: (api: BotAdminApi) => <OverviewTab api={api} /> },
  { id: 'flujo', label: 'Flujo', render: (api: BotAdminApi) => <FlowTab api={api} /> },
  { id: 'mensajes', label: 'Mensajes', render: (api: BotAdminApi) => <MessagesTab api={api} /> },
  { id: 'reglas', label: 'Reglas', render: (api: BotAdminApi) => <RulesTab api={api} /> },
  { id: 'actividad', label: 'Actividad', render: (api: BotAdminApi) => <ActivityTab api={api} /> },
  { id: 'versiones', label: 'Versiones', render: (api: BotAdminApi) => <VersionsTab api={api} /> },
];

export function BotView({ api }: { api: BotAdminApi }) {
  const [selected, setSelected] = useState('flujo');
  useUnsavedNavigation(api.dirty);

  return <div className="min-w-0 space-y-4 pb-36">
    <PageHeader title="Editar recorrido de WhatsApp" description="Modifica sus pasos, prueba el resultado y publica una versión." />
    <div className="flex flex-wrap gap-2" aria-label="Herramientas del recorrido">
      {tabs.map(tab => <Button key={tab.id} variant={selected === tab.id ? 'secondary' : 'outline'} aria-pressed={selected === tab.id} onClick={() => setSelected(tab.id)}>{tab.id === 'flujo' ? 'Pasos y prueba' : tab.id === 'reglas' ? 'Condiciones' : tab.label}</Button>)}
    </div>
    {tabs.map(({ id, render }) => <div key={id} hidden={selected !== id}>{render(api)}</div>)}
    <PublishBar api={api} />
  </div>;
}

