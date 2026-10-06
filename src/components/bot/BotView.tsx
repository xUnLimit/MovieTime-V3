'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/use-tab-param';
import { useUnsavedNavigation } from '@/hooks/use-unsaved-navigation';
import type { BotAdminApi } from '@/types/bot';
import { ActivityTab } from './ActivityTab';
import { PublishControls } from './PublishControls';
import { SettingsBoard } from './settings/SettingsBoard';
import { BotStatusMenu } from './studio/BotStatusMenu';
import { BotStudio } from './studio/BotStudio';
import { ResponsesStudio } from './studio/ResponsesStudio';

const TABS = ['recorrido', 'respuestas', 'actividad', 'ajustes'] as const;

/**
 * Herramienta única de Automatizaciones: el estudio del recorrido de WhatsApp (lista, lienzo e inspector) con sus respuestas, actividad y ajustes
 * (que incluyen el historial de versiones). Solo el editor permanece montado al cambiar de pestaña, para conservar el lienzo, la selección y el simulador.
 */
export function BotView({ api }: { api: BotAdminApi }) {
  const [tab, setTab] = useTabParam(TABS, 'recorrido');
  useUnsavedNavigation(api.dirty);

  return <div className="min-w-0 space-y-4">
    <PageHeader title="Automatizaciones" description="Diseña lo que responde el bot de WhatsApp: menú, compras, códigos y atención. Los cambios llegan a los clientes al publicar."
      actions={<><BotStatusMenu api={api} /><PublishControls api={api} /></>} />
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Herramientas del recorrido">
        <TabsTrigger value="recorrido">Editor</TabsTrigger>
        <TabsTrigger value="respuestas">Respuestas</TabsTrigger>
        <TabsTrigger value="actividad">Actividad</TabsTrigger>
        <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
      </TabsList>
      <TabsContent value="recorrido" forceMount className="min-w-0 data-[state=inactive]:hidden"><BotStudio api={api} /></TabsContent>
      <TabsContent value="respuestas" className="min-w-0"><ResponsesStudio api={api} /></TabsContent>
      <TabsContent value="actividad" className="min-w-0"><ActivityTab api={api} /></TabsContent>
      <TabsContent value="ajustes" className="min-w-0"><SettingsBoard api={api} /></TabsContent>
    </Tabs>
  </div>;
}
