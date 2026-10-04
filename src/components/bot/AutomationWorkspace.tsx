'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTemplates } from '@/hooks/use-templates';
import { useBotAdmin } from '@/hooks/use-bot-admin';
import { TemplateEditor } from '@/components/editor-mensajes/TemplateEditor';
import { SyncMetaButton } from '@/components/editor-mensajes/SyncMetaButton';
import { PageHeader } from '@/components/shared/PageHeader';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isEditableTipo } from '@/modules/messaging/template-tipos';
import { tipoLabel } from '@/modules/messaging/template-tipos';
import { useAuthStore } from '@/store/authStore';
import { AutomationsTab } from './AutomationsTab';
import { BotView } from './BotView';
import { AutomationNavigation } from './AutomationNavigation';
import { AutomationOperationsSummary } from './AutomationOperationsSummary';

function Messages({ tipo }: { tipo: string | null }) {
  const templates = useTemplates();
  const selected = isEditableTipo(tipo) ? tipo : undefined;
  if (templates.isLoading) return <Skeleton className="h-96 w-full" />;
  if (templates.isError) return <div role="alert" className="space-y-2"><p className="text-sm text-danger">No se pudieron cargar los mensajes.</p><Button variant="outline" onClick={() => void templates.refetch()}>Reintentar</Button></div>;
  return <div className="space-y-4"><PageHeader title={selected ? tipoLabel(selected) : 'Biblioteca de mensajes'} description={selected ? 'El mensaje se comparte con las acciones de este recorrido. Guardarlo actualiza todos sus envíos.' : 'Mensajes reutilizables para tus recorridos.'} actions={<SyncMetaButton />} />{selected ? null : <AutomationNavigation />}<TemplateEditor templates={templates.data ?? []} initialTipo={selected} focused={Boolean(selected)} onTemplateSaved={async () => { await templates.refetch(); }} /></div>;
}

function Editor() { return <BotView api={useBotAdmin()} />; }

function BotJourney() {
  const api = useBotAdmin();
  return <Panel title="Atender y enviar códigos" description="Recorrido guiado de WhatsApp con mensajes, condiciones y simulador." actions={<StatusBadge tone={api.status?.enabled ? 'success' : 'neutral'}>{api.status?.enabled ? 'Activo' : 'Pausado'}</StatusBadge>} footer={<Button variant="outline" asChild><Link href="/automatizaciones?editar=whatsapp">Editar recorrido</Link></Button>}><p className="text-xs text-muted-foreground">{api.health ? `${api.health.eventsLast24h} acciones en las últimas 24 horas` : 'Consulta el estado y las conexiones desde el recorrido.'}</p></Panel>;
}

export function AutomationWorkspace({ view }: { view?: 'mensajes' } = {}) {
  const params = useSearchParams();
  const user = useAuthStore(state => state.user);
  const editing = params.get('editar') === 'whatsapp';
  const message = params.get('mensaje');
  const library = view === 'mensajes' || params.get('vista') === 'mensajes';
  if (user?.role !== 'admin') return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <div className="min-w-0 space-y-4">
    {editing || message ? <Button variant="ghost" asChild><Link href="/automatizaciones"><ArrowLeft />Volver a automatizaciones</Link></Button> : null}
    {editing ? <Editor /> : message || library ? <Messages key={message ?? 'library'} tipo={message} /> : <>
      <PageHeader title="Automatizaciones" description="Elige el recorrido que quieres revisar o cambiar." />
      <AutomationNavigation />
      <AutomationOperationsSummary />
      <BotJourney />
      <AutomationsTab />
    </>}
  </div>;
}
