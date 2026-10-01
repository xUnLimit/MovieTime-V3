// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateSummary, compareBaseline } from '../check-coverage-baseline.mjs';
import { evaluateCoverage, parseChangedLines } from '../lib/diff-coverage.mjs';

const script = fileURLToPath(new URL('../check-diff-coverage.mjs', import.meta.url));
const baselineScript = fileURLToPath(new URL('../check-coverage-baseline.mjs', import.meta.url));
const folders = [];

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function fixture() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'diff-coverage-'));
  folders.push(cwd);
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'test@example.test');
  git(cwd, 'config', 'user.name', 'Coverage Test');
  mkdirSync(path.join(cwd, 'src'));
  mkdirSync(path.join(cwd, 'coverage'));
  writeFileSync(path.join(cwd, 'src', 'existing.ts'), 'export const value = 1;\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'initial');
  return cwd;
}

function run(cwd, env = {}) {
  return spawnSync(process.execPath, [script], {
    cwd, encoding: 'utf8', env: { ...process.env, CI: '', COVERAGE_BASE: '', ...env },
  });
}

function report(cwd, entries = {}) {
  writeFileSync(path.join(cwd, 'coverage', 'coverage-final.json'), JSON.stringify(entries));
}

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('gate del diff', () => {
  it('falla si un archivo nuevo ejecutable no aparece en cobertura', () => {
    const cwd = fixture();
    writeFileSync(path.join(cwd, 'src', 'new.ts'), 'export const value = 2;\n');
    report(cwd);
    expect(run(cwd).status).toBe(1);
  });

  it('falla si un archivo cambiado no aparece en cobertura', () => {
    const cwd = fixture();
    writeFileSync(path.join(cwd, 'src', 'existing.ts'), 'export const value = 3;\n');
    report(cwd);
    expect(run(cwd).stderr).toContain('src/existing.ts');
  });

  it('acepta un archivo nuevo que solo declara tipos', () => {
    const cwd = fixture();
    writeFileSync(path.join(cwd, 'src', 'types.ts'), 'export type Name = string;\n');
    report(cwd);
    expect(run(cwd).status).toBe(0);
  });

  it('falla sin una base valida en CI', () => {
    const cwd = fixture();
    report(cwd);
    const result = run(cwd, { CI: 'true', COVERAGE_BASE: '0000000000000000' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No hay base Git valida');
  });

  it('compara todo el rango de una sentencia', () => {
    const changed = parseChangedLines('+++ b/src/existing.ts\n@@ -1,0 +3 @@\n');
    const coverage = new Map([['src/existing.ts', {
      statementMap: { 0: { start: { line: 1 }, end: { line: 4 } } }, s: { 0: 0 },
      fnMap: {}, f: {}, branchMap: {}, b: {},
    }]]);
    expect(evaluateCoverage(changed, coverage, () => '').totals.lines).toEqual([0, 1]);
  });

  it('falla si el reporte tiene denominador cero para codigo ejecutable cambiado', () => {
    const changed = new Map([['src/existing.ts', new Set([1])]]);
    const coverage = new Map([['src/existing.ts', { statementMap: {}, s: {}, fnMap: {}, f: {}, branchMap: {}, b: {} }]]);
    expect(evaluateCoverage(changed, coverage, () => 'export const value = 1;').missing).toEqual(['src/existing.ts']);
  });

  it('no exige sentencias V8 para un diff que solo cambia imports o reexports', () => {
    const source = "import { value } from './value';\nexport { value } from './value';\nexport const doubled = value * 2;\n";
    const empty = { statementMap: {}, s: {}, fnMap: {}, f: {}, branchMap: {}, b: {} };
    const changed = new Map([['src/existing.ts', new Set([1, 2])]]);
    expect(evaluateCoverage(changed, new Map([['src/existing.ts', empty]]), () => source).missing).toEqual([]);
    expect(evaluateCoverage(changed, new Map(), () => source).missing).toEqual([]);
    changed.get('src/existing.ts').add(3);
    expect(evaluateCoverage(changed, new Map([['src/existing.ts', empty]]), () => source).missing).toEqual(['src/existing.ts']);
  });

  it('exige cobertura para codigo ejecutable agregado en un archivo con imports', () => {
    const changed = new Map([['src/existing.ts', new Set([3])]]);
    const source = "import { value } from './value';\nexport type Value = number;\nexport const doubled = value * 2;\n";
    expect(evaluateCoverage(changed, new Map(), () => source).missing).toEqual(['src/existing.ts']);
  });

  it('ignora cambios de tipos dentro de una firma con cuerpo ejecutable', () => {
    const source = "export async function renew({\n  pagoData,\n}: {\n  pagoData: NewPaymentInput;\n}) {\n  return pagoData.id;\n}\n";
    const changed = new Map([['src/existing.ts', new Set([4])]]);
    expect(evaluateCoverage(changed, new Map(), () => source).missing).toEqual([]);
    changed.get('src/existing.ts').add(6);
    expect(evaluateCoverage(changed, new Map(), () => source).missing).toEqual(['src/existing.ts']);
  });
});

describe('baseline por area', () => {
  it('reports a missing summary clearly and accepts an absent baseline', () => {
    const cwd = fixture();
    const execute = () => spawnSync(process.execPath, [baselineScript], { cwd, encoding: 'utf8' });
    expect(execute().status).toBe(1);
    expect(execute().stderr).toContain('Ejecuta npm run test:coverage');
    writeFileSync(path.join(cwd, 'coverage', 'coverage-summary.json'), '{}');
    expect(execute().status).toBe(0);
  });

  it('does not treat malformed reports or baselines as missing files', () => {
    const cwd = fixture();
    const execute = () => spawnSync(process.execPath, [baselineScript], { cwd, encoding: 'utf8' });
    writeFileSync(path.join(cwd, 'coverage', 'coverage-summary.json'), 'invalid json');
    expect(execute().status).toBe(1);
    expect(execute().stderr).toContain('SyntaxError');
    writeFileSync(path.join(cwd, 'coverage', 'coverage-summary.json'), '{}');
    writeFileSync(path.join(cwd, 'coverage-baseline.json'), 'invalid json');
    expect(execute().status).toBe(1);
    expect(execute().stderr).toContain('SyntaxError');
    writeFileSync(path.join(cwd, 'coverage-baseline.json'), 'null');
    expect(execute().status).toBe(1);
  });

  it('falla si baja y solo actualiza hacia arriba', () => {
    const base = { application: { lines: 80, branches: 70, functions: 80 } };
    const current = Object.fromEntries(
      ['application', 'platform', 'modules', 'store', 'components', 'app', 'hooks', 'proxy+request-auth']
        .map((area) => [area, { lines: 90, branches: 90, functions: 90 }]),
    );
    current.application.lines = 79;
    expect(compareBaseline(current, base).failures).toContain('application lines: 79.00% < 80.00%');
    expect(compareBaseline(current, base, true).next.application.lines).toBe(80);
    current.application.lines = 91;
    expect(compareBaseline(current, base, true).next.application.lines).toBe(91);
  });

  it('agrega archivos por area usando conteos y no promedios', () => {
    const metric = (covered, total) => ({ covered, total });
    const summary = {
      '/repo/src/application/a.ts': { lines: metric(1, 1), branches: metric(1, 1), functions: metric(1, 1) },
      '/repo/src/application/b.ts': { lines: metric(0, 3), branches: metric(0, 3), functions: metric(0, 3) },
    };
    expect(aggregateSummary(summary).application.lines).toBe(25);
  });

  it('falla al bajar y --update conserva el piso anterior', () => {
    const cwd = fixture();
    const summaryFile = path.join(cwd, 'coverage', 'coverage-summary.json');
    const baselineFile = path.join(cwd, 'coverage-baseline.json');
    const values = (covered) => Object.fromEntries(['lines', 'branches', 'functions', 'statements']
      .map((metric) => [metric, { covered, total: 10, pct: covered * 10 }]));
    writeFileSync(summaryFile, JSON.stringify({ [path.join(cwd, 'src', 'application', 'case.ts')]: values(7) }));
    writeFileSync(baselineFile, JSON.stringify({ application: { lines: 80, branches: 80, functions: 80 } }));
    const execute = (...args) => spawnSync(process.execPath, [baselineScript, ...args], { cwd, encoding: 'utf8' });
    expect(execute().status).toBe(1);
    expect(execute('--update').status).toBe(0);
    expect(JSON.parse(readFileSync(baselineFile, 'utf8')).application.lines).toBe(80);
    writeFileSync(summaryFile, JSON.stringify({ [path.join(cwd, 'src', 'application', 'case.ts')]: values(9) }));
    expect(execute('--update').status).toBe(0);
    expect(JSON.parse(readFileSync(baselineFile, 'utf8')).application.lines).toBe(90);
  });
});
