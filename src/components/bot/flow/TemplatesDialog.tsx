'use client';

import { useState } from 'react';
import { History, LayoutTemplate } from 'lucide-react';
import { FLOW_TEMPLATES, type FlowTemplateId } from '@/modules/bot-config';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BotAdminApi } from '@/types/bot';
import type { FlowActions } from './flow-actions';

type Choice = { label: string; run: () => Promise<void> };
/** Cuántas versiones recientes se ofrecen como punto de partida; el historial completo vive en Versiones. */
const RECENT_VERSIONS = 5;

/**
 * Puntos de partida para el recorrido: las plantillas predefinidas y las versiones ya publicadas (cada publicación guarda el
 * recorrido completo con su nota, así que publicar con un nombre claro equivale a guardar una plantilla propia).
 * Elegir cualquiera reemplaza el borrador, nunca lo publicado, y pide confirmar antes.
 */
export function TemplatesDialog({ api, actions }: { api: BotAdminApi; actions: FlowActions }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recent = api.versions.slice(0, RECENT_VERSIONS);

  const close = (next: boolean) => { setOpen(next); if (!next) { setChoice(null); setError(null); } };
  const pickTemplate = (id: FlowTemplateId, label: string) => setChoice({ label, run: () => actions.applyTemplate(id) });
  const pickVersion = (version: number, label: string) => setChoice({ label, run: () => api.loadVersionIntoDraft(version) });
  async function confirm() {
    if (!choice) return;
    try { await choice.run(); close(false); }
    catch { setError('No se pudo cargar. Inténtalo de nuevo.'); }
  }

  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><LayoutTemplate />Plantillas</Button>
    <Dialog open={open} onOpenChange={close}><DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Plantillas de recorrido</DialogTitle>
        <DialogDescription>Un recorrido ya armado para empezar. Al usarlo reemplaza el borrador; lo publicado no cambia hasta que publiques.</DialogDescription>
      </DialogHeader>
      {choice ? <div role="alert" className="space-y-3 rounded-md border border-warning-border bg-warning-subtle p-3 text-sm">
        <p><span className="font-medium">«{choice.label}»</span> reemplaza todo el borrador actual. Puedes descartar el borrador antes de seguir.</p>
        {error ? <p className="text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void confirm()}>Reemplazar borrador</Button>
          <Button variant="outline" onClick={() => { setChoice(null); setError(null); }}>Cancelar</Button>
        </div>
      </div> : null}
      <section aria-label="Plantillas predefinidas" className="space-y-2">
        <h3 className="text-sm font-semibold">Predefinidas</h3>
        <ul className="divide-y rounded-md border">
          {FLOW_TEMPLATES.map((template) => <li key={template.id} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1 leading-tight"><p className="text-sm font-medium">{template.label}</p><p className="text-xs text-muted-foreground">{template.description}</p></div>
            <Button variant="outline" aria-label={`Usar plantilla ${template.label}`} onClick={() => pickTemplate(template.id, template.label)}>Usar plantilla</Button>
          </li>)}
        </ul>
      </section>
      <section aria-label="Versiones guardadas" className="space-y-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><History className="size-4" />Tus recorridos guardados</h3>
          <p className="text-xs text-muted-foreground">Cada vez que publicas se guarda el recorrido completo con su nota. Publica con un nombre claro y aparecerá aquí.</p>
        </div>
        {recent.length === 0 ? <p className="text-xs text-muted-foreground">Todavía no hay versiones publicadas.</p> : <ul className="divide-y rounded-md border">
          {recent.map((version) => <li key={version.version} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1 leading-tight">
              <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">Versión {version.version} · {version.note || 'Sin nota'}</span>{version.isPublished ? <StatusBadge tone="success">Publicada</StatusBadge> : null}</p>
              <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleDateString('es-PA', { dateStyle: 'medium' })}</p>
            </div>
            <Button variant="outline" aria-label={`Usar versión ${version.version}`} onClick={() => pickVersion(version.version, `Versión ${version.version}`)}>Usar</Button>
          </li>)}
        </ul>}
      </section>
      <DialogFooter><Button variant="outline" onClick={() => close(false)}>Cerrar</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
