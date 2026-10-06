'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Eye, MessageSquare, MoreHorizontal, RotateCw, Trash2, UserRound, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePedidoActions } from '@/hooks/use-pedidos';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { Pedido } from '@/modules/orders/contracts';
import { canDeletePedido, type PedidoClient } from './pedido-status';

const CLOSED = ['cancelado', 'expirado'];

export function canCancelPedido(pedido: Pedido): boolean {
  return !CLOSED.includes(pedido.estado) && pedido.receivedAmount === 0 && pedido.deliveryState === 'pendiente';
}

export function canRetryPedido(pedido: Pedido): boolean {
  return !CLOSED.includes(pedido.estado) && pedido.missingAmount === 0 && ['pendiente', 'parcial'].includes(pedido.deliveryState);
}

async function copyOrderId(id: string) {
  try { await navigator.clipboard.writeText(id); toast.success('Número de pedido copiado'); }
  catch { toast.error('No se pudo copiar. Selecciona el número de pedido y cópialo a mano.'); }
}

/** Acciones del pedido: eliminar lo archiva sin borrar ventas, pagos ni servicios asignados. */
export function PedidoRowActions({ pedido, client = null, onReview }: { pedido: Pedido; client?: PedidoClient | null; onReview: () => void }) {
  const { retry, cancel, remove } = usePedidoActions();
  const [confirming, setConfirming] = useState<'cancel' | 'delete' | null>(null);
  const busy = retry.isPending || cancel.isPending || remove.isPending;
  const error = retry.error ?? cancel.error ?? remove.error;
  const deleting = confirming === 'delete';
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Acciones del pedido" disabled={busy}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onReview}><Eye />Revisar pedido</DropdownMenuItem>
        {pedido.contactId ? <DropdownMenuItem asChild><Link prefetch={false} href={`/chats?wa=${encodeURIComponent(pedido.contactId)}`}><MessageSquare />Abrir chat{client?.name ? ` con ${client.name.split(' ')[0]}` : ''}</Link></DropdownMenuItem> : null}
        {pedido.terceroId ? <DropdownMenuItem asChild><Link prefetch={false} href={`/terceros/${encodeURIComponent(pedido.terceroId)}`}><UserRound />Ver cliente</Link></DropdownMenuItem> : null}
        <DropdownMenuItem onClick={() => void copyOrderId(pedido.id)}><Copy />Copiar número de pedido</DropdownMenuItem>
        {canRetryPedido(pedido) ? <DropdownMenuItem onClick={() => retry.mutate(pedido.id)}><RotateCw />Reintentar asignación</DropdownMenuItem> : null}
        {canCancelPedido(pedido) || canDeletePedido(pedido) ? <DropdownMenuSeparator /> : null}
        {canCancelPedido(pedido) ? <DropdownMenuItem variant="destructive" onClick={() => setConfirming('cancel')}><XCircle />Cancelar pedido</DropdownMenuItem> : null}
        {canDeletePedido(pedido) ? <DropdownMenuItem variant="destructive" onClick={() => setConfirming('delete')}><Trash2 />Eliminar pedido</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={confirming !== null} onOpenChange={open => { if (!open) setConfirming(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{deleting ? 'Eliminar pedido' : 'Cancelar pedido'}</AlertDialogTitle>
          <AlertDialogDescription>{deleting ? 'El pedido sale de la lista y libera sus reservas pendientes. Las ventas, servicios asignados y pagos existentes se conservan en su historial. Después podrás eliminar al cliente si no tiene otros pedidos pendientes.' : 'Se liberará la reserva de los servicios y el pedido quedará cancelado en el historial. Esta acción no se puede deshacer.'}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(error, 'No se pudo completar la acción. Revisa el pedido y reintenta.')}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); (deleting ? remove : cancel).mutate(pedido.id, { onSuccess: () => setConfirming(null) }); }}>{deleting ? 'Eliminar pedido' : 'Cancelar pedido'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
