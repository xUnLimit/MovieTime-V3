import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const execute = promisify(execFile);

it('executes the covering nested test for each runtime mutant', async () => {
  const root = process.cwd();
  await mkdir('reports', { recursive: true });
  const fixture = await mkdtemp(path.join(root, 'reports', 'mutation-compat-'));
  try {
    await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
    await writeFile(path.join(fixture, 'sum.js'), 'export function sum(left, right) { return left + right; }');
    await writeFile(path.join(fixture, 'sum.test.js'), `
      import { describe, expect, it } from 'vitest';
      import { sum } from './sum.js';
      describe('arithmetic', () => {
        it('adds two numbers', () => expect(sum(1, 2)).toBe(3));
      });
    `);
    await writeFile(path.join(fixture, 'vitest.config.mjs'), "export default { test: { environment: 'node' } };");
    await writeFile(path.join(fixture, 'stryker.config.json'), JSON.stringify({
      testRunner: 'vitest',
      vitest: { configFile: 'vitest.config.mjs' },
      mutate: ['sum.js'],
      coverageAnalysis: 'perTest',
      concurrency: 1,
      reporters: ['json'],
      jsonReporter: { fileName: 'mutation.json' },
      thresholds: { break: 100 },
    }));
    // Run the actual runner: checking package versions alone cannot detect false survivors.
    const result = await execute(process.execPath, [path.join(root, 'node_modules/@stryker-mutator/core/bin/stryker.js'), 'run'], {
      cwd: fixture,
      timeout: 50000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }).catch(error => ({ stdout: error.stdout, stderr: error.stderr }));
    const report = JSON.parse(await readFile(path.join(fixture, 'mutation.json'), 'utf8'));
    const mutants = Object.values(report.files).flatMap(file => file.mutants);
    expect(mutants.length).toBeGreaterThanOrEqual(2);
    expect(mutants.map(mutant => mutant.status), result.stdout + result.stderr).toEqual(mutants.map(() => 'Killed'));
    expect(mutants.every(mutant => mutant.killedBy?.length > 0)).toBe(true);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 60000);
