import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

export type ChangesView = { title: string; description: string; changes: string[] | null; error: string | null };

/** Lista de cambios de una versión (frente a la anterior o a la publicada). `changes: null` y sin error es «cargando». */
export function ChangesDialog({ view, onClose }: { view: ChangesView | null; onClose: () => void }) {
  return <Dialog open={view !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>{view?.title ?? 'Cambios'}</DialogTitle><DialogDescription>{view?.description ?? ''}</DialogDescription></DialogHeader>
      {view?.error ? <p role="alert" className="text-sm text-danger">{view.error}</p> : null}
      {view && !view.error && view.changes === null ? <div aria-busy="true"><Skeleton className="h-24 w-full" /><span className="sr-only">Cargando cambios</span></div> : null}
      {view?.changes ? <ul aria-label="Cambios de la versión" className="max-h-72 list-inside list-disc overflow-y-auto rounded-md border bg-muted p-3 text-sm">
        {view.changes.length ? view.changes.map((change, index) => <li key={index}>{change}</li>) : <li>Sin diferencias</li>}</ul> : null}
      <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
