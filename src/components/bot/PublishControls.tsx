'use client';

import { useState } from 'react';
import { AlertTriangle, MoreHorizontal, RotateCcw } from 'lucide-react';
import { diffDefinitions } from '@/modules/bot-config';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { BotAdminApi } from '@/types/bot';

/** Problemas de validación en un popover: ocupan lugar solo cuando se consultan. */
function IssuesPopover({ api }: { api: BotAdminApi }) {
  const errors = api.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = api.issues.length - errors;
  if (api.issues.length === 0) return null;
  const label = errors > 0 ? `${errors} ${errors === 1 ? 'error' : 'errores'}` : `${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}`;
  return <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" aria-label={`Ver problemas: ${label}`}><AlertTriangle className={errors > 0 ? 'text-danger' : 'text-warning'} />{label}</Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] space-y-2">
      <p className="text-sm font-semibold">Problemas de validación</p>
      <ul className="max-h-64 space-y-1.5 overflow-y-auto text-xs" aria-label="Problemas de validación">
        {api.issues.map((issue, index) => <li key={`${issue.path}-${index}`} className={issue.severity === 'error' ? 'text-danger' : 'text-warning'}>
          <span className="font-medium">{issue.severity === 'error' ? 'Error' : 'Aviso'}</span>: {issue.path} · {issue.message}
        </li>)}
      </ul>
      {errors > 0 ? <p className="text-xs text-muted-foreground">Publicar se bloquea mientras haya errores.</p> : null}
    </PopoverContent>
  </Popover>;
}

/**
 * Estado del borrador y acciones de publicación, junto al título de la página (no flotan sobre el contenido):
 * cuántos cambios hay sin publicar, descartar, publicar y, en el menú, restablecer los valores por defecto.
 */
export function PublishControls({ api }: { api: BotAdminApi }) {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const changes = api.dirty && api.draft && api.published ? diffDefinitions(api.published, api.draft) : [];
  const changeCount = api.dirty ? Math.max(1, changes.length) : 0;
  async function publish() {
    try { await api.publish(note.trim()); setOpen(false); setNote(''); setError(null); }
    catch { setError('No se pudo publicar. Inténtalo de nuevo.'); }
  }
  return <>
    <div role="group" aria-label="Publicación del bot" className="flex flex-wrap items-center justify-end gap-2">
      <StatusBadge tone={api.dirty ? 'warning' : 'neutral'}>{api.dirty ? `${changeCount} ${changeCount === 1 ? 'cambio' : 'cambios'} sin publicar` : 'Sin cambios'}</StatusBadge>
      <IssuesPopover api={api} />
      <Button variant="outline" disabled={!api.dirty || api.saving} onClick={api.discardDraft}>Descartar</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Más acciones del borrador" disabled={api.saving}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setResetting(true)}><RotateCcw />Restablecer valores por defecto</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button disabled={!api.dirty || api.hasErrors || api.saving} onClick={() => setOpen(true)}>Publicar</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Publicar versión</DialogTitle><DialogDescription>Los clientes verán estos cambios de inmediato. La nota identifica esta versión en el historial.</DialogDescription></DialogHeader>
      {changes.length > 0 ? <div className="space-y-1.5">
        <p className="text-sm font-medium">Qué cambia</p>
        <ul aria-label="Cambios a publicar" className="max-h-40 list-inside list-disc overflow-y-auto rounded-md border bg-muted p-3 text-xs">{changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
      </div> : null}
      <label className="space-y-2 text-sm font-medium">Nota de publicación<Input value={note} maxLength={200} placeholder="Ej.: Nuevo botón de compras" onChange={event => setNote(event.target.value)} /></label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!note.trim() || api.saving} onClick={() => void publish()}>Publicar</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={resetting} onOpenChange={setResetting}><DialogContent><DialogHeader><DialogTitle>Restablecer valores por defecto</DialogTitle><DialogDescription>Esto reemplaza todo el borrador por el recorrido y los textos originales. Lo publicado no cambia hasta que publiques; puedes descartar el borrador antes.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => setResetting(false)}>Cancelar</Button><Button variant="destructive" onClick={() => { api.resetToDefaults(); setResetting(false); }}>Restablecer</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
