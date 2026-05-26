import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function listFiles(paths: string[]) {
  return paths.flatMap((path) => walk(join(ROOT, path)));
}

function walk(path: string): string[] {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return [path];

  return readdirSync(path).flatMap((entry) => {
    const nextPath = join(path, entry);
    if (entry === 'node_modules' || entry === '.next' || entry === 'coverage') return [];
    return walk(nextPath);
  });
}

function findMatches(paths: string[], pattern: RegExp) {
  return listFiles(paths)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .flatMap((file) => {
      const content = readFileSync(file, 'utf8');
      return pattern.test(content) ? [relative(ROOT, file)] : [];
    });
}

describe('architecture boundaries', () => {
  it('keeps stores, app routes and components behind Supabase read/write seams', () => {
    expect(findMatches(['src/store', 'src/app', 'src/components'], /@\/lib\/supabase/)).toEqual([]);
  });

  it('keeps core lib modules independent from Zustand stores', () => {
    expect(
      findMatches([
        'src/lib/use-cases',
        'src/lib/payments',
        'src/lib/notifications',
        'src/lib/dashboard-read-models',
        'src/lib/forecasting',
        'src/lib/supabase',
        'src/lib/store-reactions',
      ], /@\/store/),
    ).toEqual([]);
  });
});
