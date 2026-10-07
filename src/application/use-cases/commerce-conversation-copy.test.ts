import { describe, expect, it } from 'vitest';
import type { Pedido } from '@/modules/orders/contracts';
import { createCopy } from '@/modules/commerce-copy/render';
import { commerceSummary, formatDay, formatDeadline, orderStatusText, reservationText } from './commerce-conversation-copy';

const order: Pedido = { id: '8faf2421-0000-4000-8000-000000000000', terceroId: null, contactId: '50760000000', moneda: 'USD', total: 10,
  estado: 'reservado', paymentState: 'pendiente', deliveryState: 'pendiente', receivedAmount: 0, missingAmount: 10, excessAmount: 0,
  expiraAt: '2026-10-04T03:42:05.785093+00:00', items: [] };
const item = { id: order.id, name: 'Crunchyroll Anual', amount: 10, currency: 'USD', cycle: 'anual' };
const t = createCopy();
// 4 de octubre 03:42 UTC = 3 de octubre 10:42 p. m. en Panama (UTC-5).
const sameDay = new Date('2026-10-04T02:30:00Z');

describe('datos que se insertan en los textos de compras', () => {
  it('usa el símbolo de dólar y suma el carrito en centavos', () => {
    const summary = commerceSummary([{ ...item, amount: 0.1 }, { ...item, amount: 0.2 }], t);
    expect(summary).toContain('$0.10');
    expect(summary).toContain('$0.20');
    expect(summary).toContain('Total: $0.30');
    expect(commerceSummary([], t)).toContain('Total: $0.00');
    expect(commerceSummary([{ ...item, currency: 'EUR' }], t)).toContain('Total: EUR 10.00');
    expect(reservationText({ ...order, moneda: 'EUR' }, [item], t)).toContain('EUR 10.00');
  });
  it('dice el plazo en hora de Panama, sin fecha ISO', () => {
    expect(formatDeadline(order.expiraAt, sameDay)).toMatch(/^hoy a las 10:42/);
    expect(formatDeadline(order.expiraAt, new Date('2026-10-01T12:00:00Z'))).toMatch(/^el 3 de octubre a las 10:42/);
    expect(formatDeadline('no es fecha')).toBe('');
    expect(formatDay('2026-10-31')).toBe('31 de octubre de 2026');
    expect(formatDay('sin fecha')).toBe('sin fecha');
  });

  it('confirma la reserva con lo que se reservó, el plazo y como seguir, sin datos técnicos', () => {
    const text = reservationText(order, [item], t, sameDay);
    expect(text).toContain('Reservé Crunchyroll Anual por $10.00');
    expect(text).toContain('Lo tengo apartado hasta hoy a las 10:42');
    expect(text).toContain('"Cómo pagar"');
    expect(text).not.toMatch(/T\d{2}:\d{2}|\+00:00|Faltante|Recibido/);
    expect(reservationText(order, [item, item], t, sameDay)).toContain('Reservé 2 servicios');
    expect(reservationText({ ...order, expiraAt: 'x' }, [item], t)).toContain('hasta que venza la reserva');
  });

  it('usa el texto editado cuando es válido', () => {
    const custom = createCopy({ reservation: 'Apartado: {{servicio}} ({{monto}}).' });
    expect(reservationText(order, [item], custom, sameDay)).toBe('Apartado: Crunchyroll Anual ($10.00).');
  });

  it('cuenta el estado del pedido como una persona: sin pago, pago parcial, pagado y reembolso', () => {
    expect(orderStatusText(order, t)).toBe('Tu pedido #8faf2421 es de $10.00.\nTodavía no veo tu pago.');
    expect(orderStatusText({ ...order, receivedAmount: 4, missingAmount: 6 }, t)).toContain('recibimos $4.00 y faltan $6.00');
    expect(orderStatusText({ ...order, paymentState: 'cubierto', deliveryState: 'asignado' }, t)).toContain('Ya recibimos tu pago. Tus servicios ya están asignados');
    expect(orderStatusText({ ...order, paymentState: 'cubierto', deliveryState: 'enviado' }, t)).toContain('Tu acceso ya fue enviado.');
    expect(orderStatusText({ ...order, paymentState: 'cubierto', deliveryState: 'parcial' }, t)).toContain('Una parte de tu pedido ya está lista');
    expect(orderStatusText({ ...order, paymentState: 'exceso', excessAmount: 2 }, t)).toContain('Pagaste $2.00 de más');
    expect(orderStatusText({ ...order, paymentState: 'reembolsado' }, t)).toContain('por favor no vuelvas a pagar');
  });
});
