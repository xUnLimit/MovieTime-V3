'use client';

import { Sticker as StickerIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useChatSavedStickers, useDeleteChatSticker } from '@/hooks/use-chat-saved-stickers';
import { useWhatsAppMedia } from '@/hooks/use-whatsapp-chat';
import type { SavedSticker } from '@/application/use-cases/chat-saved-sticker-use-cases';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sticker: SavedSticker) => void;
};

function StickerThumb({ sticker, onSelect, onDelete }: { sticker: SavedSticker; onSelect: () => void; onDelete: () => void }) {
  const { objectUrl, isError } = useWhatsAppMedia(sticker.mediaId, true);

  return (
    <div className="group/sticker relative">
      <button
        type="button"
        onClick={onSelect}
        disabled={!objectUrl}
        aria-label="Enviar sticker"
        className="grid aspect-square w-full place-items-center rounded-lg bg-chat-raised transition-colors hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL blob local, next/image no aplica
          <img src={objectUrl} alt="Sticker guardado" className="h-full w-full object-contain p-1.5" />
        ) : isError ? (
          <span className="text-[10px] text-chat-muted">Error</span>
        ) : (
          <span className="h-6 w-6 animate-pulse rounded bg-black/10" aria-hidden />
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Quitar sticker de guardados"
        className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-chat-surface text-chat-muted opacity-0 shadow-sm transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/sticker:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function StickerPickerDialog({ open, onOpenChange, onSelect }: Props) {
  const { data: stickers = [], isLoading, isError, refetch } = useChatSavedStickers(open);
  const deleteSticker = useDeleteChatSticker();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="chats-surface flex max-h-[min(80dvh,640px)] flex-col gap-0 overflow-hidden border-chat-line bg-chat-surface p-0 text-chat-ink sm:max-w-[420px]">
        <DialogHeader className="shrink-0 border-b border-chat-line-soft px-5 py-4 text-left">
          <DialogTitle className="pr-8 font-editorial text-[19px] font-normal">Stickers</DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-chat-muted">
            Guarda stickers desde los mensajes que te envían los clientes y reutilízalos aquí.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? <p role="status" className="px-1 py-5 text-[13px] text-chat-muted">Cargando stickers…</p> : null}
          {isError ? (
            <div className="px-1 py-5 text-[13px] text-chat-muted">
              <p>No se pudieron cargar los stickers.</p>
              <button type="button" onClick={() => void refetch()} className="mt-2 font-semibold text-chat-accent-strong underline">Reintentar</button>
            </div>
          ) : null}
          {!isLoading && !isError && stickers.length === 0 ? (
            <div className="px-1 py-8 text-center">
              <StickerIcon className="mx-auto h-6 w-6 text-chat-accent-strong" aria-hidden />
              <p className="mt-3 text-[13px] font-semibold">Aún no hay stickers guardados</p>
              <p className="mt-1 text-[12px] leading-relaxed text-chat-muted">Cuando un cliente te envíe uno, guárdalo desde el menú del mensaje.</p>
            </div>
          ) : null}
          {!isLoading && !isError && stickers.length > 0 ? (
            <div className="grid grid-cols-4 gap-2.5">
              {stickers.map((sticker) => (
                <StickerThumb
                  key={sticker.id}
                  sticker={sticker}
                  onSelect={() => onSelect(sticker)}
                  onDelete={() => {
                    deleteSticker.mutate(sticker.id, {
                      onError: (error) => toast.error(getPublicErrorMessage(error, 'No se pudo quitar el sticker.')),
                    });
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
