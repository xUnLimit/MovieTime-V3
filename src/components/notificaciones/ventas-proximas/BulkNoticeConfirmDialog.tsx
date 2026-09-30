'use client';

import { MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { groupNotificationsForSend } from './notice-helpers';
import type { NotificacionVentaConId } from './types';

interface BulkNoticeConfirmDialogProps {
  open: boolean;
  items: readonly NotificacionVentaConId[];
  isSending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkNoticeConfirmDialog({ open, items, isSending, onConfirm, onCancel }: BulkNoticeConfirmDialogProps) {
  const groups = groupNotificationsForSend(items);
  const count = groups.length;
  const plural = count === 1 ? '' : 's';
  const grouped = items.length > count;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isSending) onCancel(); }}>
      <DialogContent
        className="sm:max-w-[440px]"
        showCloseButton={false}
        onEscapeKeyDown={(event) => { if (isSending) event.preventDefault(); }}
        onInteractOutside={(event) => { if (isSending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{`¿Enviar ${count} mensaje${plural} por WhatsApp?`}</DialogTitle>
          <DialogDescription>
            {grouped
              ? `Los ${items.length} servicios seleccionados se agrupan en ${count} mensaje${plural}: uno por cliente y fecha de vencimiento. `
              : 'Se enviará el aviso de vencimiento a los clientes seleccionados. '}
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <ul
          aria-label="Clientes seleccionados"
          className="max-h-[216px] divide-y overflow-y-auto rounded-md border"
        >
          {groups.map((group) => (
            <li key={group.key} className="flex h-[49px] items-center justify-between gap-3 px-3 py-1">
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">{group.clienteNombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {group.notifs.map((notif) => notif.categoriaNombre || notif.servicioNombre).join(', ')}
                </p>
              </div>
              {group.notifs.length > 1 ? (
                <span className="shrink-0 text-xs text-muted-foreground tabular">{group.notifs.length} servicios</span>
              ) : null}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSending} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={isSending} aria-busy={isSending} onClick={onConfirm}>
            <MessageSquare />
            {isSending ? 'Enviando...' : `Enviar ${count} mensaje${plural}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
