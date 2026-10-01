// Activa los ganchos versionados de `.githooks/` (solo en un checkout con Git y fuera del CI).
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { resolveGitExecutable } from './lib/git-executable.mjs';

if (process.env.CI || !existsSync('.git')) process.exit(0);

try {
  execFileSync(resolveGitExecutable(), ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  if (process.platform !== 'win32') chmodSync('.githooks/pre-commit', 0o755);
  console.log('Git hooks activados desde .githooks/');
} catch {
  // Sin Git disponible no hay nada que activar; no debe romper `npm ci`.
  console.warn('No se pudieron activar los Git hooks.');
}
