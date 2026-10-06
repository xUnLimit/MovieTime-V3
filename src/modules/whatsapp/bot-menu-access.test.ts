import { describe, expect, it } from 'vitest';
import { sendWhatsAppMessageSchema } from './outbound-contracts';
import { accessListMessage, readBotAction } from './bot-menu';
import type { InboundMessage } from './webhook-payload';

const saleId = '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b';
const now = new Date('2026-10-06T12:00:00.000Z');
const texts = { body: 'Tienes varios servicios activos. ¿De cuál necesitas los datos de acceso?', buttonLabel: 'Elegir servicio' };

function reply(id: unknown, type: unknown = 'list_reply', messageType = 'interactive'): InboundMessage {
  return {
    waMessageId: 'wamid.1', phoneNumberId: '1', fromWaId: '50765331751', contactName: null, messageType,
    textBody: 'x', sentAt: now.toISOString(), mediaId: null, mediaMimeType: null, mediaFilename: null,
    contextWaMessageId: null, reactionEmoji: null, payload: { type, id, title: 'x' } as InboundMessage['payload'],
  };
}

describe('readBotAction con la lista de datos de acceso', () => {
  it('lee la fila elegida solo si lleva el identificador de una venta', () => {
    expect(readBotAction(reply(`BOT:ACCESS:${saleId}`))).toEqual({ kind: 'access', saleId });
    expect(readBotAction(reply(`BOT:ACCESS:${saleId}`, 'button_reply'))).toEqual({ kind: 'access', saleId });
    expect(readBotAction(reply('BOT:ACCESS:'))).toBeNull();
    expect(readBotAction(reply('BOT:ACCESS:no-es-uuid'))).toBeNull();
    expect(readBotAction(reply(`BOT:ACCESS:${saleId}`, 'text'))).toBeNull();
  });

  it('no confunde los botones de código de acceso de una venta con esta lista', () => {
    expect(readBotAction(reply(`ACCESS:LOGIN:${saleId}`))).toEqual({ kind: 'sale', type: 'login', saleId });
  });
});

describe('accessListMessage', () => {
  const sales = [
    { saleId, service: 'Disney+ Premium Familiar Extra Largo', profile: 'Ana María de la Cruz Pérez Gómez Rodríguez Salazar Mendoza Torres Vega Ortiz Silva' },
    { saleId: '7a1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6c', service: '', profile: '' },
  ];

  it('arma una lista de WhatsApp válida con los límites respetados y solo identificadores de venta', () => {
    const list = accessListMessage(sales, { ...texts, buttonLabel: 'Elegir servicio de la lista que es largo' });
    expect(list.buttonLabel.length).toBeLessThanOrEqual(20);
    expect(list.rows[0].title.length).toBeLessThanOrEqual(24);
    expect(list.rows[0].description?.length).toBeLessThanOrEqual(72);
    expect(list.rows[0].id).toBe(`BOT:ACCESS:${saleId}`);
    expect(list.rows[1]).toEqual({ id: 'BOT:ACCESS:7a1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6c', title: 'Servicio' });
    expect(sendWhatsAppMessageSchema.safeParse({ idempotencyKey: '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', to: '50765331751', message: list }).success).toBe(true);
  });

  it('ofrece como máximo las filas que admite WhatsApp', () => {
    const many = Array.from({ length: 14 }, (_, index) => ({ saleId: `3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a${String(index).padStart(2, '0')}`, service: `Servicio ${index}`, profile: '' }));
    expect(accessListMessage(many, texts).rows).toHaveLength(10);
  });
});
