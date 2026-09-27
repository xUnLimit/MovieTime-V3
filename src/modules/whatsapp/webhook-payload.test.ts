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
        }],
        statuses: [],
        skippedChanges: 0,
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

  it('skips other subscribed fields and malformed message changes', () => {
    const result = parseWebhookPayload(envelope([
      { field: 'message_template_status_update', value: { event: 'APPROVED' } },
      { field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: 'not-a-number' } } },
    ]));

    expect(result).toEqual({ success: true, batch: { messages: [], statuses: [], skippedChanges: 2 } });
  });

  it.each([
    ['a non WhatsApp object', { object: 'page', entry: [] }],
    ['a missing entry list', { object: 'whatsapp_business_account' }],
    ['a primitive', 'hello'],
  ])('rejects %s', (_label, payload) => {
    expect(parseWebhookPayload(payload)).toEqual({ success: false });
  });
});
