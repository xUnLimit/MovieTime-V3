import { describe, expect, it } from 'vitest';
import { defaultPaymentMessages, PAYMENT_MESSAGE_KEYS, renderPaymentMessage, resolvePaymentMessages } from './payment-messages';

describe('payment messages', () => {
  it('falls back to defaults for missing, invalid or malformed storage', () => {
    const defaults = defaultPaymentMessages();
    expect(resolvePaymentMessages(null)).toEqual(defaults);
    expect(resolvePaymentMessages([])).toEqual(defaults);
    expect(resolvePaymentMessages({ pago_confirmado: '   ', esperando_correo: 7, pedido_no_disponible: 'x'.repeat(1025) })).toEqual(defaults);
  });

  it('uses valid overrides and rejects unknown variables per key', () => {
    const messages = resolvePaymentMessages({
      pago_confirmado: ' Listo! ', instrucciones: 'Paga {{monto}} {{moneda}} a {{destino}} ({{expira}})',
      pedido_no_disponible: 'Hola {{secreto}}', desconocida: 'x',
    });
    expect(messages.pago_confirmado).toBe('Listo!');
    expect(messages.instrucciones).toContain('{{destino}}');
    expect(messages.pedido_no_disponible).toBe(defaultPaymentMessages().pedido_no_disponible);
    expect(Object.keys(messages)).toEqual(PAYMENT_MESSAGE_KEYS);
  });

  it('renders variables and bounds the result', () => {
    const messages = { ...defaultPaymentMessages(), recordatorio_pedido: '{{moneda}} {{monto}} {{expira}}' };
    expect(renderPaymentMessage(messages, 'recordatorio_pedido', { moneda: 'USD', monto: '5.00', expira: 'hoy' })).toBe('USD 5.00 hoy');
  });
});
