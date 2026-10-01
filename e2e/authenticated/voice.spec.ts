import { expect, test } from '@playwright/test';
import { cleanupChats, newWaId, seedInbound } from './helpers/chat';
import { serviceClient } from './helpers/supabase';

test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

test('nota de voz inicia y detiene grabacion @auth', async ({ page }) => {
  const admin = serviceClient();
  const waId = newWaId();
  try {
    await seedInbound(admin, { waId, name: 'E2E Audio', text: 'Abrir chat de voz' });
    await page.goto('/chats');
    await page.getByRole('list', { name: 'Conversaciones' }).getByText('E2E Audio').click();
    await page.getByRole('button', { name: 'Grabar audio' }).click();
    await expect(page.getByRole('button', { name: 'Detener grabación' })).toBeVisible();
    await page.getByRole('button', { name: 'Detener grabación' }).click();
    await expect(page.getByRole('button', { name: 'Enviar archivo' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    await cleanupChats(admin, [waId]);
  }
});
