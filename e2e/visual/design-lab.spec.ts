import { expect, test } from '@playwright/test';

const routes = ['/design-lab', '/design-lab/tables', '/design-lab/dashboard', '/design-lab/shell', '/design-lab/paginas', '/design-lab/notificaciones'];

for (const route of routes) {
  for (const theme of ['light', 'dark'] as const) {
    test(`@visual ${route} ${theme}`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      await expect(page).toHaveScreenshot(`${route.slice(1).replaceAll('/', '-')}-${theme}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    });
  }
}
