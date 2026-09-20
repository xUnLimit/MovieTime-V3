import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve('coverage/coverage-final.json');
if (!existsSync(reportPath)) {
  console.error('Missing coverage/coverage-final.json. Run npm run test:coverage first.');
  process.exit(2);
}

const base = process.env.COVERAGE_BASE?.trim();
const diffArgs = base && !/^0+$/.test(base)
  ? ['diff', '--unified=0', `${base}...HEAD`, '--', 'src/**/*.ts', 'src/**/*.tsx']
  : ['diff', '--unified=0', 'HEAD', '--', 'src'];
const diff = execFileSync('git', diffArgs, { encoding: 'utf8' });
const changedLines = parseChangedLines(diff);

if (changedLines.size === 0) {
  console.log('Diff coverage skipped: no changed tracked production lines.');
  process.exit(0);
}

const coverage = JSON.parse(readFileSync(reportPath, 'utf8'));
const totals = { lines: [0, 0], functions: [0, 0], branches: [0, 0] };
const criticalTotals = { lines: [0, 0], functions: [0, 0], branches: [0, 0] };
const criticalPattern = /(?:platform\/.*auth|application\/.*auth|authStore|payment|pago|refund|reembolso|rls|migration)/i;

for (const [absoluteFile, fileCoverage] of Object.entries(coverage)) {
  const relativeFile = path.relative(process.cwd(), absoluteFile).replaceAll('\\', '/');
  const lines = changedLines.get(relativeFile);
  if (!lines || /\.(?:test|spec)\.[jt]sx?$/.test(relativeFile)) continue;
  const target = criticalPattern.test(relativeFile) ? criticalTotals : totals;
  collect(fileCoverage.statementMap, fileCoverage.s, lines, target.lines);
  collect(fileCoverage.fnMap, fileCoverage.f, lines, target.functions, (entry) => entry.loc?.start?.line ?? entry.decl?.start?.line);
  collect(fileCoverage.branchMap, fileCoverage.b, lines, target.branches, (entry) => entry.loc?.start?.line, true);
}

mergeInto(totals, criticalTotals);
assertThresholds('changed production code', totals, { lines: 80, functions: 80, branches: 70 });
if (Object.values(criticalTotals).some(([, total]) => total > 0)) {
  assertThresholds('changed critical code', criticalTotals, { lines: 90, functions: 90, branches: 80 });
}
if (process.exitCode) {
  console.error('Diff coverage failed.');
} else {
  console.log('Diff coverage passed.');
}

function parseChangedLines(text) {
  const result = new Map();
  let file;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      file = line.slice(6);
      if (!result.has(file)) result.set(file, new Set());
      continue;
    }
    if (!file || !line.startsWith('@@ ')) continue;
    const addedRange = line.split(' ')[2]?.slice(1);
    if (!addedRange) continue;
    const [startText, countText] = addedRange.split(',');
    const start = Number(startText);
    const count = countText === undefined ? 1 : Number(countText);
    for (let index = 0; index < count; index += 1) result.get(file).add(start + index);
  }
  return result;
}

function collect(map, hits, changed, target, lineOf = (entry) => entry.start?.line, branch = false) {
  for (const [id, entry] of Object.entries(map ?? {})) {
    if (!changed.has(lineOf(entry))) continue;
    const values = branch ? hits[id] : [hits[id]];
    target[0] += values.filter((value) => value > 0).length;
    target[1] += values.length;
  }
}

function mergeInto(target, source) {
  for (const key of Object.keys(target)) {
    target[key][0] += source[key][0];
    target[key][1] += source[key][1];
  }
}

function assertThresholds(label, values, thresholds) {
  for (const [metric, minimum] of Object.entries(thresholds)) {
    const [covered, total] = values[metric];
    if (total === 0) continue;
    const percent = (covered / total) * 100;
    console.log(`${label} ${metric}: ${percent.toFixed(2)}% (${covered}/${total})`);
    if (percent < minimum) {
      console.error(`${label} requires ${minimum}% ${metric}.`);
      process.exitCode = 1;
    }
  }
}
