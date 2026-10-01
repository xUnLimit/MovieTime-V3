import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { cleanupCatalog, createVentaRpc, seedCatalog } from './helpers/seed';
import { adminUserClient, serviceClient, assertOk, assertRow, bestEffort } from './helpers/supabase';

test('conciliacion manual Yappy de aviso sembrado @auth', async ({ page }) => {
  const admin = serviceClient();
  const user = await adminUserClient();
  const catalog = await seedCatalog(admin);
  const code = `E2E${randomUUID().replaceAll('-', '').slice(0, 15).toUpperCase()}`;
  let mailId = '';
  let paymentId = '';
  try {
    const ventaId = await createVentaRpc(user, catalog, { perfil: 1 });
    const mail = assertRow(await admin.from('yappy_mail_messages').insert({
      uid_validity: Date.now(), imap_uid: Date.now(), received_at: new Date().toISOString(),
      from_address: 'e2e@example.com', subject: code, dmarc_pass: true, status: 'extraido',
    }).select('id').single(), 'sembrar correo Yappy');
    mailId = mail.data.id;
    const payment = assertRow(await admin.from('yappy_payments').insert({
      confirmation_code: code, amount: catalog.planPrecio, payer_name_short: catalog.terceroNombre,
      payer_phone_last4: catalog.last4, paid_at: new Date().toISOString(), mail_message_id: mailId,
      match_status: 'match_unico', candidate_venta_ids: [ventaId],
    }).select('id').single(), 'sembrar pago Yappy');
    paymentId = payment.data.id;
    await page.goto('/pagos-yappy');
    const row = page.getByRole('row').filter({ hasText: code });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Revisar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Marcar como registrado' }).click();
    await expect.poll(async () => (await admin.from('yappy_payments').select('match_status,matched_venta_id').eq('id', paymentId).single()).data?.match_status).toBe('registrado');
    await expect(page.getByRole('link', { name: 'Ver venta registrada' })).toBeVisible();
  } finally {
    if (paymentId) await bestEffort('borrar pago Yappy', async () => assertOk(await admin.from('yappy_payments').delete().eq('id', paymentId), 'pago Yappy'));
    if (mailId) await bestEffort('borrar correo Yappy', async () => assertOk(await admin.from('yappy_mail_messages').delete().eq('id', mailId), 'correo Yappy'));
    await cleanupCatalog(admin, user, catalog);
  }
});
