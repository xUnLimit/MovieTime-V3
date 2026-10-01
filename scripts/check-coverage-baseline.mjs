import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve(process.env.COVERAGE_REPORT_DIR ?? 'coverage', 'coverage-summary.json');
const baselinePath = path.resolve('coverage-baseline.json');
const areas = ['application', 'platform', 'modules', 'store', 'components', 'app', 'hooks', 'proxy+request-auth'];
const metrics = ['lines', 'branches', 'functions'];

export function areaFor(file) {
  const normalized = file.replaceAll('\\', '/');
  if (normalized.endsWith('/src/proxy.ts') || normalized.endsWith('/src/platform/server/request-auth.ts')) return 'proxy+request-auth';
  const match = /\/src\/(application|platform|modules|store|components|app|hooks)\//.exec(normalized);
  return match?.[1] ?? null;
}

export function aggregateSummary(summary) {
  const counts = Object.fromEntries(areas.map((area) => [area, Object.fromEntries(metrics.map((metric) => [metric, { covered: 0, total: 0 }]))]));
  for (const [file, values] of Object.entries(summary)) {
    if (file === 'total') continue;
    const area = areaFor(file);
    if (!area) continue;
    for (const metric of metrics) {
      counts[area][metric].covered += values[metric].covered;
      counts[area][metric].total += values[metric].total;
    }
  }
  return Object.fromEntries(areas.map((area) => [area, Object.fromEntries(metrics.map((metric) => {
    const { covered, total } = counts[area][metric];
    return [metric, total ? Number((covered / total * 100).toFixed(2)) : 100];
  }))]));
}

export function compareBaseline(current, baseline, update = false) {
  const next = structuredClone(baseline);
  const failures = [];
  for (const area of areas) {
    if (!next[area]) next[area] = {};
    for (const metric of metrics) {
      const value = current[area][metric];
      const floor = baseline[area]?.[metric] ?? 0;
      if (update) next[area][metric] = Math.max(floor, value);
      else if (value + 0.1 < floor) failures.push(`${area} ${metric}: ${value.toFixed(2)}% < ${floor.toFixed(2)}%`);
    }
  }
  return { next, failures };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const report = readJson(reportPath);
  if (report === undefined) {
    console.error('Falta coverage/coverage-summary.json. Ejecuta npm run test:coverage.');
    process.exitCode = 1;
  } else {
    const current = aggregateSummary(report);
    const loadedBaseline = readJson(baselinePath);
    const baseline = loadedBaseline === undefined ? {} : loadedBaseline;
    const update = process.argv.includes('--update');
    const { next, failures } = compareBaseline(current, baseline, update);
    if (update) {
      writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
      console.log('Baseline actualizado solo con aumentos.');
    } else if (failures.length) {
      for (const failure of failures) console.error(`Cobertura bajo el baseline: ${failure}`);
      process.exitCode = 1;
    } else {
      console.log('Cobertura por area cumple el baseline.');
    }
  }
}
