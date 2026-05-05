import { config } from 'dotenv';
import { runMigration } from './migrate-to-supabase/index';
import type { MigrationOptions } from './migrate-to-supabase/types';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const VALID_ONLY = new Set([
  'currencies',
  'metodos-pago',
  'categorias',
  'usuarios',
  'tipos-gasto',
  'gastos',
  'templates',
  'config',
  'servicios',
  'ventas',
  'activity-log',
]);

function parseArgs(argv: string[]): MigrationOptions {
  let dryRun = false;
  let only: Set<string> | null = null;
  let batchSize = 500;
  let reportPath: string | undefined;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg.startsWith('--only=')) {
      const values = arg.slice('--only='.length).split(',').filter(Boolean);
      const unknown = values.filter((value) => !VALID_ONLY.has(value));
      if (unknown.length > 0) {
        throw new Error(`Unknown --only values: ${unknown.join(', ')}`);
      }
      only = new Set(values);
      continue;
    }
    if (arg.startsWith('--batch-size=')) {
      const parsed = Number(arg.slice('--batch-size='.length));
      if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('--batch-size must be a positive integer');
      batchSize = parsed;
      continue;
    }
    if (arg.startsWith('--report=')) {
      reportPath = arg.slice('--report='.length);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun, only, batchSize, reportPath };
}

function printHelp() {
  console.log(`Usage: tsx scripts/migrate-to-supabase.ts [options]

Options:
  --dry-run              Read Firestore and build report without writing Supabase
  --only=a,b            Run specific domains: ${[...VALID_ONLY].join(', ')}
  --batch-size=500      Supabase upsert batch size
  --report=path.json    Write report to a specific path
`);
}

runMigration(parseArgs(process.argv.slice(2))).catch((error) => {
  console.error(error);
  process.exit(1);
});
