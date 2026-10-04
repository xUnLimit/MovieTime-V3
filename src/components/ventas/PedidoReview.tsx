'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePedidoActions } from '@/hooks/use-pedidos';
import { usePedidoExpiration } from '@/hooks/use-pedido-expiration';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { Pedido } from '@/modules/orders/contracts';
import { PedidoExcessResolution } from './PedidoExcessResolution';
import { PedidoAllocationResolution } from './PedidoAllocationResolution';
import { PedidoReviewCandidate } from './PedidoReviewCandidate';

const paymentLabels = { pendiente: 'Pendiente', parcial: 'Pago incompleto', cubierto: 'Confirmado', exceso: 'Exceso por resolver', reembolsado: 'Devuelto', parcialmente_reembolsado: 'Devolución parcial' };
const deliveryLabels = { pendiente: 'Sin asignar', parcial: 'Asignación parcial', asignado: 'Asignado', enviado: 'Acceso enviado' };
export function PedidoAmount({ value, currency }: { value: number; currency: string }) {
  return <span className="whitespace-nowrap font-medium tabular-nums"><span className="text-success">{currency === 'USD' ? '$' : `${currency} `}</span>{value.toFixed(2)}</span>;
}

export function PedidoReview({ pedido }: { pedido: Pedido }) {
  const actions = usePedidoActions();
  const [reference, setReference] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [result, setResult] = useState('');
  const busy = actions.retry.isPending || actions.cancel.isPending || actions.reconcile.isPending || actions.delivery.isPending;
  const error = actions.retry.error || actions.cancel.error || actions.reconcile.error || actions.delivery.error;
  const cancelled = ['cancelado', 'expirado'].includes(pedido.estado);
  const expired = usePedidoExpiration(pedido.expiraAt) && pedido.items.some(item => item.estado === 'pendiente');
  const received = pedido.receivedAmount > 0;
  return <div className="space-y-4">
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Pedido</dt><dd className="font-medium">{pedido.id.slice(0, 8)}</dd></div><div><dt className="text-xs text-muted-foreground">Total confirmado</dt><dd><PedidoAmount value={pedido.total} currency={pedido.moneda} /></dd></div><div><dt className="mb-1 text-xs text-muted-foreground">Cobro</dt><dd><StatusBadge tone={pedido.paymentState === 'cubierto' ? 'success' : 'warning'}>{paymentLabels[pedido.paymentState]}</StatusBadge></dd></div><div><dt className="mb-1 text-xs text-muted-foreground">Asignación y entrega</dt><dd><StatusBadge tone={pedido.deliveryState === 'enviado' ? 'success' : 'info'}>{deliveryLabels[pedido.deliveryState]}</StatusBadge></dd></div></dl>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><span>Recibido: <PedidoAmount value={pedido.receivedAmount} currency={pedido.moneda} /></span>{pedido.missingAmount > 0 ? <span>Faltante: <PedidoAmount value={pedido.missingAmount} currency={pedido.moneda} /></span> : null}{pedido.excessAmount > 0 ? <span>Exceso por resolver: <PedidoAmount value={pedido.excessAmount} currency={pedido.moneda} /></span> : null}</div>
    {pedido.excessAmount > 0 ? <PedidoExcessResolution id={pedido.id} amount={pedido.excessAmount} currency={pedido.moneda} /> : null}
    <ul className="divide-y border-y">{pedido.items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-medium">{item.planNombre}</p><p className="text-xs text-muted-foreground">{item.tipo === 'renovacion' ? 'Renovación' : 'Compra'} · {item.estado === 'aplicado' ? 'Asignación completada' : 'Asignación pendiente'}</p></div><div className="flex items-center gap-3"><PedidoAmount value={item.total} currency={pedido.moneda} />{item.ventaIdResultante || item.ventaId ? <Button variant="ghost" size="sm" asChild><Link href={`/ventas/${item.ventaIdResultante ?? item.ventaId}`}>Ver venta</Link></Button> : null}</div></li>)}</ul>
    <p className="text-sm text-muted-foreground">{cancelled ? 'El pedido ya no tiene una reserva vigente. Un pago posterior requiere revisión.' : expired ? 'La reserva venció. Revisa el precio vigente y registra el total acordado antes de asignar los servicios pendientes.' : pedido.missingAmount > 0 ? 'Confirma el ingreso restante antes de asignar y enviar el acceso.' : pedido.deliveryState === 'pendiente' ? 'El cobro está cubierto. Reintenta la asignación completa; si falta stock, el pago se conserva.' : pedido.deliveryState === 'parcial' ? 'Algunos servicios están asignados. Completa la asignación pendiente o registra la devolución del saldo sin asignar; el envío de cada acceso se controla por separado.' : pedido.deliveryState === 'asignado' ? 'Las ventas están asignadas. El envío del acceso se procesa por separado; un fallo no repite el cobro.' : 'La operación y el envío del acceso están completos.'}</p>
    {!cancelled && pedido.missingAmount > 0 && pedido.reviewCandidate ? <PedidoReviewCandidate candidate={pedido.reviewCandidate} currency={pedido.moneda} busy={busy} onConfirm={code => actions.reconcile.mutate({ id: pedido.id, code }, { onSuccess: () => setResult('Ingreso conciliado. Los importes y el estado del pedido se actualizaron.') })} /> : null}
    {!cancelled && pedido.missingAmount > 0 ? <form className="space-y-2" onSubmit={event => { event.preventDefault(); actions.reconcile.mutate({ id: pedido.id, code: reference.trim() }, { onSuccess: () => { setReference(''); setResult('Ingreso conciliado. Los importes y el estado del pedido se actualizaron.'); } }); }}><Label htmlFor={`reference-${pedido.id}`}>Referencia del comprobante Yappy</Label><Input id={`reference-${pedido.id}`} value={reference} onChange={event => setReference(event.target.value)} minLength={4} maxLength={64} pattern="[A-Za-z0-9-]+" required placeholder="Código de confirmación" /><p className="text-xs text-muted-foreground">Se compara con el ingreso detectado por el canal confiable. El teléfono del pagador puede ser diferente.</p><Button type="submit" disabled={reference.trim().length < 4 || busy}>Verificar y aplicar ingreso</Button></form> : null}
    {!cancelled && !expired && ['pendiente', 'parcial'].includes(pedido.deliveryState) && pedido.missingAmount === 0 ? <Button disabled={busy} onClick={() => actions.retry.mutate(pedido.id, { onSuccess: () => setResult('Asignación revisada. El pedido conserva su cobro y muestra el resultado actualizado.') })}>Reintentar asignación</Button> : null}
    {!cancelled && ['asignado', 'parcial'].includes(pedido.deliveryState) ? <Button disabled={busy} onClick={() => actions.delivery.mutate(pedido.id, { onSuccess: result => setResult(`Revisión de envío finalizada: ${result.processed} solicitudes procesadas, ${result.failed} fallos. Si un envío es incierto, revísalo desde Chats antes de reenviar.`) })}>Reintentar envío de acceso</Button> : null}
    {!cancelled && !received ? <Button variant="outline" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancelar pedido</Button> : null}
    {confirmCancel ? <div className="space-y-2 border-t pt-3"><p className="text-sm">Cancelar libera la reserva y conserva el historial del pedido.</p><div className="flex gap-2"><Button variant="outline" onClick={() => setConfirmCancel(false)}>Volver</Button><Button variant="destructive" disabled={busy} onClick={() => actions.cancel.mutate(pedido.id, { onSuccess: () => { setConfirmCancel(false); setResult('Pedido cancelado. La reserva se liberó.'); } })}>Confirmar cancelación</Button></div></div> : null}
    {error ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(error, 'No se pudo completar la acción. Revisa el pedido y reintenta.')}</p> : null}
    {result ? <p role="status" className="text-sm text-success">{result}</p> : null}
    <PedidoAllocationResolution pedido={pedido} />
  </div>;
}
