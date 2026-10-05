'use client';

import { useState } from 'react';
import { Eye, MoreHorizontal, RotateCw, XCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePedidoActions } from '@/hooks/use-pedidos';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { Pedido } from '@/modules/orders/contracts';

const CLOSED = ['cancelado', 'expirado'];

export function canCancelPedido(pedido: Pedido): boolean {
  return !CLOSED.includes(pedido.estado) && pedido.receivedAmount === 0 && pedido.deliveryState === 'pendiente';
}

export function canRetryPedido(pedido: Pedido): boolean {
  return !CLOSED.includes(pedido.estado) && pedido.missingAmount === 0 && ['pendiente', 'parcial'].includes(pedido.deliveryState);
}

/** Acciones por fila de Pedidos: revisar, reintentar la asignación y cancelar (libera la reserva y conserva el historial). */
export function PedidoRowActions({ pedido, onReview }: { pedido: Pedido; onReview: () => void }) {
  const { retry, cancel } = usePedidoActions();
  const [confirming, setConfirming] = useState(false);
  const busy = retry.isPending || cancel.isPending;
  const error = retry.error ?? cancel.error;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Acciones del pedido" disabled={busy}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onReview}><Eye />Revisar pedido</DropdownMenuItem>
        {canRetryPedido(pedido) ? <DropdownMenuItem onClick={() => retry.mutate(pedido.id)}><RotateCw />Reintentar asignación</DropdownMenuItem> : null}
        {canCancelPedido(pedido) ? <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}><XCircle />Cancelar pedido</DropdownMenuItem></> : null}
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar pedido</AlertDialogTitle>
          <AlertDialogDescription>Se liberará la reserva de los servicios y el pedido quedará cancelado en el historial. Esta acción no se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(error, 'No se pudo completar la acción. Revisa el pedido y reintenta.')}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); cancel.mutate(pedido.id, { onSuccess: () => setConfirming(false) }); }}>Cancelar pedido</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
