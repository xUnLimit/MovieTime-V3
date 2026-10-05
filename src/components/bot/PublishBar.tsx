'use client';

import { useState } from 'react';
import { diffDefinitions } from '@/modules/bot-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BotAdminApi } from '@/types/bot';

export function PublishBar({ api }: { api: BotAdminApi }) {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const changeCount = api.dirty ? Math.max(1, api.draft && api.published ? diffDefinitions(api.published, api.draft).length : 0) : 0;
  async function publish() {
    try { await api.publish(note.trim()); setOpen(false); setNote(''); setError(null); }
    catch { setError('No se pudo publicar. Inténtalo de nuevo.'); }
  }
  return <>
    <aside aria-label="Publicación del bot" className="fixed inset-x-0 bottom-0 z-20 border-t bg-card p-3 lg:left-56">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-sm">
        <div className="min-w-0 flex-1"><p className="font-medium">{api.dirty ? `${changeCount} ${changeCount === 1 ? 'cambio' : 'cambios'} sin publicar` : 'Sin cambios'}</p>
          {api.issues.length > 0 ? <ul className="max-h-16 overflow-y-auto text-xs" aria-label="Problemas de validación">{api.issues.map((issue, index) => <li key={`${issue.path}-${index}`} className={issue.severity === 'error' ? 'text-danger' : 'text-warning'}>{issue.severity === 'error' ? 'Error' : 'Aviso'}: {issue.path} · {issue.message}</li>)}</ul> : null}
        </div>
        <Button variant="outline" disabled={!api.dirty || api.saving} onClick={api.discardDraft}>Descartar</Button>
        <Button variant="outline" disabled={api.saving} onClick={() => setResetting(true)}>Restablecer valores por defecto</Button>
        <Button disabled={!api.dirty || api.hasErrors || api.saving} onClick={() => setOpen(true)}>Publicar</Button>
      </div>
    </aside>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Publicar versión</DialogTitle><DialogDescription>Escribe una nota para identificar este cambio.</DialogDescription></DialogHeader>
      <label className="space-y-2 text-sm font-medium">Nota de publicación<Input value={note} maxLength={200} onChange={event => setNote(event.target.value)} /></label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!note.trim() || api.saving} onClick={() => void publish()}>Publicar</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={resetting} onOpenChange={setResetting}><DialogContent><DialogHeader><DialogTitle>Restablecer valores por defecto</DialogTitle><DialogDescription>Esto reemplaza todo el borrador por el recorrido y los textos originales. Lo publicado no cambia hasta que publiques; puedes descartar el borrador antes.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => setResetting(false)}>Cancelar</Button><Button variant="destructive" onClick={() => { api.resetToDefaults(); setResetting(false); }}>Restablecer</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
