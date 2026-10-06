import type { Tone } from '@/components/shared/tone';
import type { Pedido } from '@/modules/orders/contracts';

export type PedidoFilter = 'all' | 'review' | 'payment' | 'delivery' | 'complete' | 'closed';

export const PEDIDO_FILTERS: readonly { value: PedidoFilter; label: string }[] = [
  { value: 'all', label: 'Todos' }, { value: 'review', label: 'Por revisar' }, { value: 'payment', label: 'Cobro pendiente' },
  { value: 'delivery', label: 'Entrega pendiente' }, { value: 'complete', label: 'Completados' }, { value: 'closed', label: 'Cancelados y vencidos' },
];

/** Un pedido cancelado o vencido ya no tiene reserva: sale de las colas de trabajo. */
export const isClosedPedido = (pedido: Pedido): boolean => ['cancelado', 'expirado'].includes(pedido.estado);

/** Necesita una persona: dinero de más, un pago candidato del correo de Yappy o una revisión marcada por el servidor. */
export const needsReview = (pedido: Pedido): boolean =>
  !isClosedPedido(pedido) && (pedido.excessAmount > 0 || Boolean(pedido.reviewCandidate) || pedido.estado === 'pago_en_revision');

export function matchesPedidoFilter(pedido: Pedido, filter: string): boolean {
  switch (filter) {
    case 'review': return needsReview(pedido);
    case 'payment': return !isClosedPedido(pedido) && pedido.missingAmount > 0;
    case 'delivery': return !isClosedPedido(pedido) && pedido.deliveryState !== 'enviado';
    case 'complete': return pedido.deliveryState === 'enviado';
    case 'closed': return isClosedPedido(pedido);
    default: return true;
  }
}

/** Etapa del pedido en su ciclo de vida (independiente del cobro y de la entrega). */
export function pedidoStage(pedido: Pedido): { label: string; tone: Tone } {
  switch (pedido.estado) {
    case 'cancelado': return { label: 'Cancelado', tone: 'neutral' };
    case 'expirado': return { label: 'Vencido', tone: 'neutral' };
    case 'esperando_pago': return { label: 'Reservado', tone: 'info' };
    case 'pago_en_revision': return { label: 'En revisión', tone: 'warning' };
    case 'pagado': return { label: 'Pagado', tone: 'success' };
    case 'entregado': return { label: 'Entregado', tone: 'success' };
    case 'borrador': return { label: 'Borrador', tone: 'neutral' };
    default: return { label: 'En curso', tone: 'neutral' };
  }
}

/** "Vence 5 oct, 10:42 p. m." mientras la reserva sigue abierta y sin cobrar; vacío si no aplica o la fecha no es válida. */
export function reservationHint(pedido: Pedido): string {
  if (!['esperando_pago', 'borrador'].includes(pedido.estado)) return '';
  const date = new Date(pedido.expiraAt);
  if (Number.isNaN(date.getTime())) return '';
  const when = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  return `${date.getTime() < Date.now() ? 'Venció' : 'Vence'} ${when}`;
}

export interface PedidoClient { name: string; phone: string | null }

/** Nombre del cliente (del tercero vinculado) y teléfono; `null` si el pedido no trae ninguno (pedido del panel sin datos). */
export function pedidoClient(pedido: Pedido, names: ReadonlyMap<string, string>): PedidoClient | null {
  const name = pedido.terceroId ? names.get(pedido.terceroId) : undefined;
  const phone = pedido.contactId ?? null;
  if (!name && !phone) return null;
  return { name: name ?? `+${phone}`, phone: name ? phone : null };
}

/** Texto en el que busca el buscador: servicios, cliente, teléfono, etapa y número de pedido. */
export function pedidoSearchText(pedido: Pedido, client: PedidoClient | null): string {
  return [pedido.id, ...pedido.items.map(item => item.planNombre), client?.name, client?.phone, pedido.contactId, pedidoStage(pedido).label].filter(Boolean).join(' ').toLowerCase();
}

/** Eliminar del panel archiva el pedido y conserva sus ventas y pagos. */
export const canDeletePedido = (pedido: Pedido): boolean =>
  Boolean(pedido.id);

/** Se puede anotar un pago manual mientras el pedido siga abierto y falte dinero. */
export const canRegisterPayment = (pedido: Pedido): boolean => !isClosedPedido(pedido) && pedido.missingAmount > 0;

/** Cobro cubierto y servicios asignados, pero el acceso aún no figura como enviado. */
export const canMarkDelivered = (pedido: Pedido): boolean =>
  !isClosedPedido(pedido) && pedido.deliveryState === 'asignado' && ['cubierto', 'exceso'].includes(pedido.paymentState)
  && !pedido.items.some(item => item.estado === 'pendiente');
