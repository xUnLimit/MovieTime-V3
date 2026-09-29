'use client';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { SyncMetaButton } from '@/components/editor-mensajes/SyncMetaButton';
import { TemplateEditor } from '@/components/editor-mensajes/TemplateEditor';
import { useTemplates } from '@/hooks/use-templates';

function EditorMensajesPageContent() {
  const { data: templates = [], refetch: refetchTemplates } = useTemplates();

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title="Mensajes de WhatsApp"
        description="Elige un mensaje, edita su texto y vincula la plantilla de Meta para enviarlo por la API."
        actions={<SyncMetaButton />}
      />

      <TemplateEditor
        templates={templates}
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
      <EditorMensajesPageContent />
    </ModuleErrorBoundary>
  );
}
