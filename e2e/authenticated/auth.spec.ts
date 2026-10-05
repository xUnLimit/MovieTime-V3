import { expect, test } from '@playwright/test';
import { createTempUser, deleteTempUser, serviceClient } from './helpers/supabase';
import { loginViaUi } from './helpers/ui';
import { OPERATOR_STATE_PATH } from './helpers/auth-files';

test('login, logout y redireccion anonima @auth', async ({ browser }) => {
  const admin = serviceClient();
  const user = await createTempUser(admin, 'operador');
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const page = await context.newPage();
    await page.goto('/ventas');
    await expect(page).toHaveURL(/\/login/);
    await loginViaUi(page, user.email, user.password);
    await expect(page).not.toHaveURL(/\/login/);
    await page.getByRole('button', { name: 'Abrir menú de usuario' }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/ventas');
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await context.close();
    await deleteTempUser(admin, user);
  }
});

test('operador inactivo pierde acceso a datos @auth', async ({ browser }) => {
  const admin = serviceClient();
  const user = await createTempUser(admin, 'operador');
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const page = await context.newPage();
    await loginViaUi(page, user.email, user.password);
    await expect(page).not.toHaveURL(/\/login/);
    const { error } = await admin.from('usuarios').update({ active: false }).eq('id', user.id);
    expect(error).toBeNull();
    await page.goto('/ventas');
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await context.close();
    await deleteTempUser(admin, user);
  }
});

test('sesion guardada del operador permite panel y restringe Yappy @auth', async ({ browser }) => {
  const context = await browser.newContext({ storageState: OPERATOR_STATE_PATH });
  try {
    const page = await context.newPage();
    await page.goto('/ventas');
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto('/pedidos-cobros?tab=cobros');
    await expect(page.getByText('Esta sección está disponible solo para administradores.')).toBeVisible();
  } finally {
    await context.close();
  }
});
