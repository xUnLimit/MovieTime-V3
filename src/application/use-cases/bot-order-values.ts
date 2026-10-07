import type { Pedido } from '@/modules/orders/contracts';
import { formatMonto } from '@/platform/utils/whatsapp-template-render';
import { formatDeadline } from './commerce-conversation-copy';

const PAYMENT_LABEL: Record<Pedido['paymentState'], string> = {
  pendiente: 'pendiente de pago', parcial: 'con pago parcial', cubierto: 'pagado', exceso: 'pagado',
  reembolsado: 'reembolsado', parcialmente_reembolsado: 'parcialmente reembolsado',
};
const money = (currency: string, amount: number) => formatMonto(amount, currency);

/**
 * Los unicos datos del pedido que un texto del recorrido puede mostrar (lista blanca de `bot-config`): montos, estado
 * del pago, cantidad de servicios y vencimiento de la reserva. Nunca ids, nombres, correos, telefonos ni credenciales.
 */
export function orderTemplateValues(order: Pedido): Record<string, string> {
  return {
    pedido_total: money(order.moneda, order.total),
    pedido_estado: PAYMENT_LABEL[order.paymentState],
    pedido_pendiente: money(order.moneda, order.missingAmount),
    pedido_servicios: String(order.items.length),
    pedido_vence: formatDeadline(order.expiraAt),
  };
}
