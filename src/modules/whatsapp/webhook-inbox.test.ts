import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({
  createServiceRoleClient: vi.fn(),
}));

import { storeWebhookBatch } from './webhook-inbox';
import type { WebhookBatch } from './webhook-payload';

function fakeClient(errors: Record<string, { code: string } | null> = {}) {
  const upserts: Array<{ table: string; rows: unknown; options: unknown }> = [];
  const client = {
    from: (table: string) => ({
      upsert: async (rows: unknown, options: unknown) => {
        upserts.push({ table, rows, options });
        return { error: errors[table] ?? null };
      },
    }),
  };
  return { client: client as never, upserts };
}

const batch: WebhookBatch = {
  messages: [{
    waMessageId: 'wamid.IN',
    phoneNumberId: '1324513647414207',
    fromWaId: '50760000000',
    contactName: 'Cliente',
    messageType: 'text',
    textBody: 'Hola',
    sentAt: '2026-09-27T12:00:00.000Z',
    mediaId: '998877',
    mediaMimeType: 'image/jpeg',
    mediaFilename: null,
    contextWaMessageId: null,
    reactionEmoji: null,
    payload: {},
  }],
  statuses: [{
    waMessageId: 'wamid.OUT',
    status: 'read',
    recipientWaId: '50760000000',
    statusAt: '2026-09-27T12:01:00.000Z',
    errorCode: null,
    errorTitle: null,
  }],
  skippedChanges: 0,
  skippedItems: 0,
};

describe('storeWebhookBatch', () => {
  it('upserts messages and statuses idempotently by their natural ids', async () => {
    const { client, upserts } = fakeClient();

    await expect(storeWebhookBatch(batch, client)).resolves.toEqual({ messages: 1, statuses: 1 });
    expect(upserts).toEqual([
      {
        table: 'whatsapp_inbound_messages',
        rows: [{
          wa_message_id: 'wamid.IN',
          phone_number_id: '1324513647414207',
          from_wa_id: '50760000000',
          contact_name: 'Cliente',
          message_type: 'text',
          text_body: 'Hola',
          sent_at: '2026-09-27T12:00:00.000Z',
          media_id: '998877',
          media_mime_type: 'image/jpeg',
          media_filename: null,
          context_wa_message_id: null,
          reaction_emoji: null,
          payload: {},
        }],
        options: { onConflict: 'wa_message_id', ignoreDuplicates: true },
      },
      {
        table: 'whatsapp_message_statuses',
        rows: [{
          wa_message_id: 'wamid.OUT',
          status: 'read',
          recipient_wa_id: '50760000000',
          status_at: '2026-09-27T12:01:00.000Z',
          error_code: null,
          error_title: null,
        }],
        options: { onConflict: 'wa_message_id,status', ignoreDuplicates: true },
      },
    ]);
  });

  it('does not touch the database for an empty batch', async () => {
    const { client, upserts } = fakeClient();

    await expect(storeWebhookBatch({ messages: [], statuses: [], skippedChanges: 1, skippedItems: 0 }, client))
      .resolves.toEqual({ messages: 0, statuses: 0 });
    expect(upserts).toEqual([]);
  });

  it('throws without leaking details when messages cannot be stored', async () => {
    const { client } = fakeClient({ whatsapp_inbound_messages: { code: '42501' } });

    await expect(storeWebhookBatch(batch, client)).rejects.toThrow('No se pudieron guardar los mensajes de WhatsApp: 42501');
  });

  it('throws when statuses cannot be stored', async () => {
    const { client } = fakeClient({ whatsapp_message_statuses: { code: '23514' } });

    await expect(storeWebhookBatch(batch, client)).rejects.toThrow('No se pudieron guardar los estados de WhatsApp: 23514');
  });
});
