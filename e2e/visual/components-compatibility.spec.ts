import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function fitsViewport(locator: Locator, width: number) {
  await expect.poll(async () => {
    const box = await locator.boundingBox();
    return box !== null && box.x >= 0 && box.x + box.width <= width + 1;
  }).toBe(true);
}

async function accessibleScope(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).analyze();
  expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
}

for (const viewport of [
  { name: 'desktop', width: 1920, height: 951, touch: false },
  { name: 'mobile', width: 390, height: 844, touch: true },
] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`UI dependency compatibility on ${viewport.name} in ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.touch,
        hasTouch: viewport.touch,
        bypassCSP: true,
        baseURL: test.info().project.use.baseURL,
        colorScheme: theme,
      });
      try {
        await context.addInitScript(value => localStorage.setItem('theme', value), theme);
        const page = await context.newPage();
        await page.goto('/design-lab');
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/);
        else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
        await expect(page.getByRole('button', {
          name: theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro', exact: true,
        })).toBeVisible();

        const calendar = page.locator('#formularios [data-slot="calendar"]');
        await expect(calendar).toBeVisible();
        await calendar.scrollIntoViewIfNeeded();
        await fitsViewport(calendar, viewport.width);
        const selected = calendar.getByRole('button', { name: /10 de octubre de 2026/i });
        await selected.click();
        await expect(selected).toHaveAttribute('data-selected-single', 'true');
        await page.keyboard.press('ArrowRight');
        const nextDay = calendar.getByRole('button', { name: /11 de octubre de 2026/i });
        await expect(nextDay).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(nextDay).toHaveAttribute('data-selected-single', 'true');
        const nextMonth = calendar.getByRole('button', { name: /siguiente/i });
        await expect(nextMonth.locator('svg')).toBeVisible();
        const iconBox = await nextMonth.locator('svg').boundingBox();
        expect(iconBox?.width).toBeGreaterThan(0);
        expect(iconBox?.height).toBeGreaterThan(0);
        await calendar.screenshot({ path: `reports/dependency-upgrade/ui-${viewport.name}-${theme}-calendar.png` });
        await nextMonth.click();
        await expect(calendar.getByText('Noviembre 2026')).toBeVisible();
        await accessibleScope(page, '#formularios [data-slot="calendar"]');

        const select = page.locator('#formularios').getByRole('combobox');
        await select.click();
        await page.getByRole('option', { name: 'Disney+', exact: true }).click();
        await expect(select).toHaveText('Disney+');

        const activeTab = page.getByRole('tab', { name: 'Activas', exact: true });
        await activeTab.click();
        await expect(activeTab).toHaveAttribute('aria-selected', 'true');

        const menuTrigger = page.getByRole('button', { name: 'Abrir menú', exact: true });
        await menuTrigger.click();
        await expect(page.getByRole('menuitem', { name: 'Renovar', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('menu')).toHaveCount(0);
        await expect(menuTrigger).toBeFocused();

        const dialogTrigger = page.getByRole('button', { name: 'Abrir diálogo', exact: true });
        await dialogTrigger.click();
        const dialog = page.getByRole('dialog', { name: 'Cortar venta', exact: true });
        await expect(dialog).toBeVisible();
        await fitsViewport(dialog, viewport.width);
        await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
        await dialog.screenshot({ path: `reports/dependency-upgrade/ui-${viewport.name}-${theme}-dialog.png` });
        await accessibleScope(page, '[data-slot="dialog-content"]');
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(dialogTrigger).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      } finally {
        await context.close();
      }
    });
  }
}
