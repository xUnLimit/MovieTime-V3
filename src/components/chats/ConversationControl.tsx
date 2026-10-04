'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConversationControl } from '@/hooks/use-conversation-control';
import { usePedidos } from '@/hooks/use-pedidos';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { PedidoReview } from '@/components/ventas/PedidoReview';

const processes: Record<string, string> = { purchase: 'Compra', renewal: 'Renovación', access: 'Solicitud de acceso', payment: 'Pago en revisión', catalogue: 'Consulta de catálogo' };
const reasons: Record<string, string> = { delivery_uncertain: 'No se pudo comprobar si llegó la última respuesta. Revisa el envío y responde manualmente antes de continuar.', retry_exhausted: 'Se agotaron los reintentos. Revisa el caso y completa la respuesta manualmente.', payment_review: 'El pago necesita revisión.', customer_request: 'El cliente pidió atención humana.', handoff: 'El cliente pidió atención humana.' };

function OrderContext({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const query = usePedidos(open);
  const pedido = query.data?.find(item => item.id === id);
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Revisar pedido y pago</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Pedido de esta conversación</DialogTitle><DialogDescription>Resuelve el cobro sin salir del chat. El borrador y la selección se conservan.</DialogDescription></DialogHeader>{query.isLoading ? <Skeleton className="h-64 w-full" /> : query.isError ? <div role="alert"><p className="text-sm text-danger">No se pudo cargar el pedido.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : pedido ? <PedidoReview pedido={pedido} /> : <p className="text-sm text-muted-foreground">No se encontró el pedido relacionado. Revisa la conversación antes de registrar un cobro.</p>}</DialogContent></Dialog></>;
}

export function ConversationControl({ waId }: { waId: string }) {
  const { query, change, resolve } = useConversationControl(waId);
  const [release, setRelease] = useState(false);
  const [review, setReview] = useState(false);
  const control = query.data;
  if (query.isLoading) return <div aria-busy="true" className="border-b px-4 py-2"><Skeleton className="h-8 w-full" /><span className="sr-only">Cargando atención</span></div>;
  if (query.isError) return <div role="alert" className="flex flex-wrap items-center gap-2 border-b px-4 py-2"><p className="text-xs text-danger">No se pudo comprobar quién atiende.</p><Button size="sm" variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div>;
  if (!control) return null;
  return <div className="shrink-0 space-y-2 border-b bg-chat-raised px-4 py-2">
    <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={control.mode === 'human' ? 'warning' : 'success'}>{control.mode === 'human' ? 'Atención humana' : 'Atención automática'}</StatusBadge>{control.activeProcess ? <span className="text-xs text-muted-foreground">{processes[control.activeProcess] ?? 'Proceso en curso'}</span> : null}<div className="ml-auto flex flex-wrap gap-2">{control.orderId ? <OrderContext id={control.orderId} /> : null}<Button size="sm" variant="outline" disabled={change.isPending} onClick={() => { if (control.mode === 'human') setRelease(true); else change.mutate({ mode: 'human', version: control.version }); }}>{change.isPending ? 'Actualizando…' : control.mode === 'human' ? 'Devolver a atención automática' : 'Tomar atención'}</Button></div></div>
    {control.handoffReason ? <p className="text-xs text-muted-foreground">Motivo: {reasons[control.handoffReason] ?? 'requiere revisión del operador. El contexto del proceso se conserva.'}</p> : null}
    {['delivery_uncertain', 'retry_exhausted'].includes(control.handoffReason ?? '') ? <div className="space-y-2">{review ? <><p className="text-sm">Confirma que revisaste el envío y atendiste el caso manualmente. La conversación seguirá bajo atención humana.</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setReview(false)}>Seguir revisando</Button><Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate(control.version, { onSuccess: () => setReview(false) })}>Confirmar caso atendido</Button></div></> : <Button size="sm" variant="outline" onClick={() => setReview(true)}>Marcar caso atendido</Button>}{resolve.isError ? <p role="alert" className="text-xs text-danger">{getPublicErrorMessage(resolve.error, 'No se pudo resolver la revisión. Comprueba el estado y reintenta.')}</p> : null}</div> : null}
    {release ? <div className="space-y-2"><p className="text-sm">El sistema comprobará si el proceso puede continuar antes de responder automáticamente.</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setRelease(false)}>Seguir atendiendo</Button><Button size="sm" disabled={change.isPending} onClick={() => change.mutate({ mode: 'bot', version: control.version }, { onSuccess: () => setRelease(false) })}>Devolver conversación</Button></div></div> : null}
    {change.isError ? <p role="alert" className="text-xs text-danger">{getPublicErrorMessage(change.error, 'No se pudo cambiar la atención. El proceso pudo cambiar; revisa su estado y reintenta.')}</p> : null}
  </div>;
}
