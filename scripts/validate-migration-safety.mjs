// Uso: node scripts/validate-migration-safety.mjs (MIGRATION_BASE opcional).
// Protege el historial SQL y revisa migraciones nuevas expand/contract.
import { inspectMigrations } from './lib/migration-safety.mjs';

try {
  const { files, failures } = inspectMigrations(process.cwd(), process.env);
  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
  } else {
    console.log(`Migration safety passed (${files.length} changed migration files).`);
  }
} catch (error) {
  console.error(`No se pudo validar el historial de migraciones: ${error.message}`);
  process.exitCode = 1;
}
