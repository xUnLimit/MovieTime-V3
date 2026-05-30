import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

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
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 45,
        branches: 36,
        functions: 42,
        lines: 48,
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
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
