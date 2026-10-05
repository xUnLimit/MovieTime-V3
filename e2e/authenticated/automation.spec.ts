import { expect, test } from '@playwright/test';

test('@auth @smoke Automatizaciones es una sola herramienta con pestañas propias', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/automatizaciones');
  await expect(page.getByRole('heading', { name: 'Automatizaciones', exact: true })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Herramientas del recorrido' });
  await expect(tabs).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(1);
  await tabs.getByRole('tab', { name: 'Ajustes', exact: true }).click();
  await expect(page).toHaveURL(/tab=ajustes/);
  expect(errors).toEqual([]);
});

test('@auth @smoke Plantillas de mensajes tiene su apartado y su pestaña de envíos recientes', async ({ page }) => {
  await page.goto('/plantillas-mensajes');
  await expect(page.getByRole('heading', { name: 'Plantillas de mensajes', exact: true })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Secciones de plantillas' });
  await tabs.getByRole('tab', { name: 'Envíos recientes', exact: true }).click();
  await expect(page).toHaveURL(/tab=envios/);
});

test('@auth @smoke Pedidos y cobros agrupa pedidos, cobros e interesados; conserva el filtro al volver', async ({ page }) => {
  await page.goto('/pedidos-cobros');
  await expect(page.getByRole('heading', { name: 'Pedidos y cobros', exact: true })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Secciones de pedidos y cobros' });
  await expect(tabs.getByRole('tab', { name: 'Pedidos', exact: true })).toHaveAttribute('aria-selected', 'true');
  const search = page.getByRole('searchbox', { name: 'Buscar pedido o servicio…' });
  await search.fill('servicio-de-prueba');
  await tabs.getByRole('tab', { name: 'Cobros', exact: true }).click();
  await expect(page.getByText('Pagos Yappy detectados', { exact: true })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Pedidos', exact: true }).click();
  await expect(search).toHaveValue('servicio-de-prueba');
  await search.fill('');
  await expect(page.locator('[role="tablist"] [role="tablist"]')).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'Interesados', exact: true }).click();
  await expect(page.getByText('El interés y el consentimiento se registran por separado.', { exact: false })).toBeVisible();
});

test('@auth @smoke las rutas anteriores llevan a su apartado nuevo', async ({ page }) => {
  await page.goto('/pagos-yappy');
  await expect(page).toHaveURL(/\/pedidos-cobros\?tab=cobros/);
  await page.goto('/editor-mensajes?tipo=renovacion');
  await expect(page).toHaveURL(/\/plantillas-mensajes\?tipo=renovacion/);
  await page.goto('/automatizaciones/conexiones');
  await expect(page).toHaveURL(/\/configuracion$/);
  await page.goto('/bot');
  await expect(page).toHaveURL(/\/automatizaciones$/);
});
