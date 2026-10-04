'use client';

import { useState } from 'react';
import type { Pedido } from '@/modules/orders/contracts';
import { usePedidoResolution } from '@/hooks/use-pedido-resolution';
import { usePedidoExpiration } from '@/hooks/use-pedido-expiration';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PedidoAllocationResolution({ pedido }: { pedido: Pedido }) {
  const [task, setTask] = useState<'price' | 'assign' | 'refund' | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState('');
  const actions = usePedidoResolution(pedido.id, task === 'price');
  const unallocatedAmount = pedido.unallocatedAmount ?? 0;
  const pendingItems = pedido.items.filter(item => item.estado === 'pendiente');
  const selectedAmount = pendingItems.filter(item => selected.includes(item.id)).reduce((sum, item) => sum + item.total, 0);
  const amount = Number(selectedAmount.toFixed(2));
  const busy = actions.accept.isPending || actions.assign.isPending || actions.refund.isPending;
  const error = actions.accept.error || actions.assign.error || actions.refund.error;
  const cancelled = pedido.estado === 'cancelado';
  const expired = usePedidoExpiration(pedido.expiraAt);
  const validReference = /^[A-Za-z0-9 ._:/-]{4,100}$/.test(reference.trim());
  const open = (next: typeof task) => { setTask(next); setConfirmed(false); setResult(''); };
  return <div className="space-y-3 border-t pt-3">
    <p className="text-sm text-muted-foreground">Importe asignado: {pedido.moneda} {(pedido.allocatedAmount ?? 0).toFixed(2)} · Devuelto: {pedido.moneda} {(pedido.refundedAmount ?? 0).toFixed(2)} · Cobro sin asignar: {pedido.moneda} {unallocatedAmount.toFixed(2)}</p>
    <div className="flex flex-wrap gap-2">{!cancelled && expired && pendingItems.length ? <Button variant="outline" disabled={busy} onClick={() => open('price')}>Revisar precio vigente</Button> : null}{!cancelled && !expired && pendingItems.length > 1 && pedido.missingAmount === 0 && unallocatedAmount > 0 ? <Button variant="outline" disabled={busy} onClick={() => open('assign')}>Asignar servicios elegidos</Button> : null}{unallocatedAmount > 0 ? <Button variant="outline" disabled={busy} onClick={() => open('refund')}>Registrar devolución sin asignar</Button> : null}</div>
    {task === 'price' ? <section className="space-y-3" aria-label="Revisión de precio">
      <p className="text-sm">La reserva anterior venció. Comprueba el precio y acuerda el nuevo total con el cliente antes de continuar.</p>
      {actions.quote.isLoading ? <p role="status" className="text-sm text-muted-foreground">Consultando precios vigentes…</p> : actions.quote.isError ? <div role="alert"><p className="text-sm text-danger">No se pudo consultar el precio.</p><Button variant="outline" onClick={() => void actions.quote.refetch()}>Reintentar consulta</Button></div> : actions.quote.data ? <>
        <ul className="space-y-1 text-sm">{actions.quote.data.items.map(item => <li key={item.id}>{pedido.items.find(part => part.id === item.id)?.planNombre ?? 'Servicio'}: {pedido.moneda} {item.oldTotal.toFixed(2)} → {pedido.moneda} {item.newTotal.toFixed(2)}</li>)}</ul>
        <p className="text-sm font-medium">Nuevo total: {pedido.moneda} {actions.quote.data.total.toFixed(2)} · Diferencia: {pedido.moneda} {actions.quote.data.difference.toFixed(2)}</p>
        <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} />El cliente aceptó el nuevo total y comprende la diferencia pendiente.</label>
        <Button disabled={!confirmed || busy} onClick={() => { if (actions.quote.data) actions.accept.mutate(actions.quote.data.total, { onSuccess: () => { open(null); setResult('Precio acordado registrado. Revisa el cobro restante y la asignación del pedido.'); } }); }}>Aceptar total acordado</Button>
      </> : null}
    </section> : null}
    {task === 'assign' ? <section className="space-y-3" aria-label="Asignación parcial">
      <p className="text-sm">Selecciona los servicios acordados. Se asignarán juntos y el saldo restante conservará su revisión pendiente.</p>
      <ul className="space-y-2">{pendingItems.map(item => <li key={item.id}><label className="flex items-center gap-2 text-sm"><Checkbox checked={selected.includes(item.id)} onCheckedChange={value => { setSelected(current => value === true ? [...current, item.id] : current.filter(id => id !== item.id)); setConfirmed(false); }} />{item.planNombre} · {pedido.moneda} {item.total.toFixed(2)}</label></li>)}</ul>
      <p className="text-sm font-medium">Asignación elegida: {pedido.moneda} {amount.toFixed(2)}</p>
      {amount > unallocatedAmount ? <p role="alert" className="text-sm text-warning">El saldo sin asignar no cubre estos servicios.</p> : null}
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} />El cliente acepta recibir estos servicios y dejar el resto pendiente.</label>
      <Button disabled={!confirmed || amount <= 0 || amount > unallocatedAmount || selected.length === pendingItems.length || busy} onClick={() => actions.assign.mutate({ itemIds: selected, amount }, { onSuccess: () => { setSelected([]); open(null); setResult('Servicios elegidos asignados. El cobro y los servicios restantes se conservan.'); } })}>Confirmar asignación parcial</Button>
    </section> : null}
    {task === 'refund' ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (confirmed && validReference) actions.refund.mutate({ reference: reference.trim(), amount: unallocatedAmount }, { onSuccess: () => { setReference(''); open(null); setResult('Devolución registrada. El saldo sin asignar se actualizó sin modificar las ventas vigentes.'); } }); }}>
      <p className="text-sm">Registra la devolución externa comprobada de {pedido.moneda} {unallocatedAmount.toFixed(2)} y cancela los servicios todavía pendientes. Esta acción no transfiere dinero ni devuelve importes de servicios ya asignados.</p>
      <Label htmlFor={`refund-${pedido.id}`}>Referencia de la devolución</Label><Input id={`refund-${pedido.id}`} value={reference} onChange={event => { setReference(event.target.value); setConfirmed(false); }} minLength={4} maxLength={100} required />
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} />Verifiqué el importe completo y el comprobante de la devolución al cliente.</label>
      <Button disabled={!confirmed || !validReference || busy} type="submit">Confirmar devolución registrada</Button>
    </form> : null}
    {task ? <Button variant="ghost" disabled={busy} onClick={() => open(null)}>Volver a revisión del pedido</Button> : null}
    {error ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(error, 'No se pudo completar la revisión. Actualiza el pedido antes de reintentar.')}</p> : null}
    {result ? <p role="status" className="text-sm text-success">{result}</p> : null}
  </div>;
}
