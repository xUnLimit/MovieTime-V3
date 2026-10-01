import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Fija una zona horaria estable para que los tests de fechas (dias restantes,
// vencimientos) den el mismo resultado en local (Windows/UTC-5) y en CI (Linux/UTC).
// Los tests se escribieron esperando los calculos en hora de Panama.
process.env.TZ = 'America/Panama';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'scripts/**/*.test.{mjs,ts}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: {
        // Los pisos por area incluyen archivos que ningun test importa.
        'src/application/**': { statements: 80, branches: 70, functions: 80, lines: 80 },
        'src/platform/**': { statements: 80, branches: 70, functions: 80, lines: 80 },
        'src/modules/**': { statements: 80, branches: 70, functions: 80, lines: 80 },
        'src/store/**': { statements: 47, branches: 24, functions: 40, lines: 51 },
        'src/components/**': { statements: 42, branches: 45, functions: 40, lines: 41 },
        'src/app/**': { statements: 36, branches: 37, functions: 30, lines: 36 },
        'src/hooks/**': { statements: 47, branches: 35, functions: 47, lines: 47 },
        'src/proxy.ts': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'src/platform/server/request-auth.ts': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'src/modules/payments/**': {
          statements: 85,
          branches: 65,
          functions: 80,
          lines: 85,
        },
        'src/modules/dashboard-read-models/**': {
          statements: 80,
          branches: 60,
          functions: 90,
          lines: 85,
        },
        'src/application/use-cases/notificaciones/**': {
          statements: 85,
          branches: 50,
          functions: 85,
          lines: 85,
        },
        'src/modules/notifications/**': {
          statements: 45,
          branches: 45,
          functions: 40,
          lines: 45,
        },
        'src/modules/pwa/**': {
          statements: 50,
          branches: 35,
          functions: 50,
          lines: 50,
        },
        'src/modules/executive-push/**': {
          statements: 60,
          branches: 45,
          functions: 60,
          lines: 65,
        },
      },
      exclude: [
        'node_modules/',
        'src/test/**',
        '**/*.{test,spec}.{ts,tsx}',
        'src/platform/supabase/database.types.ts',
        'src/types/**',
        // Laboratorio de diseno: herramienta de desarrollo sin login.
        'src/app/design-lab/**',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
});
