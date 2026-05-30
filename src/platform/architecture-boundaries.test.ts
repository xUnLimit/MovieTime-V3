import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

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

function isSourceFile(file: string) {
  return /\.(ts|tsx)$/.test(file) && !/\.(test|spec)\.(ts|tsx)$/.test(file);
}

function findMatches(paths: string[], pattern: RegExp) {
  return listFiles(paths)
    .filter(isSourceFile)
    .flatMap((file) => {
      const content = readFileSync(file, 'utf8');
      return pattern.test(content) ? [relative(ROOT, file)] : [];
    });
}

// --- Transitive import-graph resolution (catches indirect leaks) ---

const VALUE_IMPORT_RE =
  /(?:^|\n)\s*import\s+(?!type\b)(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT_RE = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
const REEXPORT_RE = /(?:^|\n)\s*export\s+(?!type\b)(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g;

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function resolveImport(fromFile: string, spec: string): string | null {
  // Only resolve internal modules (alias @/ or relative). External packages are ignored.
  let basePath: string;
  if (spec.startsWith('@/')) {
    basePath = join(SRC, spec.slice(2));
  } else if (spec.startsWith('.')) {
    basePath = resolve(dirname(fromFile), spec);
  } else {
    return null;
  }

  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const ext of EXTENSIONS) {
    const candidate = join(basePath, `index${ext}`);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** All internal modules reachable through VALUE imports (not `import type`), transitively. */
function reachableValueModules(entryFile: string): Set<string> {
  const visited = new Set<string>();
  const stack = [entryFile];

  while (stack.length > 0) {
    const file = stack.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    if (!existsSync(file)) continue;

    const content = readFileSync(file, 'utf8');
    const specs = new Set<string>();
    for (const re of [VALUE_IMPORT_RE, SIDE_EFFECT_IMPORT_RE, REEXPORT_RE]) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) specs.add(match[1]);
    }

    for (const spec of specs) {
      const resolved = resolveImport(file, spec);
      if (resolved && !visited.has(resolved)) stack.push(resolved);
    }
  }

  return visited;
}

function entryFilesOf(dirs: string[]): string[] {
  return listFiles(dirs).filter(isSourceFile);
}

describe('architecture boundaries', () => {
  it('keeps stores, app routes and components behind Supabase read/write seams', () => {
    expect(findMatches(['src/store', 'src/app', 'src/components'], /@\/platform\/supabase/)).toEqual([]);
  });

  it('keeps application and domain modules independent from Zustand stores (direct imports)', () => {
    expect(
      findMatches([
        'src/application/use-cases',
        'src/application/store-reactions',
        'src/modules/payments',
        'src/modules/notifications',
        'src/modules/dashboard-read-models',
        'src/modules/forecasting',
        'src/platform/supabase',
      ], /@\/store/),
    ).toEqual([]);
  });

  it('keeps use-cases independent from Zustand stores TRANSITIVELY (via value imports)', () => {
    // This catches indirect leaks like use-case -> application/activity -> @/store that a
    // per-file text grep would miss. `import type` is excluded because type-only
    // imports are erased at compile time and create no runtime dependency.
    const offenders: Array<{ entry: string; reachedStoreFile: string }> = [];

    for (const entry of entryFilesOf(['src/application/use-cases'])) {
      const reachable = reachableValueModules(entry);
      const storeFile = [...reachable].find((m) =>
        m.replace(/\\/g, '/').includes('/src/store/'),
      );
      if (storeFile) {
        offenders.push({
          entry: relative(ROOT, entry),
          reachedStoreFile: relative(ROOT, storeFile),
        });
      }
    }

    expect(offenders).toEqual([]);
  });
});
