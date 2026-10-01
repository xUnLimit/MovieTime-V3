import { expect, test, type Locator, type Page } from '@playwright/test';
import { cleanupCatalog, createVentaRpc, isoDate, seedCatalog } from './helpers/seed';
import { adminUserClient, serviceClient } from './helpers/supabase';

async function assertNoHorizontalScroll(page: Page, table: Locator) {
  await expect(table).toBeVisible();
  const overflow = await table.evaluate((element) => {
    const container = element.parentElement;
    if (!container) throw new Error('Tabla sin contenedor');
    return container.scrollWidth - container.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(pageOverflow).toBeLessThanOrEqual(1);
}

test('Ventas conserva fila de 49 px, paginacion y dato secundario @auth', async ({ page }) => {
  const admin = serviceClient();
  const user = await adminUserClient();
  const catalog = await seedCatalog(admin, { perfiles: 12 });
  try {
    for (let perfil = 1; perfil <= 11; perfil += 1) await createVentaRpc(user, catalog, { perfil });
    await page.setViewportSize({ width: 1920, height: 951 });
    await page.goto('/ventas');
    const table = page.getByRole('table').first();
    const rows = table.getByRole('rowgroup').last().getByRole('row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    expect(await rows.count()).toBeLessThanOrEqual(10);
    for (const row of await rows.all()) {
      const height = await row.evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(48);
      expect(height).toBeLessThanOrEqual(50);
    }
    await assertNoHorizontalScroll(page, table);
    const secondary = rows.first().locator('td .leading-tight .text-xs');
    await expect(secondary.first()).toBeVisible();
    const lines = await secondary.first().evaluate((element) => {
      const main = element.previousElementSibling;
      return main ? element.getBoundingClientRect().top > main.getBoundingClientRect().top : false;
    });
    expect(lines).toBe(true);
  } finally {
    await cleanupCatalog(admin, user, catalog);
  }
});

for (const route of ['/servicios', '/terceros', '/categorias', '/gastos', '/metodos-pago', '/reposo', '/log-actividad', '/notificaciones']) {
  test(`tabla ${route} sin scroll horizontal @auth`, async ({ page }) => {
    const admin = serviceClient();
    const user = await adminUserClient();
    const catalog = await seedCatalog(admin);
    try {
      await createVentaRpc(user, catalog, { perfil: 1, ...(route === '/notificaciones' ? { fechaFin: isoDate(0) } : {}) });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(route);
      const tables = page.getByRole('table');
      await expect(tables.first()).toBeVisible();
      for (const table of await tables.all()) await assertNoHorizontalScroll(page, table);
    } finally {
      await cleanupCatalog(admin, user, catalog);
    }
  });
}
