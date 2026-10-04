'use client';

import { useState } from 'react';
import { usePedidoActions } from '@/hooks/use-pedidos';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function PedidoExcessResolution({ id, amount, currency }: { id: string; amount: number; currency: string }) {
  const { excess } = usePedidoActions();
  const [action, setAction] = useState<'credito' | 'reembolsado'>('credito');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [resolved, setResolved] = useState(false);
  const validReference = /^[A-Za-z0-9 ._:/-]{4,100}$/.test(reference.trim());
  return <form className="space-y-3 border-t pt-3" onSubmit={event => {
    event.preventDefault();
    if (!confirmed || !validReference) return;
    excess.mutate({ id, action, reference: reference.trim(), amount }, { onSuccess: () => { setResolved(true); setConfirmed(false); } });
  }}>
    <p className="text-sm font-medium">Resolver exceso: <span className="text-success">{currency === 'USD' ? '$' : `${currency} `}</span>{amount.toFixed(2)}</p>
    <div className="flex flex-wrap gap-3 text-sm"><label className="flex items-center gap-2"><input type="radio" name={`excess-${id}`} checked={action === 'credito'} onChange={() => { setAction('credito'); setConfirmed(false); }} />Crédito al cliente</label><label className="flex items-center gap-2"><input type="radio" name={`excess-${id}`} checked={action === 'reembolsado'} onChange={() => { setAction('reembolsado'); setConfirmed(false); }} />Devolución comprobada</label></div>
    <p className="text-sm text-muted-foreground">{action === 'credito' ? 'Registra el saldo a favor del cliente separado del ingreso de la venta.' : 'Registra una devolución realizada fuera de esta pantalla. Este registro no transfiere dinero ni solicita una devolución a Yappy.'}</p>
    <Label htmlFor={`excess-reference-${id}`}>{action === 'credito' ? 'Referencia del crédito' : 'Referencia de la transferencia'}</Label>
    <Input id={`excess-reference-${id}`} value={reference} onChange={event => { setReference(event.target.value); setConfirmed(false); }} minLength={4} maxLength={100} required pattern="[A-Za-z0-9 ._:/\-]+" />
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} />{action === 'credito' ? 'Confirmo registrar el importe completo como crédito del cliente.' : 'Verifiqué la transferencia por el importe completo y su referencia.'}</label>
    <Button type="submit" disabled={!confirmed || !validReference || excess.isPending || resolved}>{action === 'credito' ? 'Registrar crédito' : 'Registrar devolución'}</Button>
    {excess.error ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(excess.error, 'No se pudo registrar la resolución. Revisa el saldo actualizado del pedido.')}</p> : null}
    {resolved ? <p role="status" className="text-sm text-success">Resolución registrada. El saldo pendiente del pedido se actualizó.</p> : null}
  </form>;
}
