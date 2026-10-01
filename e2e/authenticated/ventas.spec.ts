import { expect, test } from '@playwright/test';
import { cleanupCatalog, createVentaRpc, findVentaId, seedCatalog } from './helpers/seed';
import { adminUserClient, serviceClient } from './helpers/supabase';
import { createVentaViaUi } from './helpers/ui';

async function completeRenewal(page: import('@playwright/test').Page, metodoNombre: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Seleccionar ciclo' }).click();
  await page.getByRole('menuitem', { name: 'Mensual' }).click();
  await dialog.getByRole('button', { name: 'Seleccionar método' }).click();
  await page.getByRole('menuitem', { name: metodoNombre }).click();
  await dialog.getByRole('button', { name: 'Confirmar Renovación' }).click();
}

test('crear venta por UI y verla en Ventas @auth', async ({ page }) => {
  const admin = serviceClient();
  const user = await adminUserClient();
  const catalog = await seedCatalog(admin);
  try {
    await createVentaViaUi(page, catalog);
    await page.goto('/ventas');
    await expect(page.getByText(catalog.terceroNombre, { exact: false }).first()).toBeVisible();
    expect(await findVentaId(admin, catalog)).toBeTruthy();
  } finally {
    await cleanupCatalog(admin, user, catalog);
  }
});

test('renovar venta agrega periodo y pago @auth', async ({ page }) => {
  const admin = serviceClient();
  const user = await adminUserClient();
  const catalog = await seedCatalog(admin);
  try {
    const id = await createVentaRpc(user, catalog, { perfil: 1 });
    const before = await admin.from('venta_periodos').select('fecha_fin').eq('venta_id', id).order('numero_periodo', { ascending: false }).limit(1).single();
    const paymentsBefore = await admin.from('pagos_venta').select('id', { count: 'exact', head: true }).eq('venta_id', id);
    await page.goto(`/ventas/${id}`);
    await page.getByRole('button', { name: 'Renovar' }).click();
    await completeRenewal(page, catalog.metodoNombre);
    await expect.poll(async () => (await admin.from('pagos_venta').select('id', { count: 'exact', head: true }).eq('venta_id', id)).count).toBe((paymentsBefore.count ?? 0) + 1);
    const after = await admin.from('venta_periodos').select('fecha_fin').eq('venta_id', id).order('numero_periodo', { ascending: false }).limit(1).single();
    expect(after.data?.fecha_fin).not.toBe(before.data?.fecha_fin);
    await expect(page.getByRole('button', { name: 'Acciones del pago' })).toBeVisible();
  } finally {
    await cleanupCatalog(admin, user, catalog);
  }
});

test('editar pago de renovacion @auth', async ({ page }) => {
  const admin = serviceClient();
  const user = await adminUserClient();
  const catalog = await seedCatalog(admin);
  try {
    const id = await createVentaRpc(user, catalog, { perfil: 1 });
    await page.goto(`/ventas/${id}`);
    await page.getByRole('button', { name: 'Renovar' }).click();
    await completeRenewal(page, catalog.metodoNombre);
    await page.getByRole('button', { name: 'Acciones del pago' }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  } finally {
    await cleanupCatalog(admin, user, catalog);
  }
});

test('reembolso con corte inactiva la venta @auth', async ({ page }) => {
  const admin = serviceClient();
  const user = await adminUserClient();
  const catalog = await seedCatalog(admin);
  try {
    const id = await createVentaRpc(user, catalog, { perfil: 1 });
    await page.goto(`/ventas/${id}`);
    await page.getByRole('button', { name: 'Reembolso' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /^Reembolsar y cortar/ }).check();
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.getByLabel('Cuenta destino del cliente').fill('E2E Yappy');
    await dialog.getByRole('radio', { name: /^Cortar solo la venta/ }).check();
    await dialog.getByLabel('Motivo de corte').fill('Corte E2E');
    await dialog.getByRole('button', { name: 'Reembolsar y cortar' }).click();
    await expect.poll(async () => (await admin.from('ventas').select('estado').eq('id', id).single()).data?.estado).toBe('inactivo');
  } finally {
    await cleanupCatalog(admin, user, catalog);
  }
});
