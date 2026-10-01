import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Misma zona horaria estable que la config unitaria: las fechas de los fixtures se calculan en hora de Panama.
process.env.TZ = 'America/Panama';

// Pruebas contra un Supabase local real (`npx supabase start`). Las suites se saltan solas si faltan
// INTEGRATION_SUPABASE_* y no hay CI; en CI faltar las variables es un fallo (ver src/test/integration/env.ts).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    // Cada suite crea y limpia sus propios datos; el orden estricto evita interferencias entre suites
    // (conteos del dashboard, usuarios, numeracion de periodos).
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
});
