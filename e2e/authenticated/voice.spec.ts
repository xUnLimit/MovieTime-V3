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
    await expect(page.getByRole('button', { name: 'Enviar archivo' })).toBeEnabled();
    const audioPreview = page.getByText(/^audio-\d+\.(?:m4a|aac|mp3|ogg|webm)$/);
    await expect(audioPreview).toBeVisible();
    await expect(page.getByText(/No se pudo grabar el audio|No se pudo acceder al micrófono|Este navegador no permite grabar audio/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(audioPreview).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Grabar audio' })).toBeVisible();
  } finally {
    await cleanupChats(admin, [waId]);
  }
});
