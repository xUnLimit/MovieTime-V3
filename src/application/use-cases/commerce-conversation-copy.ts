import type { Pedido } from '@/modules/orders/contracts';
import type { createCopy } from '@/modules/commerce-copy/render';
import type { CommerceItem } from './commerce-conversation-state';

// Datos que se insertan en los textos del flujo de compras (los textos viven en @/modules/commerce-copy).
export type Copy = ReturnType<typeof createCopy>;
const PANAMA = 'America/Panama';
const money = (currency: string, amount: number) => `${currency} ${amount.toFixed(2)}`;
const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: PANAMA }).format(date);

/** "hoy a las 10:42 p. m." o "el 4 de octubre a las 10:42 p. m."; vacio si la fecha no es valida. */
export function formatDeadline(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = new Intl.DateTimeFormat('es-PA', { timeZone: PANAMA, hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  if (dayKey(date) === dayKey(now)) return `hoy a las ${time}`;
  const day = new Intl.DateTimeFormat('es-PA', { timeZone: PANAMA, day: 'numeric', month: 'long' }).format(date);
  return `el ${day} a las ${time}`;
}

/** "31 de octubre de 2026" a partir de una fecha AAAA-MM-DD; si no se puede leer, la devuelve tal cual. */
export function formatDay(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value : new Intl.DateTimeFormat('es-PA', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Estado de un pedido, dicho como lo diria una persona. */
export function orderStatusText(order: Pedido, t: Copy): string {
  const paid = order.paymentState === 'cubierto' || order.paymentState === 'exceso';
  const refunded = ['reembolsado', 'parcialmente_reembolsado'].includes(order.paymentState);
  const entrega = t(order.deliveryState === 'enviado' ? 'deliverySent' : order.deliveryState === 'parcial' ? 'deliveryPartial'
    : order.deliveryState === 'pendiente' ? 'deliveryPending' : 'deliveryAssigned');
  const payment = refunded ? t('statusRefunded', { entrega })
    : paid ? t('statusPaid', { entrega })
      : order.receivedAmount > 0
        ? t('statusPartial', { recibido: money(order.moneda, order.receivedAmount), faltante: money(order.moneda, order.missingAmount) })
        : t('statusNoPayment');
  const excess = order.excessAmount > 0 ? `\n${t('statusExcess', { exceso: money(order.moneda, order.excessAmount) })}` : '';
  return `${t('statusHead', { pedido: order.id.slice(0, 8), total: money(order.moneda, order.total) })}\n${payment}${excess}`;
}

/** Mensaje al reservar: que quedo apartado, hasta cuando y como seguir. */
export function reservationText(order: Pedido, items: CommerceItem[], t: Copy, now = new Date()): string {
  return t('reservation', {
    servicio: items.length === 1 ? items[0].name : `${items.length} servicios`,
    monto: money(order.moneda, order.total), pedido: order.id.slice(0, 8),
    plazo: formatDeadline(order.expiraAt, now) || 'que venza la reserva',
  });
}
