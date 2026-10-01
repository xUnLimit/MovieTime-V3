import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE_PATH, OPERATOR_STATE_PATH } from '../authenticated/helpers/auth-files';
import { e2eEnv } from '../authenticated/helpers/env';
import { ensureUser, serviceClient } from '../authenticated/helpers/supabase';
import { loginViaUi } from '../authenticated/helpers/ui';

test('preparar usuarios y sesiones @auth', async ({ browser }) => {
  const env = e2eEnv();
  const admin = serviceClient();
  await ensureUser(admin, { email: env.adminEmail, password: env.adminPassword, role: 'admin' });
  await ensureUser(admin, { email: env.operatorEmail, password: env.operatorPassword, role: 'operador' });
  await mkdir('e2e/.auth', { recursive: true });
  for (const [email, password, statePath] of [
    [env.adminEmail, env.adminPassword, ADMIN_STATE_PATH],
    [env.operatorEmail, env.operatorPassword, OPERATOR_STATE_PATH],
  ]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await loginViaUi(page, email, password);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await context.storageState({ path: statePath });
    } finally {
      await context.close();
    }
  }
});
