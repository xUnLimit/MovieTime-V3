import { defineConfig, devices } from '@playwright/test';

import { ADMIN_STATE_PATH } from './e2e/authenticated/helpers/auth-files';

const vercelAutomationBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
// Las capturas base deben generarse en Linux/CI; el proyecto visual no forma parte del gate bloqueante.
const visualEnabled = process.env.VISUAL_SNAPSHOTS === '1';

// El proyecto `chromium` conserva el alcance anonimo de siempre: los demas proyectos tienen su propio testDir.
const nonAnonymousSpecs = ['**/authenticated/**', '**/visual/**', '**/setup/**'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    extraHTTPHeaders: vercelAutomationBypass
      ? {
          'x-vercel-protection-bypass': vercelAutomationBypass,
        }
      : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: nonAnonymousSpecs,
    },
    {
      // Crea/asegura los usuarios admin y operador (API de administracion de Supabase) y guarda su sesion.
      name: 'setup',
      testDir: './e2e/setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], bypassCSP: true },
    },
    {
      name: 'authenticated',
      testDir: './e2e/authenticated',
      dependencies: ['setup'],
      // La CSP de produccion solo permite `*.supabase.co`; el Supabase local de CI es http://127.0.0.1,
      // asi que estas pruebas (que necesitan hablar con el) omiten la CSP. La CSP se verifica en el
      // proyecto anonimo `chromium` (production-gates).
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE_PATH, bypassCSP: true },
    },
    ...(visualEnabled
      ? [
          {
            name: 'visual',
            testDir: './e2e/visual',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, bypassCSP: true },
            expect: { toHaveScreenshot: { animations: 'disabled' as const, maxDiffPixelRatio: 0.01 } },
          },
        ]
      : []),
  ],
});
