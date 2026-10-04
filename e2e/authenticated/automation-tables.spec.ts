import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { Pedido } from '@/modules/orders/contracts';
import type { AutomationControl } from '@/types/automation-control';
import { cleanupCatalog, createVentaRpc, seedCatalog } from './helpers/seed';
import { adminUserClient, serviceClient } from './helpers/supabase';

async function openSidebar(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Abrir menú', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}

async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Secciones de automatizaciones' }).getByRole('link', { name, exact: true }).click();
}


const uuid = (value: number) => `70000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const orders: Pedido[] = Array.from({ length: 14 }, (_, index) => ({
  id: uuid(index + 1), terceroId: null, contactId: null, moneda: 'USD', total: 12, estado: 'esperando_pago',
  paymentState: index === 4 ? 'exceso' : index % 3 ? 'cubierto' : 'parcial', deliveryState: index % 2 && index % 3 ? 'asignado' : 'pendiente',
  receivedAmount: index === 4 ? 14 : index % 3 ? 12 : 8, missingAmount: index % 3 ? 0 : 4, excessAmount: index === 4 ? 2 : 0,
  allocatedAmount: index % 2 && index % 3 ? 12 : 0, refundedAmount: 0, unallocatedAmount: index % 2 && index % 3 ? 0 : index % 3 ? 12 : 8, expiraAt: '2100-10-03T12:00:00Z',
  items: ['Netflix', 'Disney+'].map((planNombre, part) => ({ id: uuid(100 + index * 2 + part), tipo: 'nueva', servicioId: uuid(300), ventaId: null, planNombre, total: 6, estado: index % 2 && index % 3 ? 'aplicado' : 'pendiente', ventaIdResultante: index % 2 && index % 3 ? uuid(400) : null })),
}));
const control: AutomationControl = {
  settings: { aiMode: 'off', model: '', dailyCalls: 100, dailyTokens: 10000, reservationMinutes: 15, maxReservations: 1, integrationsEnabled: false, purchasesEnabled: false },
  health: { aiConfigured: false, integrationConfigured: false }, providers: [], access: [],
  interests: Array.from({ length: 14 }, (_, index) => ({ id: uuid(500 + index), contactSuffix: String(2000 + index), category: index % 2 ? 'Disney+' : 'Netflix', plan: 'Perfil mensual', consent: index % 3 !== 0, paused: index % 5 === 0, state: index === 13 ? 'cancelled' : 'waiting', createdAt: '2026-10-03T12:00:00Z' })),
};

async function assertTable(page: Page, expectedRows: number, salesMobile = false) {
  const table = page.getByRole('table').first();
  const rows = table.getByRole('rowgroup').last().getByRole('row');
  await expect(rows).toHaveCount(expectedRows);
  expect(await rows.count()).toBeLessThanOrEqual(10);
  for (const row of await rows.all()) {
    const height = await row.evaluate(element => element.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(48);
    expect(height).toBeLessThanOrEqual(50);
  }
  const overflow = await table.evaluate(element => element.parentElement ? element.parentElement.scrollWidth - element.parentElement.clientWidth : 0);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('[role="tablist"] [role="tablist"]')).toHaveCount(0);
  if (salesMobile) {
    // The existing Sales reference collapses the entire service column on mobile.
    const serviceHeader = table.getByRole('columnheader', { name: 'Servicio', exact: true, includeHidden: true });
    await expect(serviceHeader).toHaveCount(1);
    await expect(serviceHeader).toBeHidden();
    const secondary = rows.first().locator('td .leading-tight .text-xs').first();
    await expect(secondary).toHaveCount(1);
    await expect(secondary).toBeHidden();
    await expect(table.getByRole('columnheader', { name: 'Cliente', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Monto', exact: true })).toBeVisible();
  } else {
    const secondary = rows.first().locator('td .leading-tight .text-xs:visible').first();
    await expect(secondary).toBeVisible();
    expect(await secondary.evaluate(element => element.previousElementSibling ? element.getBoundingClientRect().top > element.previousElementSibling.getBoundingClientRect().top : false)).toBe(true);
  }
  return rows;
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function nextPage(page: Page, rows: Locator, expectedRows: number, salesMobile = false) {
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(expectedRows);
  await assertTable(page, expectedRows, salesMobile);
}

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [{ name: 'escritorio', width: 1440, height: 1000 }, { name: 'movil', width: 390, height: 844 }]) {
    test(`@auth comparación visual declarada Ventas real y Pedidos/Interesados con datos HTTP ${theme} ${viewport.name}`, async ({ page }, testInfo) => {
      testInfo.annotations.push({ type: 'scope', description: 'Ventas: API y RPC reales contra base E2E aislada. Pedidos/Interesados: 14 registros HTTP sintéticos solo para presentación; ninguna escritura simulada.' });
      const admin = serviceClient();
      const user = await adminUserClient();
      const catalog = await seedCatalog(admin, { perfiles: 12 });
      const pageErrors: string[] = [];
      page.on('pageerror', error => pageErrors.push(error.name));
      try {
        for (let perfil = 1; perfil <= 11; perfil += 1) await createVentaRpc(user, catalog, { perfil });
        await page.addInitScript(value => localStorage.setItem('theme', value), theme);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/ventas');
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
        const titleBox = await page.getByRole('heading', { name: 'Ventas', exact: true }).boundingBox();
        const actionBox = await page.getByRole('link', { name: 'Nueva Venta', exact: true }).boundingBox();
        expect(titleBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        if (titleBox && actionBox) {
          expect(titleBox.y + titleBox.height <= actionBox.y || titleBox.x + titleBox.width <= actionBox.x).toBe(true);
        }
        await expect(page.getByRole('tablist', { name: 'Estado de las ventas' })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Todas', exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.getByRole('tab', { name: 'Activas', exact: true }).click();
        await expect(page.getByRole('tab', { name: 'Activas', exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.getByRole('tab', { name: 'Inactivas', exact: true }).click();
        await expect(page.getByRole('tab', { name: 'Inactivas', exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.getByRole('tab', { name: 'Todas', exact: true }).click();
        await page.getByRole('searchbox').fill(catalog.terceroNombre);
        const salesRows = await assertTable(page, 10, viewport.name === 'movil');
        await expect(salesRows.first()).toContainText(catalog.terceroNombre);
        await capture(page, testInfo, 'ventas-real-pagina1');
        await nextPage(page, salesRows, 1, viewport.name === 'movil');
        await capture(page, testInfo, 'ventas-real-pagina2');
        await page.route('**/rest/v1/rpc/mt_list_orders', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(orders) }));
        await page.route('**/api/automations/control', route => route.request().method() === 'GET'
          ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: control, requestId: 'visual-fixture' }) })
          : route.abort());
        await openSidebar(page, 'Automatizaciones');
        await openTab(page, 'Pedidos');
        const orderRows = await assertTable(page, 10);
        await capture(page, testInfo, 'pedidos-presentacion-pagina1');
        await nextPage(page, orderRows, 4);
        await capture(page, testInfo, 'pedidos-presentacion-pagina2');
        await openTab(page, 'Cobros');
        await expect(page.getByRole('heading', { name: 'Pagos Yappy detectados', exact: true })).toBeVisible();
        await openTab(page, 'Pedidos');
        await assertTable(page, 10);
        await page.getByRole('searchbox').fill('Netflix');
        await openSidebar(page, 'Ventas');
        await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
        await openSidebar(page, 'Automatizaciones');
        await openTab(page, 'Pedidos');
        await expect(page.getByRole('searchbox')).toHaveValue('Netflix');
        await page.getByRole('searchbox').fill('');
        await page.goto('/automatizaciones/interesados');
        const interestRows = await assertTable(page, 10);
        await capture(page, testInfo, 'interesados-presentacion-pagina1');
        await nextPage(page, interestRows, 4);
        await capture(page, testInfo, 'interesados-presentacion-pagina2');
        await page.getByRole('searchbox').fill('Netflix');
        await expect(page.getByText('Página 1 de 1', { exact: true })).toBeVisible();
        await openSidebar(page, 'Terceros');
        await openSidebar(page, 'Automatizaciones');
        await openTab(page, 'Interesados');
        await expect(page.getByRole('searchbox')).toHaveValue('Netflix');
        await assertTable(page, 7);
        expect(pageErrors).toEqual([]);
      } finally {
        await cleanupCatalog(admin, user, catalog);
      }
    });
  }
}
