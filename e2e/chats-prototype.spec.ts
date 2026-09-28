import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const prototypeUrl = pathToFileURL(resolve(process.cwd(), 'prototypes/chats-nocturno.html')).href;

test('@smoke chat prototype supports the core conversation flow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(prototypeUrl);

  await expect(page.getByRole('heading', { name: 'Conversaciones' })).toBeVisible();
  await expect(page.getByRole('main', { name: 'Conversación activa' })).toContainText('María Pérez');
  await page.screenshot({ path: 'prototypes/chats-violeta-desktop.png', fullPage: true });

  await page.getByRole('tab', { name: /No leídos/ }).click();
  await expect(page.locator('.conversation')).toHaveCount(2);
  await page.getByRole('tab', { name: /Todos/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar conversación' }).fill('Carlos');
  await expect(page.locator('.conversation')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Buscar conversación' }).fill('');

  await page.getByRole('button', { name: 'Abrir acciones' }).click();
  await expect(page.getByRole('menuitem', { name: 'Adjuntar archivo' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Plantillas' })).toBeVisible();
  await page.screenshot({ path: 'prototypes/chats-violeta-menu.png', fullPage: true });
  await page.getByRole('menuitem', { name: 'Plantillas' }).click();
  await page.getByRole('menuitem', { name: 'Confirmación de revisión' }).click();
  await expect(page.getByRole('textbox', { name: 'Mensaje' })).toHaveValue(/Gracias por compartir/);
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByRole('log', { name: 'Mensajes' })).toContainText('Gracias por compartir el comprobante');

  await page.getByRole('button', { name: 'Abrir acciones' }).click();
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Adjuntar archivo' }).click();
  await (await fileChooser).setFiles({ name: 'prueba.pdf', mimeType: 'application/pdf', buffer: Buffer.from('demo') });
  await expect(page.locator('#file-banner')).toContainText('prueba.pdf');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByRole('log', { name: 'Mensajes' })).toContainText('prueba.pdf');

  await page.getByRole('button', { name: 'Buscar en esta conversación' }).click();
  await page.getByRole('textbox', { name: 'Buscar mensaje' }).fill('pago');
  await expect(page.locator('#match-count')).not.toHaveText('0/0');
  await page.getByRole('button', { name: 'Cerrar búsqueda' }).click();
  await page.getByRole('button', { name: 'Opciones del mensaje' }).first().click();
  await page.getByRole('menuitem', { name: 'Responder' }).click();
  await expect(page.locator('#reply-banner')).toContainText('Respondiendo a:');
  await page.getByRole('button', { name: 'Cancelar respuesta' }).click();

  await page.getByRole('button', { name: 'Ocultar ficha del cliente' }).click();
  await expect(page.getByRole('complementary', { name: 'Ficha del cliente' })).toBeHidden();
  await page.getByRole('button', { name: /Ana Rodríguez/ }).click();
  await expect(page.locator('#composer')).toContainText('Ventana de atención cerrada');
  await page.getByRole('button', { name: 'Enviar plantilla' }).click();
  await expect(page.getByRole('log', { name: 'Mensajes' })).toContainText('Te escribimos sobre tu servicio');
  expect(errors).toEqual([]);
});

test('@smoke chat prototype works on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(prototypeUrl);
  await expect(page.getByRole('heading', { name: 'Conversaciones' })).toBeVisible();
  await expect(page.getByRole('main', { name: 'Conversación activa' })).toBeHidden();
  await page.screenshot({ path: 'prototypes/chats-violeta-mobile-list.png', fullPage: true });

  await page.getByRole('button', { name: /María Pérez/ }).click();
  await expect(page.getByRole('main', { name: 'Conversación activa' })).toBeVisible();
  await page.screenshot({ path: 'prototypes/chats-violeta-mobile-chat.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir acciones' }).click();
  await expect(page.getByRole('menuitem', { name: 'Adjuntar archivo' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Plantillas' })).toBeVisible();
  await page.screenshot({ path: 'prototypes/chats-violeta-mobile-menu.png', fullPage: true });
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Plantillas' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir acciones' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Abrir acciones' })).toBeFocused();
  await page.getByRole('button', { name: 'Mostrar ficha del cliente' }).click();
  await expect(page.getByRole('complementary', { name: 'Ficha del cliente' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar ficha' }).click();
  await page.getByRole('button', { name: 'Volver a conversaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Conversaciones' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('@a11y chat prototype has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto(prototypeUrl);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test('@performance chat prototype loads within the local navigation budget', async ({ page }) => {
  await page.goto(prototypeUrl);
  const domContentLoaded = await page.evaluate(() => {
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return navigation.domContentLoadedEventEnd - navigation.startTime;
  });
  expect(domContentLoaded).toBeLessThan(2_000);
});
