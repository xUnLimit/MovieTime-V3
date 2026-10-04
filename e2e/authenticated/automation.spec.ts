import { expect, test } from '@playwright/test';

test('@auth @smoke encuentra automatizaciones, mensajes y conexiones sin pestañas anidadas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/automatizaciones');
  await expect(page.getByRole('heading', { name: 'Automatizaciones', exact: true })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await page.getByRole('link', { name: 'Biblioteca de mensajes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca de mensajes', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a automatizaciones', exact: true }).click();
  await page.getByRole('link', { name: 'Conexiones y capacidades', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conexiones y automatización', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar configuración', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('@auth @smoke encuentra pedidos y cobros en Ventas; conserva filtro al volver', async ({ page }) => {
  await page.goto('/ventas');
  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Buscar pedido o servicio…' });
  await search.fill('servicio-de-prueba');
  await page.getByRole('link', { name: 'Cobros', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pagos Yappy detectados', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await expect(search).toHaveValue('servicio-de-prueba');
  await search.fill('');
  await expect(page.locator('[role="tablist"] [role="tablist"]')).toHaveCount(0);
});

test('@auth @smoke encuentra interesados desde Terceros sin otro destino lateral', async ({ page }) => {
  await page.goto('/terceros');
  await page.getByRole('link', { name: 'Interesados', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Interesados', exact: true })).toBeVisible();
  await expect(page.getByText('El interés y el consentimiento se registran por separado.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a terceros', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Terceros', exact: true })).toBeVisible();
});
