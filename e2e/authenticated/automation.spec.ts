import { expect, test, type Page } from '@playwright/test';

async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Secciones de automatizaciones' }).getByRole('link', { name, exact: true }).click();
}


test('@auth @smoke encuentra automatizaciones, mensajes y conexiones sin pestañas anidadas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/automatizaciones');
  await expect(page.getByRole('heading', { name: 'Automatizaciones', exact: true })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await openTab(page, 'Mensajes');
  await expect(page.getByRole('heading', { name: 'Biblioteca de mensajes', exact: true })).toBeVisible();
  await openTab(page, 'Conexiones');
  await expect(page.getByRole('heading', { name: 'Conexiones y automatización', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar configuración', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('@auth @smoke encuentra pedidos y cobros en Automatizaciones; conserva filtro al volver', async ({ page }) => {
  await page.goto('/automatizaciones');
  await openTab(page, 'Pedidos');
  await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Buscar pedido o servicio…' });
  await search.fill('servicio-de-prueba');
  await openTab(page, 'Cobros');
  await expect(page.getByRole('heading', { name: 'Pagos Yappy detectados', exact: true })).toBeVisible();
  await openTab(page, 'Pedidos');
  await expect(search).toHaveValue('servicio-de-prueba');
  await search.fill('');
  await expect(page.locator('[role="tablist"] [role="tablist"]')).toHaveCount(0);
});

test('@auth @smoke encuentra interesados dentro de Automatizaciones sin otro destino lateral', async ({ page }) => {
  await page.goto('/automatizaciones');
  await openTab(page, 'Interesados');
  await expect(page.getByRole('heading', { name: 'Interesados', exact: true })).toBeVisible();
  await expect(page.getByText('El interés y el consentimiento se registran por separado.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a terceros', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Terceros', exact: true })).toBeVisible();
});
