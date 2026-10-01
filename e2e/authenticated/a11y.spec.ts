import { expect, test } from '@playwright/test';
import { expectNoBlockingA11yViolations } from './helpers/axe';

const routes = ['/dashboard', '/ventas', '/servicios', '/terceros', '/categorias', '/gastos', '/notificaciones', '/chats', '/configuracion'];

for (const theme of ['light', 'dark'] as const) {
  for (const route of routes) {
    test(`@auth @a11y ${route} ${theme} escritorio y movil`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.goto(route);
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
        await expectNoBlockingA11yViolations(page);
      }
    });
  }
}
