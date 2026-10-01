import { expect, type Page } from '@playwright/test';

import type { Catalog } from './seed';

/**
 * Inicia sesion por la UI real. Marca "Recordarme" para que la sesion quede en localStorage
 * (si no, vive en sessionStorage y `storageState` no la captura).
 */
export async function loginViaUi(page: Page, email: string, password: string, options: { remember?: boolean } = {}) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  if (options.remember !== false) {
    const remember = page.getByRole('checkbox', { name: 'Recordarme' });
    if (!(await remember.isChecked())) await remember.check();
  }
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

/**
 * Crea una venta de un perfil por la UI de `/ventas/crear` usando el catalogo sembrado.
 * El tercero trae su metodo de pago, asi que el selector de metodo queda precargado.
 */
export async function createVentaViaUi(page: Page, catalog: Catalog) {
  await page.goto('/ventas/crear');
  await page.getByRole('button', { name: 'Seleccionar tercero' }).click();
  await page.getByPlaceholder('Buscar tercero...').fill(catalog.terceroNombre);
  await page.getByRole('menuitem').filter({ hasText: catalog.terceroNombre }).click();

  await page.getByRole('button', { name: 'Seleccionar categoria' }).click();
  await page.getByRole('menuitem', { name: catalog.categoriaNombre }).click();
  await page.getByRole('button', { name: 'Seleccionar plan' }).click();
  await page.getByRole('menuitem', { name: catalog.planNombre }).click();
  await page.getByRole('button', { name: 'Seleccionar servicio' }).click();
  await page.getByRole('menuitem').filter({ hasText: catalog.servicioNombre }).click();
  await page.getByRole('button', { name: 'Seleccionar perfil' }).click();
  await page.getByRole('menuitem', { name: 'Perfil 1' }).click();

  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(page.getByText('Items Agregados (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByText('Venta registrada', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/ventas$/);
}
