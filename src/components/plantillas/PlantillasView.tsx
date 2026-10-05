'use client';

import { useSearchParams } from 'next/navigation';

import { SyncMetaButton } from '@/components/editor-mensajes/SyncMetaButton';
import { TemplateEditor } from '@/components/editor-mensajes/TemplateEditor';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/use-tab-param';
import { useNoticeActivity, useRecentNotices } from '@/hooks/use-template-notices';
import { useTemplates } from '@/hooks/use-templates';
import { isEditableTipo, type EditableTipoKey } from '@/modules/messaging/template-tipos';
import { RecentNoticesTable } from './RecentNoticesTable';
import { TemplateUsage } from './TemplateUsage';

const TABS = ['plantillas', 'envios'] as const;

function TemplatesTab({ initialTipo, onShowNotices }: { initialTipo?: EditableTipoKey; onShowNotices: (tipo: EditableTipoKey) => void }) {
  const templates = useTemplates();
  const activity = useNoticeActivity();
  if (templates.isLoading) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-[30rem] w-full rounded-xl" />
        <span className="sr-only">Cargando plantillas</span>
      </div>
    );
  }
  if (templates.isError) {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-danger">No se pudieron cargar las plantillas.</p>
        <Button variant="outline" onClick={() => void templates.refetch()}>Reintentar</Button>
      </div>
    );
  }
  return (
    <TemplateEditor
      key={initialTipo ?? 'default'}
      templates={templates.data ?? []}
      initialTipo={initialTipo}
      onTemplateSaved={async () => { await templates.refetch(); }}
      renderDetails={(tipo) => <TemplateUsage tipo={tipo} activity={activity} onShowNotices={onShowNotices} />}
    />
  );
}

/**
 * Plantillas de los avisos de WhatsApp (vencimiento, renovación, credenciales...) y su historial de envíos.
 * Son independientes del recorrido del bot, que se edita en Automatizaciones.
 */
export function PlantillasView() {
  const [tab, setTab] = useTabParam(TABS, 'plantillas');
  // Enlace profundo `?tipo=` (también desde los enlaces antiguos); un tipo desconocido se ignora y abre el primero.
  const requested = useSearchParams().get('tipo');
  const initialTipo = isEditableTipo(requested) ? requested : undefined;
  const notices = useRecentNotices({ enabled: tab === 'envios' });

  const showNotices = (tipo: EditableTipoKey) => {
    notices.setFilters({ tipo });
    setTab('envios');
  };

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title="Plantillas de mensajes"
        description="Mensajes de WhatsApp que reciben tus clientes (avisos de vencimiento y de corte, renovaciones, credenciales y transferencias) y respuestas a los botones de esas plantillas. Los textos del bot se editan en Automatizaciones."
        actions={<SyncMetaButton />}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Secciones de plantillas">
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
          <TabsTrigger value="envios">Envíos recientes</TabsTrigger>
        </TabsList>
        {/* Siempre montada: un borrador sin guardar sobrevive al cambio de pestaña. */}
        <TabsContent value="plantillas" forceMount className="data-[state=inactive]:hidden">
          <TemplatesTab initialTipo={initialTipo} onShowNotices={showNotices} />
        </TabsContent>
        <TabsContent value="envios">
          <RecentNoticesTable notices={notices} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
