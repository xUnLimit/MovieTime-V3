import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { buildTextWebhook, cleanupChats, newWaId, seedInbound, signWebhookBody } from './helpers/chat';
import { e2eEnv, uniqueId } from './helpers/env';
import { assertOk, serviceClient } from './helpers/supabase';

test('fijar, archivar y filtrar conversaciones; Realtime entrante @auth', async ({ page }) => {
  const admin = serviceClient();
  const first = newWaId();
  const second = newWaId();
  const name = `E2E Chat ${uniqueId()}`;
  try {
    await seedInbound(admin, { waId: first, name, text: 'Mensaje inicial E2E' });
    await seedInbound(admin, { waId: second, name: `${name} dos`, text: 'Otro mensaje E2E' });
    await page.goto('/chats');
    await page.getByRole('list', { name: 'Conversaciones' }).getByText(name, { exact: true }).click();
    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('menuitem', { name: 'Fijar conversación' }).click();
    await expect.poll(async () => {
      const flags = assertOk(await admin.from('whatsapp_conversation_flags').select('pinned_at').eq('wa_id', first).maybeSingle(), 'verificar fijado');
      return flags.data?.pinned_at ?? null;
    }).not.toBeNull();
    await expect(page.getByRole('list', { name: 'Conversaciones' }).getByText(name, { exact: true })).toBeVisible();
    // Fijar no es un filtro: la conversacion queda marcada con el pin y sube al inicio de la lista.
    await expect(page.getByRole('list', { name: 'Conversaciones' }).getByLabel('Fijado', { exact: true })).toHaveCount(1);
    const realtimeText = `Realtime ${uniqueId()}`;
    await seedInbound(admin, { waId: first, name, text: realtimeText });
    await expect(page.getByText(realtimeText).last()).toBeVisible();
    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByRole('menuitem', { name: 'Archivar conversación' }).click();
    await expect.poll(async () => {
      const flags = assertOk(await admin.from('whatsapp_conversation_flags').select('archived_at').eq('wa_id', first).maybeSingle(), 'verificar archivado');
      return flags.data?.archived_at ?? null;
    }).not.toBeNull();
    await page.getByRole('button', { name: /Más filtros/ }).click();
    await page.getByRole('menuitem', { name: /Archivados/ }).click();
    await expect(page.getByRole('list', { name: 'Conversaciones' }).getByText(name, { exact: true })).toBeVisible();
  } finally {
    await cleanupChats(admin, [first, second]);
  }
});

test('webhook firmado persiste una vez y aparece en chat @auth', async ({ page, request }) => {
  const admin = serviceClient();
  const waId = newWaId();
  const text = `Webhook ${uniqueId()}`;
  const waMessageId = `wamid.E2E${randomUUID()}`;
  const rawBody = buildTextWebhook({ waId, name: 'E2E Webhook', text, waMessageId });
  const headers = { 'content-type': 'application/json', 'X-Hub-Signature-256': signWebhookBody(rawBody, e2eEnv().whatsappAppSecret) };
  try {
    const first = await request.post('/api/whatsapp/webhook', { data: rawBody, headers });
    expect(first.status()).toBe(200);
    const second = await request.post('/api/whatsapp/webhook', { data: rawBody, headers });
    expect(second.status()).toBe(200);
    const result = assertOk(await admin.from('whatsapp_inbound_messages').select('id', { count: 'exact' }).eq('wa_message_id', waMessageId), 'verificar webhook');
    expect(result.count).toBe(1);
    await page.goto('/chats');
    await expect(page.getByRole('list', { name: 'Conversaciones' }).getByText('E2E Webhook')).toBeVisible();
    await page.getByRole('list', { name: 'Conversaciones' }).getByText('E2E Webhook').click();
    await expect(page.getByText(text).last()).toBeVisible();
  } finally {
    await cleanupChats(admin, [waId]);
  }
});
