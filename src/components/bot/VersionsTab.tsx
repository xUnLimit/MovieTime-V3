'use client';

import { useState } from 'react';
import { GitCompare } from 'lucide-react';
import { compareBotVersionsUseCase } from '@/application/use-cases/bot-admin-use-cases';
import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableCard } from '@/components/shared/TableCard';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { BotAdminApi, BotVersionSummary } from '@/types/bot';
import { BotState } from './BotState';
import { VersionCompare } from './VersionCompare';
import { ChangesDialog, type ChangesView } from './versions/ChangesDialog';
import { VersionRowActions } from './versions/VersionRowActions';

const columns = defineDataTableColumns<BotVersionSummary>([
  { key: 'version', header: 'Versión', width: '22%', render: (item) => <div className="min-w-0 leading-tight"><p className="truncate text-sm font-medium tabular-nums">Versión {item.version}</p><p className="truncate text-xs text-muted-foreground">{item.createdBy ?? 'Autor desconocido'}</p></div> },
  { key: 'note', header: 'Nota', width: '38%', render: (item) => <span className={item.note ? 'block truncate text-sm' : 'block truncate text-sm text-muted-foreground'}>{item.note || 'Sin nota'}</span> },
  { key: 'state', header: 'Estado', width: '16%', render: (item) => <StatusBadge tone={item.isPublished ? 'success' : 'neutral'}>{item.isPublished ? 'Publicada' : 'Anterior'}</StatusBadge> },
  { key: 'createdAt', header: 'Fecha', width: '24%', render: (item) => <div className="min-w-0 leading-tight"><p className="truncate text-sm tabular-nums">{new Date(item.createdAt).toLocaleDateString('es-PA', { dateStyle: 'medium' })}</p><p className="truncate text-xs text-muted-foreground tabular-nums">{new Date(item.createdAt).toLocaleTimeString('es-PA', { timeStyle: 'short' })}</p></div> },
]);

/**
 * Historial de publicaciones: cada versión guarda el recorrido y los textos completos. Desde el menú de cada fila se ve qué
 * cambió, se compara con lo publicado o se lleva al borrador (pidiendo confirmar si hay cambios sin publicar).
 */
export function VersionsTab({ api }: { api: BotAdminApi }) {
  const [error, setError] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [view, setView] = useState<ChangesView | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const publishedVersion = api.versions.find((version) => version.isPublished)?.version;

  async function load(version: number) {
    try { await api.loadVersionIntoDraft(version); setError(null); }
    catch { setError('No se pudo cargar la versión. Inténtalo de nuevo.'); }
  }
  async function showChanges(title: string, description: string, from: number | undefined, to: number) {
    if (from === undefined) { setView({ title, description: 'Es la primera versión: no hay otra anterior con la que compararla.', changes: [], error: null }); return; }
    setView({ title, description, changes: null, error: null });
    try { setView({ title, description, changes: await compareBotVersionsUseCase(from, to), error: null }); }
    catch { setView({ title, description, changes: null, error: 'No se pudieron comparar las versiones. Inténtalo de nuevo.' }); }
  }

  return <BotState api={api} empty={api.versions.length === 0}><div className="space-y-4">
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    <TableCard title="Historial de versiones" description="Cada publicación guarda el recorrido completo. Cárgala en el borrador para volver a ella o usarla como punto de partida."
      actions={api.versions.length >= 2 ? <Button variant="outline" onClick={() => setComparing(true)}><GitCompare />Comparar versiones</Button> : undefined}>
      <DataTable bare fixedLayout autoPageSize pagination data={api.versions} columns={columns} emptyMessage="Todavía no hay versiones publicadas."
        actions={(item) => {
          const index = api.versions.findIndex((version) => version.version === item.version);
          const previous = api.versions[index + 1]?.version;
          return <VersionRowActions version={item}
            onChanges={() => void showChanges(`Cambios de la versión ${item.version}`, previous === undefined ? '' : `Qué cambió respecto de la versión ${previous}.`, previous, item.version)}
            onCompareWithPublished={() => void showChanges(`Versión ${item.version} frente a la publicada`, `Qué cambia al pasar de la versión ${publishedVersion ?? '—'} (publicada) a la ${item.version}.`, publishedVersion, item.version)}
            onLoad={() => (api.dirty ? setPending(item.version) : void load(item.version))} />;
        }} />
    </TableCard>
    {api.versions.length >= 2 ? <VersionCompare versions={api.versions} open={comparing} onOpenChange={setComparing} /> : null}
    <ChangesDialog view={view} onClose={() => setView(null)} />
    <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Cargar la versión {pending} en el borrador</AlertDialogTitle>
          <AlertDialogDescription>Tienes cambios sin publicar. Cargar esta versión los reemplaza. Lo publicado no cambia hasta que publiques.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => { const version = pending; setPending(null); if (version !== null) void load(version); }}>Reemplazar borrador</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div></BotState>;
}
