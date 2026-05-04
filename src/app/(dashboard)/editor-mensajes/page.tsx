'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTemplatesStore } from '@/store/templatesStore';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { TemplateEditor } from '@/components/editor-mensajes/TemplateEditor';

function EditorMensajesPageContent() {
  const { templates, fetchTemplates } = useTemplatesStore();

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editor de Mensajes de WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Editor de Mensajes</span>
        </p>
      </div>

      <TemplateEditor templates={templates} />
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
