import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`action report confirmation can be edited at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/design-lab/automatizaciones');
    await page.getByRole('tab', { name: 'Editor', exact: true }).click();
    if (width < 1024) await page.getByRole('tab', { name: 'Pasos', exact: true }).click();
    await page.getByRole('list', { name: 'Pasos del recorrido' }).getByRole('button', { name: /^Hablar con soporte/ }).click();
    if (width < 1024) await page.getByRole('tab', { name: 'Paso', exact: true }).click();
    await page.getByRole('combobox', { name: 'Acción', exact: true }).selectOption('create_report');
    const field = page.getByRole('textbox', { name: 'Texto del mensaje', exact: true });
    await field.fill('Gracias, revisaremos tu reporte.');
    await expect(page.getByTestId('message-preview')).toContainText('Gracias, revisaremos tu reporte.');
    await expect(field).toHaveValue('Gracias, revisaremos tu reporte.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
}
