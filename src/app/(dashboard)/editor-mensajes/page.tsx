'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { SyncMetaButton } from '@/components/editor-mensajes/SyncMetaButton';
import { TemplateEditor } from '@/components/editor-mensajes/TemplateEditor';
import { useTemplates } from '@/hooks/use-templates';
import { isEditableTipo } from '@/modules/messaging/template-tipos';

function EditorMensajesPageContent() {
  const { data: templates = [], refetch: refetchTemplates } = useTemplates();
  // Enlace profundo desde Bot > Automatizaciones; un tipo desconocido se ignora y abre el primero.
  const requested = useSearchParams().get('tipo');
  const initialTipo = isEditableTipo(requested) ? requested : undefined;

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title="Mensajes de WhatsApp"
        actions={<SyncMetaButton />}
      />

      <TemplateEditor
        key={initialTipo ?? 'default'}
        templates={templates}
        initialTipo={initialTipo}
        onTemplateSaved={async () => {
          await refetchTemplates();
        }}
      />
    </div>
  );
}

export default function EditorMensajesPage() {
  return (
    <ModuleErrorBoundary moduleName="Editor de Mensajes">
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando...</div>}>
        <EditorMensajesPageContent />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
