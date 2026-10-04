import { createHmac, randomInt, randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { uniqueId } from './env';
import { assertOk, bestEffort } from './supabase';

const E2E_PHONE_NUMBER_ID = '100000000000001';

const usedWaIds = new Set<string>();

/** wa_id panameno (507 + 8 digitos) unico por proceso; empieza en 9 para no coincidir con terceros sembrados (6000-xxxx). */
export function newWaId(): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `5079${randomInt(1_000_000, 10_000_000)}`;
    if (!usedWaIds.has(candidate)) {
      usedWaIds.add(candidate);
      return candidate;
    }
  }
  throw new Error('No se pudo generar un wa_id unico para la prueba.');
}

export type SeedInbound = { waId: string; name: string; text: string; sentAt?: Date };

/** Inserta un mensaje ENTRANTE (como lo haria el webhook) con service role. Devuelve el wa_message_id. */
export async function seedInbound(admin: SupabaseClient, message: SeedInbound): Promise<string> {
  const waMessageId = `wamid.E2E${uniqueId()}${randomUUID().slice(0, 6)}`;
  const sentAt = (message.sentAt ?? new Date()).toISOString();
  assertOk(
    await admin.from('whatsapp_inbound_messages').insert({
      wa_message_id: waMessageId,
      phone_number_id: E2E_PHONE_NUMBER_ID,
      from_wa_id: message.waId,
      contact_name: message.name,
      message_type: 'text',
      text_body: message.text,
      sent_at: sentAt,
      received_at: sentAt,
      payload: {},
    }),
    'sembrar mensaje entrante',
  );
  return waMessageId;
}

export async function cleanupChats(admin: SupabaseClient, waIds: string[]): Promise<void> {
  if (waIds.length === 0) return;
  await bestEffort('borrar cola entrante', async () => assertOk(await admin.from('whatsapp_automation_inbox').delete().in('wa_id', waIds), 'cola entrante'));
  await bestEffort('borrar mensajes entrantes', async () => assertOk(await admin.from('whatsapp_inbound_messages').delete().in('from_wa_id', waIds), 'entrantes'));
  await bestEffort('borrar mensajes salientes', async () => assertOk(await admin.from('whatsapp_outbound_messages').delete().in('to_wa_id', waIds), 'salientes'));
  await bestEffort('borrar banderas', async () => assertOk(await admin.from('whatsapp_conversation_flags').delete().in('wa_id', waIds), 'banderas'));
  await bestEffort('borrar lecturas', async () => assertOk(await admin.from('whatsapp_conversation_reads').delete().in('wa_id', waIds), 'lecturas'));
  await bestEffort('borrar estado del chat', async () => assertOk(await admin.from('whatsapp_conversation_state').delete().in('wa_id', waIds), 'estado del chat'));
}

/** Cuerpo de un webhook de Meta con un mensaje de texto entrante. */
export function buildTextWebhook(input: { waId: string; name: string; text: string; waMessageId: string }): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: '100000000000002',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15550000000', phone_number_id: E2E_PHONE_NUMBER_ID },
          contacts: [{ wa_id: input.waId, profile: { name: input.name } }],
          messages: [{
            id: input.waMessageId,
            from: input.waId,
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: 'text',
            text: { body: input.text },
          }],
        },
      }],
    }],
  });
}

/** Firma X-Hub-Signature-256 de Meta: HMAC-SHA256 del cuerpo crudo con el App Secret. */
export function signWebhookBody(rawBody: string, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`;
}
