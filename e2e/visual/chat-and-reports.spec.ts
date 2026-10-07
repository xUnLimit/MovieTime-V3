import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('chat dates scroll with their messages and never overlap', async ({ page }) => {
  await page.goto('/design-lab/paginas?p=chats');
  const list = page.getByRole('list', { name: 'Mensajes' });
  await expect(list).toBeVisible();
  const dividers = page.locator('[data-day-divider]');
  expect(await dividers.count()).toBe(3);
  expect(await dividers.evaluateAll(nodes => nodes.every(node => getComputedStyle(node).position === 'static'))).toBe(true);
  const scroll = list.locator('..');
  await scroll.evaluate(node => { node.scrollTop = 0; });
  const before = await dividers.first().boundingBox();
  await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
  const after = await dividers.first().boundingBox();
  expect(before!.y - after!.y).toBeGreaterThan(100);
});

test('touch message controls appear only after selecting a message', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, bypassCSP: true });
  const page = await context.newPage();
  await page.goto('/design-lab/paginas?p=chats');
  const message = page.locator('[data-message-id]').last();
  const react = message.getByRole('button', { name: 'Reaccionar al mensaje' });
  await expect(message).toBeVisible();
  expect(await react.evaluate(node => getComputedStyle(node).opacity)).toBe('0');
  expect(await react.evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
  await message.locator('p').first().tap();
  await expect(message).toHaveAttribute('data-actions-active', 'true');
  await expect.poll(() => react.evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  const previous = page.locator('[data-message-id]').nth(34);
  await previous.locator('p').first().tap();
  await expect(message).toHaveAttribute('data-actions-active', 'false');
  await expect(previous).toHaveAttribute('data-actions-active', 'true');
  await page.getByRole('list', { name: 'Mensajes' }).locator('..').evaluate(node => { node.scrollTop -= 200; });
  await expect(previous).toHaveAttribute('data-actions-active', 'false');
  await context.close();
});

test('reports retain table dimensions across page and tab changes, with accessible details', async ({ page }) => {
  await page.goto('/design-lab/tables');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const referenceHeight = await page.locator('tbody tr').first().evaluate(node => node.getBoundingClientRect().height);
  await page.goto('/design-lab/paginas?p=reportes');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(10);
  const height = await rows.first().evaluate(node => node.getBoundingClientRect().height);
  expect(height).toBe(referenceHeight);
  expect(height).toBe(49);
  await page.getByRole('button', { name: 'Siguiente' }).click(); await expect(rows).toHaveCount(4);
  await page.getByRole('tab', { name: 'En atención' }).click(); await expect(rows).toHaveCount(10);
  expect(await rows.first().evaluate(node => node.getBoundingClientRect().height)).toBe(height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Ver reporte/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir chat' })).toHaveAttribute('href', /\/chats\?wa=/);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('reports fit on mobile across tabs and page changes', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/design-lab/paginas?p=reportes');
  await expect(page.locator('tbody tr')).toHaveCount(10);
  expect(await page.locator('tbody tr').first().evaluate(node=>node.getBoundingClientRect().height)).toBe(49);
  await page.getByRole('button',{name:'Siguiente'}).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.getByRole('tab',{name:'Resueltos'}).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
