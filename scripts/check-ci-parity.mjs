// Uso: node scripts/check-ci-parity.mjs
// Compara quality:full con todos los workflows YAML del repositorio en ambos sentidos.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCiParity } from './lib/ci-parity.mjs';

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const workflowDir = join(root, '.github', 'workflows');
const workflows = Object.fromEntries(readdirSync(workflowDir)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => [file, readFileSync(join(workflowDir, file), 'utf8')]));
const failures = checkCiParity(packageJson.scripts['quality:full'], workflows);

if (failures.length > 0) {
  failures.forEach((failure) => console.error(failure));
  process.exitCode = 1;
} else {
  console.log('CI parity passed');
}
