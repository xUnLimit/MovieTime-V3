'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/use-tab-param';
import { useUnsavedNavigation } from '@/hooks/use-unsaved-navigation';
import type { BotAdminApi } from '@/types/bot';
import { ActivityTab } from './ActivityTab';
import { BotPowerControl } from './BotPowerControl';
import { FlowTab } from './FlowTab';
import { MessagesTab } from './MessagesTab';
import { PublishBar } from './PublishBar';
import { SettingsTab } from './SettingsTab';
import { VersionsTab } from './VersionsTab';

const TABS = ['recorrido', 'respuestas', 'ajustes', 'actividad', 'versiones'] as const;

/**
 * Herramienta única de Automatizaciones: el recorrido de WhatsApp con sus respuestas, ajustes, actividad y versiones.
 * Solo el recorrido permanece montado al cambiar de pestaña, para conservar el lienzo, la selección y el simulador.
 */
export function BotView({ api }: { api: BotAdminApi }) {
  const [tab, setTab] = useTabParam(TABS, 'recorrido');
  useUnsavedNavigation(api.dirty);

  return <div className="min-w-0 space-y-4 pb-36">
    <PageHeader title="Automatizaciones" description="Diseña lo que responde el bot de WhatsApp: menú, compras, códigos y atención. Los cambios llegan a los clientes al publicar."
      actions={<BotPowerControl api={api} />} />
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Herramientas del recorrido">
        <TabsTrigger value="recorrido">Recorrido</TabsTrigger>
        <TabsTrigger value="respuestas">Respuestas</TabsTrigger>
        <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
        <TabsTrigger value="actividad">Actividad</TabsTrigger>
        <TabsTrigger value="versiones">Versiones</TabsTrigger>
      </TabsList>
      <TabsContent value="recorrido" forceMount className="min-w-0 data-[state=inactive]:hidden"><FlowTab api={api} /></TabsContent>
      <TabsContent value="respuestas" className="min-w-0"><MessagesTab api={api} /></TabsContent>
      <TabsContent value="ajustes" className="min-w-0"><SettingsTab api={api} /></TabsContent>
      <TabsContent value="actividad" className="min-w-0"><ActivityTab api={api} /></TabsContent>
      <TabsContent value="versiones" className="min-w-0"><VersionsTab api={api} /></TabsContent>
    </Tabs>
    <PublishBar api={api} />
  </div>;
}
