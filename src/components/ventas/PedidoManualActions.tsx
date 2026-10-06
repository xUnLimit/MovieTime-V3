'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePedidoActions } from '@/hooks/use-pedidos';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { Pedido } from '@/modules/orders/contracts';
import { PedidoAmount } from './PedidoAmount';
import { canDeletePedido, canMarkDelivered, canRegisterPayment } from './pedido-status';

const REFERENCE = /^[A-Za-z0-9 ._:/-]{3,100}$/;

/**
 * Acciones manuales del administrador sobre un pedido: registrar un pago que llegó por fuera del bot (efectivo,
 * transferencia), marcar el acceso como entregado y eliminar. El servidor revalida cada una; aquí solo se ofrecen
 * cuando el estado del pedido las permite y todas piden confirmar antes de enviarse.
 */
export function PedidoManualActions({ pedido }: { pedido: Pedido }) {
  const actions = usePedidoActions();
  // null = el faltante vigente del pedido; se actualiza solo cuando cambia el cobro.
  const [typedAmount, setAmount] = useState<string | null>(null);
  const amount = typedAmount ?? pedido.missingAmount.toFixed(2);
  const [reference, setReference] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [confirming, setConfirming] = useState<'delivered' | 'delete' | null>(null);
  const [result, setResult] = useState('');
  const busy = actions.payment.isPending || actions.delivered.isPending || actions.remove.isPending;
  const error = actions.payment.error || actions.delivered.error || actions.remove.error;
  const value = Number(amount);
  const validAmount = Number.isFinite(value) && value > 0 && value < 1_000_000 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
  const validReference = REFERENCE.test(reference.trim());
  const pay = canRegisterPayment(pedido);
  const deliver = canMarkDelivered(pedido);
  const remove = canDeletePedido(pedido);
  if (!pay && !deliver && !remove) return null;
  return <section aria-label="Acciones manuales" className="space-y-3 border-t pt-3">
    <h3 className="text-sm font-semibold">Acciones manuales</h3>
    {pay ? <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      if (!paymentConfirmed || !validAmount || !validReference) return;
      actions.payment.mutate({ id: pedido.id, amount: Number(value.toFixed(2)), reference: reference.trim() }, {
        onSuccess: () => { setReference(''); setAmount(null); setPaymentConfirmed(false); setResult('Pago registrado. El cobro y la asignación del pedido se actualizaron.'); },
      });
    }}>
      <p className="text-sm">Registrar un pago recibido fuera del bot. Faltan <PedidoAmount value={pedido.missingAmount} currency={pedido.moneda} />; el servidor recalcula el cobro y, si queda cubierto, asigna los servicios.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor={`manual-amount-${pedido.id}`}>Monto recibido ({pedido.moneda})</Label>
          <Input id={`manual-amount-${pedido.id}`} inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setPaymentConfirmed(false); }} /></div>
        <div className="space-y-1"><Label htmlFor={`manual-reference-${pedido.id}`}>Referencia o medio de pago</Label>
          <Input id={`manual-reference-${pedido.id}`} value={reference} maxLength={100} placeholder="Ej.: Efectivo 5-oct, Transferencia 12345" onChange={event => { setReference(event.target.value); setPaymentConfirmed(false); }} /></div>
      </div>
      {amount !== '' && !validAmount ? <p role="alert" className="text-xs text-danger">Escribe un monto mayor que cero con hasta dos decimales.</p> : null}
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={paymentConfirmed} onCheckedChange={checked => setPaymentConfirmed(checked === true)} />Confirmo que recibí este dinero.</label>
      <Button type="submit" disabled={!paymentConfirmed || !validAmount || !validReference || busy}>Registrar pago</Button>
    </form> : null}
    {deliver ? <div className="space-y-2">
      <p className="text-sm">El pedido está cobrado y asignado. Si ya entregaste el acceso por tu cuenta, márcalo como entregado; el envío automático pendiente se cancela.</p>
      {confirming === 'delivered'
        ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setConfirming(null)}>Volver</Button>
          <Button disabled={busy} onClick={() => actions.delivered.mutate(pedido.id, { onSuccess: () => { setConfirming(null); setResult('Pedido marcado como entregado.'); } })}>Confirmar entrega</Button></div>
        : <Button variant="outline" disabled={busy} onClick={() => setConfirming('delivered')}>Marcar acceso como entregado</Button>}
    </div> : null}
    {remove ? <div className="space-y-2">
      {confirming === 'delete'
        ? <><p className="text-sm">Eliminar quita el pedido de la lista y libera su reserva. Esta acción no se puede deshacer desde aquí.</p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setConfirming(null)}>Volver</Button>
            <Button variant="destructive" disabled={busy} onClick={() => actions.remove.mutate(pedido.id, { onSuccess: () => { setConfirming(null); setResult('Pedido eliminado.'); } })}>Confirmar eliminación</Button></div></>
        : <Button variant="outline" disabled={busy} onClick={() => setConfirming('delete')}><Trash2 />Eliminar pedido</Button>}
    </div> : null}
    {error ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(error, 'No se pudo completar la acción. Revisa el pedido y reintenta.')}</p> : null}
    {result ? <p role="status" className="text-sm text-success">{result}</p> : null}
  </section>;
}
