import { describe, expect, it } from 'vitest';
import { NODE_VARIABLE_CATALOG } from '@/modules/bot-config';
import type { Pedido } from '@/modules/orders/contracts';
import { orderTemplateValues } from './bot-order-values';

const order: Pedido = {
  id: '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', terceroId: 'tercero-secreto', contactId: null, moneda: 'USD', total: 12.5, estado: 'pendiente',
  paymentState: 'parcial', deliveryState: 'pendiente', receivedAmount: 5, missingAmount: 7.5, excessAmount: 0,
  expiraAt: '2099-12-25T15:00:00.000Z',
  items: [
    { id: '1f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', tipo: 'nueva', servicioId: 's', ventaId: null, planNombre: 'Netflix', total: 6.25, estado: 'pendiente', ventaIdResultante: null },
    { id: '2f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', tipo: 'nueva', servicioId: 's', ventaId: null, planNombre: 'Disney', total: 6.25, estado: 'pendiente', ventaIdResultante: null },
  ],
};

describe('orderTemplateValues', () => {
  it('entrega exactamente la lista blanca y nada mas', () => {
    const values = orderTemplateValues(order);
    expect(Object.keys(values).sort()).toEqual(Object.keys(NODE_VARIABLE_CATALOG).sort());
    expect(values).toMatchObject({
      pedido_total: '$12.50', pedido_estado: 'con pago parcial', pedido_pendiente: '$7.50', pedido_servicios: '2',
    });
    expect(values.pedido_vence).toContain('25 de diciembre');
  });

  it('no expone identificadores ni datos del cliente', () => {
    const joined = Object.values(orderTemplateValues(order)).join(' ');
    expect(joined).not.toContain(order.id.slice(0, 8));
    expect(joined).not.toContain('tercero-secreto');
    expect(joined).not.toContain('Netflix');
  });

  it('dice el estado de pago en palabras y deja vacio un vencimiento ilegible', () => {
    expect(orderTemplateValues({ ...order, paymentState: 'cubierto' }).pedido_estado).toBe('pagado');
    expect(orderTemplateValues({ ...order, paymentState: 'pendiente' }).pedido_estado).toBe('pendiente de pago');
    expect(orderTemplateValues({ ...order, expiraAt: 'no-es-fecha' }).pedido_vence).toBe('');
  });
});
