'use client';

import Link from 'next/link';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { TemplateEditor } from '@/components/editor-mensajes/TemplateEditor';
import { useTemplates } from '@/hooks/use-templates';

function EditorMensajesPageContent() {
  const { data: templates = [], refetch: refetchTemplates } = useTemplates();

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editor de Mensajes de WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Editor de Mensajes</span>
        </p>
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
