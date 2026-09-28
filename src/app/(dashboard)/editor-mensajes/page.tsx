'use client';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { SyncMetaButton } from '@/components/editor-mensajes/SyncMetaButton';
import { TemplateEditor } from '@/components/editor-mensajes/TemplateEditor';
import { useTemplates } from '@/hooks/use-templates';

function EditorMensajesPageContent() {
  const { data: templates = [], refetch: refetchTemplates } = useTemplates();

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mensajes de WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Elige un mensaje, edita su texto y vincula la plantilla de Meta para enviarlo por la API.
          </p>
        </div>
        <SyncMetaButton />
      </div>

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
