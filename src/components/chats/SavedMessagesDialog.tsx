'use client';

import { useMemo, useState } from 'react';
import { Bookmark, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useChatSavedMessages, useDeleteChatMessage, useSaveChatMessage } from '@/hooks/use-chat-saved-messages';
import type { SavedMessage, SavedMessageDraft } from '@/modules/whatsapp/saved-messages';
import { cn } from '@/platform/utils/cn';
import { SavedMessageEditor } from './SavedMessageEditor';
import { SavedMessagePreview } from './SavedMessagePreview';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (message: SavedMessage) => void;
  canUse?: boolean;
};

const KIND_LABELS: Record<SavedMessage['kind'], string> = {
  text: 'Texto', buttons: 'Botones', list: 'Lista',
};

export function SavedMessagesDialog({ open, onOpenChange, onUse, canUse = true }: Props) {
  const { data: messages = [], isLoading, isError, refetch } = useChatSavedMessages(open);
  const saveMessage = useSaveChatMessage();
  const deleteMessage = useDeleteChatMessage();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return term ? messages.filter((message) => `${message.title} ${message.body}`.toLocaleLowerCase('es').includes(term)) : messages;
  }, [messages, search]);
  const selected = filtered.find((message) => message.id === selectedId) ?? filtered[0] ?? null;
  const showRight = showDetail || editing !== null;

  const save = async (draft: SavedMessageDraft) => {
    const saved = await saveMessage.mutateAsync({ draft, id: editing === 'edit' ? selected?.id : undefined });
    setSelectedId(saved.id);
    setEditing(null);
    setShowDetail(true);
  };

  const remove = async () => {
    if (!selected) return;
    setDeleteError(false);
    try {
      await deleteMessage.mutateAsync(selected.id);
      setSelectedId(null);
      setEditing(null);
      setShowDetail(false);
      setConfirmDelete(false);
    } catch {
      setDeleteError(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="chats-surface flex h-[min(90dvh,740px)] flex-col gap-0 overflow-hidden border-chat-line bg-chat-surface p-0 text-chat-ink sm:max-w-[900px]">
        <DialogHeader className="shrink-0 border-b border-chat-line-soft px-5 py-5 text-left sm:px-6">
          <DialogTitle className="pr-8">Mensajes guardados</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-chat-muted">Crea mensajes para todo el equipo. Puedes combinar texto con botones o una lista.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <section aria-label="Biblioteca de mensajes" className={cn('min-h-0 flex-col border-chat-line-soft md:flex md:border-r', showRight ? 'hidden' : 'flex')}>
            <div className="space-y-3 border-b border-chat-line-soft p-4">
              <button type="button" onClick={() => { setEditing('new'); setShowDetail(true); }} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-chat-accent px-3 text-sm font-semibold text-chat-accent-ink hover:bg-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="h-4 w-4" aria-hidden />Nuevo mensaje</button>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chat-quiet" aria-hidden />
                <input type="search" aria-label="Buscar mensajes guardados" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar mensajes" className="h-10 w-full rounded-md border border-chat-line bg-chat-raised pl-9 pr-3 text-base text-chat-ink outline-none placeholder:text-chat-quiet focus:border-chat-accent focus-visible:ring-2 focus-visible:ring-chat-accent/25 sm:text-sm" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {isLoading ? <p role="status" className="px-3 py-5 text-sm text-chat-muted">Cargando mensajes…</p> : null}
              {isError ? <div className="px-3 py-5 text-sm text-chat-muted"><p>No se pudieron cargar los mensajes.</p><button type="button" onClick={() => void refetch()} className="mt-2 font-semibold text-chat-accent-strong underline">Reintentar</button></div> : null}
              {!isLoading && !isError && messages.length === 0 ? <div className="px-3 py-8 text-center"><Bookmark className="mx-auto h-6 w-6 text-chat-accent-strong" aria-hidden /><p className="mt-3 text-sm font-semibold">Aún no hay mensajes guardados</p><p className="mt-1 text-xs leading-relaxed text-chat-muted">Crea uno para usarlo en cualquier conversación.</p></div> : null}
              {!isLoading && !isError && messages.length > 0 && filtered.length === 0 ? <p className="px-3 py-5 text-sm text-chat-muted">No hay mensajes que coincidan con la búsqueda.</p> : null}
              <ul className="space-y-1">
                {filtered.map((message) => <li key={message.id}>
                  <button type="button" onClick={() => { setSelectedId(message.id); setEditing(null); setShowDetail(true); }} className={cn('w-full rounded-md px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected?.id === message.id && editing !== 'new' ? 'bg-chat-selected' : 'hover:bg-chat-hover')}>
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-chat-ink">{message.title}</span><span className="shrink-0 text-xs text-chat-muted">{KIND_LABELS[message.kind]}</span></span>
                    <span className="mt-1 block truncate text-xs text-chat-muted">{message.body}</span>
                  </button>
                </li>)}
              </ul>
            </div>
          </section>

          <section aria-label="Detalle del mensaje" className={cn('min-h-0 flex-col md:flex', showRight ? 'flex' : 'hidden')}>
            <button type="button" onClick={() => { setShowDetail(false); setEditing(null); }} className="flex min-h-10 items-center gap-1 border-b border-chat-line-soft px-5 text-xs font-semibold text-chat-accent-strong md:hidden"><X className="h-3.5 w-3.5" aria-hidden />Volver a mensajes</button>
            {editing ? <SavedMessageEditor key={editing === 'edit' ? selected?.id : 'new'} initial={editing === 'edit' ? selected ?? undefined : undefined} onSave={save} onCancel={() => setEditing(null)} /> : selected ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                  <div><span className="text-xs font-semibold uppercase tracking-wide text-chat-accent-strong">{KIND_LABELS[selected.kind]}</span><h3 className="mt-1 text-base font-semibold">{selected.title}</h3><p className="mt-1 text-xs text-chat-muted">{canUse ? selected.kind === 'text' ? 'Se copiará al cuadro de mensaje para que lo revises.' : 'Se enviará tal cual al chat. Usa "Editar" si quieres cambiar algo antes.' : 'Podrás usarlo cuando el cliente vuelva a escribir.'}</p></div>
                  <SavedMessagePreview message={selected} />
                  {selected.kind === 'list' ? <div><p className="text-xs font-semibold text-chat-ink">Opciones de la lista</p><ul className="mt-2 space-y-1 text-xs text-chat-muted">{selected.options.map((option, index) => <li key={index}>{index + 1}. {option.title}{option.description ? ` — ${option.description}` : ''}</li>)}</ul></div> : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-chat-line-soft px-5 py-3 sm:px-6">
                  <div className="flex gap-1"><button type="button" onClick={() => setEditing('edit')} className="flex min-h-10 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-chat-muted hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Pencil className="h-3.5 w-3.5" aria-hidden />Editar</button><button type="button" onClick={() => setConfirmDelete(true)} className="flex min-h-10 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-chat-muted hover:bg-chat-hover hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-3.5 w-3.5" aria-hidden />Eliminar</button></div>
                  {canUse ? <button type="button" onClick={() => onUse(selected)} className="min-h-10 rounded-md bg-chat-accent px-4 text-sm font-semibold text-chat-accent-ink hover:bg-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Usar en chat</button> : null}
                </div>
              </div>
            ) : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><Bookmark className="h-7 w-7 text-chat-accent-strong" aria-hidden /><p className="mt-3 text-sm font-semibold">Elige un mensaje o crea uno nuevo</p><p className="mt-1 text-xs text-chat-muted">Los mensajes guardados están disponibles para todo el equipo.</p></div>}
          </section>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent size="sm" className="chats-surface border-chat-line bg-chat-surface text-chat-ink">
          <AlertDialogHeader><AlertDialogTitle>Eliminar mensaje guardado</AlertDialogTitle><AlertDialogDescription>Se quitará de la biblioteca del equipo. Los mensajes ya enviados no cambian.</AlertDialogDescription></AlertDialogHeader>
          {deleteError ? <p role="alert" className="text-xs text-destructive">No se pudo eliminar. Intenta de nuevo.</p> : null}
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleteMessage.isPending} onClick={(event) => { event.preventDefault(); void remove(); }}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
