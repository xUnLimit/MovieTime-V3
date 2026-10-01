import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  addUntrackedFile, evaluateCoverage, isProductionFile, mergeChangedLines,
  parseChangedLines, relativeCoverage,
} from './lib/diff-coverage.mjs';

const reportPath = path.resolve(process.env.COVERAGE_REPORT_DIR ?? 'coverage', 'coverage-final.json');
if (!existsSync(reportPath)) {
  console.error('Falta coverage/coverage-final.json. Ejecuta npm run test:coverage.');
  process.exit(2);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function validCommit(ref) {
  try {
    git('rev-parse', '--verify', `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

function findBase() {
  const configured = process.env.COVERAGE_BASE?.trim();
  if (configured && !/^0+$/.test(configured) && validCommit(configured)) return configured;
  try {
    const base = git('merge-base', 'origin/main', 'HEAD');
    if (base && validCommit(base)) return base;
  } catch {
    // Un clon local puede no tener origin/main.
  }
  return validCommit('HEAD~1') ? 'HEAD~1' : null;
}

try {
  const base = findBase();
  if (!base && process.env.CI) throw new Error('No hay base Git valida para cobertura del diff en CI.');
  const changed = new Map();
  if (base) mergeChangedLines(changed, parseChangedLines(git('diff', '--unified=0', `${base}...HEAD`, '--', 'src')));
  mergeChangedLines(changed, parseChangedLines(git('diff', '--unified=0', 'HEAD', '--', 'src')));
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'src').split(/\r?\n/);
  for (const file of untracked) {
    if (isProductionFile(file)) addUntrackedFile(changed, file, readFileSync(file, 'utf8'));
  }

  const report = relativeCoverage(JSON.parse(readFileSync(reportPath, 'utf8')), process.cwd());
  const { totals, critical, missing } = evaluateCoverage(changed, report, (file) => readFileSync(file, 'utf8'));
  let failed = missing.length > 0;
  for (const file of missing) console.error(`Archivo ejecutable sin cobertura de lineas cambiadas: ${file}`);
  for (const [label, values, limits] of [
    ['changed production code', totals, { lines: 80, functions: 80, branches: 70 }],
    ['changed critical code', critical, { lines: 90, functions: 90, branches: 80 }],
  ]) {
    for (const [metric, limit] of Object.entries(limits)) {
      const [covered, total] = values[metric];
      const percent = total ? covered / total * 100 : 100;
      console.log(`${label} ${metric}: ${percent.toFixed(2)}% (${covered}/${total})`);
      if (percent < limit) {
        console.error(`${label} requires ${limit}% ${metric}.`);
        failed = true;
      }
    }
  }
  console[failed ? 'error' : 'log'](`Diff coverage ${failed ? 'failed' : 'passed'}.`);
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Diff coverage failed.');
  process.exitCode = 1;
}
