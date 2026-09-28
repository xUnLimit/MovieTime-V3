import { describe, expect, it } from 'vitest';

import { parseWebhookPayload } from './webhook-payload';

function envelope(changes: Array<{ field: string; value: unknown }>) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: '1592940775059519', changes }],
  };
}

const metadata = { display_phone_number: '50765331751', phone_number_id: '1324513647414207' };

describe('parseWebhookPayload', () => {
  it('captures a template quick reply payload and its context', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'messages', value: { messaging_product: 'whatsapp', metadata,
        messages: [{ id: 'wamid.REPLY', from: '50760000000', timestamp: '1790000000',
          type: 'button', button: { text: 'Quiero renovar', payload: 'RENOVAR:123e4567-e89b-12d3-a456-426614174000' },
          context: { id: 'wamid.NOTICE' } }],
      },
    }]));
    if (!result.success) throw new Error('expected success');
    expect(result.batch.messages[0]).toMatchObject({
      messageType: 'button', textBody: 'Quiero renovar', contextWaMessageId: 'wamid.NOTICE',
      payload: { type: 'template_button', payload: 'RENOVAR:123e4567-e89b-12d3-a456-426614174000', text: 'Quiero renovar' },
    });
  });

  it('still stores a button label when Meta omits its payload', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'messages', value: { messaging_product: 'whatsapp', metadata,
        messages: [{ id: 'wamid.LABEL', from: '50760000000', timestamp: '1790000000',
          type: 'button', button: { text: 'Respuesta' } }],
      },
    }]));
    if (!result.success) throw new Error('expected success');
    expect(result.batch.messages[0]).toMatchObject({ textBody: 'Respuesta', payload: {} });
  });
  it('normalizes an inbound text message with the contact name', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        contacts: [{ wa_id: '50760000000', profile: { name: 'Cliente Prueba' } }],
        messages: [{
          id: 'wamid.ABC',
          from: '50760000000',
          timestamp: '1790000000',
          type: 'text',
          text: { body: 'Hola, quiero Netflix' },
        }],
      },
    }]));

    expect(result).toEqual({
      success: true,
      batch: {
        messages: [{
          waMessageId: 'wamid.ABC',
          phoneNumberId: '1324513647414207',
          fromWaId: '50760000000',
          contactName: 'Cliente Prueba',
          messageType: 'text',
          textBody: 'Hola, quiero Netflix',
          sentAt: new Date(1790000000 * 1000).toISOString(),
          mediaId: null, mediaMimeType: null, mediaFilename: null,
          contextWaMessageId: null, reactionEmoji: null, payload: {},
        }],
        statuses: [],
        skippedChanges: 0,
        skippedItems: 0,
      },
    });
  });

  it('keeps non-text messages without a body and truncates long text', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        messages: [
          { id: 'wamid.IMG', from: '50760000000', timestamp: '1790000000', type: 'image' },
          { id: 'wamid.LONG', from: '50760000000', timestamp: '1790000001', type: 'text', text: { body: 'x'.repeat(5000) } },
        ],
      },
    }]));

    if (!result.success) throw new Error('expected success');
    expect(result.batch.messages[0]).toMatchObject({ messageType: 'image', textBody: null, contactName: null });
    expect(result.batch.messages[1].textBody).toHaveLength(4096);
  });

  it('keeps the label of a tapped template quick reply as the message text', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        messages: [{
          id: 'wamid.BTN',
          from: '50760000000',
          timestamp: '1790000000',
          type: 'button',
          button: { text: 'Ya pagué', payload: 'Ya pagué' },
        }],
      },
    }]));

    if (!result.success) throw new Error('expected success');
    expect(result.batch.messages[0]).toMatchObject({ messageType: 'button', textBody: 'Ya pagué' });
  });

  it('keeps media ids, types, file names and captions for attachments', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        messages: [
          { id: 'wamid.IMG2', from: '50760000000', timestamp: '1790000000', type: 'image',
            image: { id: '1234567890', mime_type: 'image/jpeg', caption: 'Comprobante' } },
          { id: 'wamid.DOC', from: '50760000000', timestamp: '1790000001', type: 'document',
            document: { id: '555', mime_type: 'application/pdf', filename: 'recibo.pdf' } },
          { id: 'wamid.BAD', from: '50760000000', timestamp: '1790000002', type: 'audio', audio: { id: '../etc' } },
        ],
      },
    }]));

    if (!result.success) throw new Error('expected success');
    expect(result.batch.messages).toEqual([
      expect.objectContaining({ messageType: 'image', textBody: 'Comprobante', mediaId: '1234567890', mediaMimeType: 'image/jpeg', mediaFilename: null }),
      expect.objectContaining({ messageType: 'document', textBody: null, mediaId: '555', mediaMimeType: 'application/pdf', mediaFilename: 'recibo.pdf' }),
    ]);
    expect(result.batch.skippedChanges).toBe(0);
    expect(result.batch.skippedItems).toBe(1);
  });

  it('normalizes delivery statuses including the first error', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        statuses: [
          { id: 'wamid.OUT1', status: 'delivered', timestamp: '1790000000', recipient_id: '50760000000' },
          {
            id: 'wamid.OUT2',
            status: 'failed',
            timestamp: '1790000005',
            recipient_id: '50760000001',
            errors: [{ code: 131026, title: 'Message undeliverable' }],
          },
        ],
      },
    }]));

    if (!result.success) throw new Error('expected success');
    expect(result.batch.statuses).toEqual([
      expect.objectContaining({ waMessageId: 'wamid.OUT1', status: 'delivered', errorCode: null, errorTitle: null }),
      expect.objectContaining({ waMessageId: 'wamid.OUT2', status: 'failed', errorCode: 131026, errorTitle: 'Message undeliverable' }),
    ]);
  });

  it('drops only the malformed status and keeps the rest', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'message_statuses',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        statuses: [
          { id: 'wamid.OK', status: 'sent', timestamp: '1790000009', recipient_id: '50760000000' },
          { id: 'wamid.BAD', status: 'teleported', timestamp: '1790000009', recipient_id: '50760000000' },
        ],
      },
    }]));

    if (!result.success) throw new Error('expected success');
    expect(result.batch.statuses.map((status) => status.waMessageId)).toEqual(['wamid.OK']);
    expect(result.batch.skippedItems).toBe(1);
  });

  it('reads delivery statuses sent under the message_statuses field', () => {
    const result = parseWebhookPayload(envelope([{
      field: 'message_statuses',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        statuses: [{ id: 'wamid.OUT3', status: 'read', timestamp: '1790000009', recipient_id: '50760000000' }],
      },
    }]));

    if (!result.success) throw new Error('expected success');
    expect(result.batch.statuses).toEqual([expect.objectContaining({ waMessageId: 'wamid.OUT3', status: 'read' })]);
    expect(result.batch.skippedChanges).toBe(0);
  });

  it('skips other subscribed fields and malformed message changes', () => {
    const result = parseWebhookPayload(envelope([
      { field: 'message_template_status_update', value: { event: 'APPROVED' } },
      { field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: 'not-a-number' } } },
    ]));

    expect(result).toEqual({ success: true, batch: { messages: [], statuses: [], skippedChanges: 2, skippedItems: 0 } });
  });

  it.each([
    ['a non WhatsApp object', { object: 'page', entry: [] }],
    ['a missing entry list', { object: 'whatsapp_business_account' }],
    ['a primitive', 'hello'],
  ])('rejects %s', (_label, payload) => {
    expect(parseWebhookPayload(payload)).toEqual({ success: false });
  });
});
