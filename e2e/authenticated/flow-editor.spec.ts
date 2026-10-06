import { expect, test, type Page } from '@playwright/test';
import { expectNoBlockingA11yViolations } from './helpers/axe';

const EDITOR = '/automatizaciones';

async function addStep(page: Page, name: string) {
  await page.getByRole('button', { name: 'Agregar paso' }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

const step = (page: Page, name: RegExp) => page.getByRole('list', { name: 'Pasos del recorrido' }).getByRole('button', { name });

test('@auth edita el recorrido en el estudio, no publica con errores y publica una versión válida', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR);
  await expect(page.getByRole('region', { name: 'Lienzo del recorrido' })).toBeVisible();
  await expectNoBlockingA11yViolations(page);

  // Un nodo de botones sin botones es un error: se ve sobre el nodo y Publicar queda bloqueado.
  await addStep(page, 'Botones');
  await expect(page.getByRole('status').filter({ hasText: /impid(e|en) publicar/ })).toBeVisible();
  await expect(page.getByRole('list', { name: /^Problemas de Nuevo nodo de botones/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeDisabled();

  // Se agrega un texto final, se renombra y se conecta desde el nuevo nodo con la salida de un botón (todo se edita en el inspector).
  await addStep(page, 'Texto');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Gracias final');
  await step(page, /^Nuevo nodo de botones/).click();
  await page.getByRole('button', { name: 'Agregar botón' }).click();
  await page.getByRole('textbox', { name: /^Título del botón 1 de Nuevo nodo de botones/ }).fill('Terminar');
  await page.getByRole('combobox', { name: /^Destino del botón 1 de Nuevo nodo de botones/ }).selectOption({ label: 'Gracias final' });
  await expect(page.getByRole('combobox', { name: /^Destino del botón 1 de Nuevo nodo de botones/ })).toHaveValue('nuevo_nodo_de_texto');

  // Reconectar un botón existente dejaría huérfana su rama: se agrega un tercer botón al menú hacia el nuevo nodo.
  await step(page, /^Menú principal/).click();
  await page.getByRole('button', { name: 'Agregar botón' }).click();
  await page.getByRole('combobox', { name: /^Destino del botón 3 de Menú principal/ }).selectOption({ label: 'Nuevo nodo de botones' });
  await expect(page.getByRole('status').filter({ hasText: 'Sin errores: se puede publicar' })).toBeVisible();

  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Nota de publicación' }).fill('E2E editor visual');
  await dialog.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Sin cambios')).toBeVisible();
});

test('@auth en pantallas angostas muestra la lista de pasos con edición en panel y sin lienzo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(EDITOR);
  await expect(page.getByRole('list', { name: 'Pasos del recorrido' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lienzo del recorrido' })).toHaveCount(0);
  await step(page, /^Menú principal/).click();
  await expect(page.getByRole('heading', { name: /^Editar: Menú principal/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Opciones de Menú principal' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expectNoBlockingA11yViolations(page);
});
