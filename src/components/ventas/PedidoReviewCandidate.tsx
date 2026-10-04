import { Button } from '@/components/ui/button';
import type { Pedido } from '@/modules/orders/contracts';

type Candidate = NonNullable<Pedido['reviewCandidate']>;

/** Pago del correo de Yappy que el servidor ya cruzó con el pedido por revisar; una persona lo confirma con un clic. */
export function PedidoReviewCandidate({ candidate, currency, busy, onConfirm }: {
  candidate: Candidate; currency: string; busy: boolean; onConfirm: (code: string) => void;
}) {
  const paidAt = new Date(candidate.paidAt);
  return <div className="space-y-2 border-t pt-3">
    <p className="text-sm font-medium">Pago candidato del correo de Yappy</p>
    <p className="text-sm text-muted-foreground">
      <span className="whitespace-nowrap font-medium tabular-nums"><span className="text-success">{currency === 'USD' ? '$' : `${currency} `}</span>{candidate.amount.toFixed(2)}</span>
      {Number.isNaN(paidAt.getTime()) ? '' : ` · ${new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium', timeStyle: 'short' }).format(paidAt)}`}
      {candidate.reason ? ` · ${candidate.reason}` : ''}
    </p>
    <Button disabled={busy} onClick={() => onConfirm(candidate.code)}>Confirmar con este pago</Button>
  </div>;
}
