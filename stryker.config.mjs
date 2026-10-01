// @ts-check
// Pruebas de mutacion sobre el codigo critico (dinero, pronosticos, auth).
// Corrida lenta: la ejecuta el workflow nocturno con `npm run test:mutation`.
const config = {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.mts' },
  mutate: [
    'src/modules/payments/**/*.ts',
    'src/modules/forecasting/**/*.ts',
    'src/platform/utils/calculations*.ts',
    'src/application/use-cases/ventas/*payment*.ts',
    'src/application/use-cases/servicios/*payment*.ts',
    'src/application/use-cases/ventas/ventas-refund-use-cases.ts',
    'src/application/use-cases/auth-use-cases.ts',
    '!**/*.test.ts',
    '!**/index.ts',
    '!**/*.d.ts',
    '!**/*types.ts',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 80, low: 60, break: 50 },
  concurrency: 4,
  timeoutMS: 30000,
  // El sandbox solo necesita fuentes y configuracion; evita copiar symlinks de skills, builds y e2e.
  ignorePatterns: ['.claude', '.agents', '.git', '.next', '.stryker-tmp', 'reports', 'e2e', 'docs', 'coverage', 'playwright-report', 'test-results', 'public'],
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

export default config;
