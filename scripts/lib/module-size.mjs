import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function sourceFiles(root, directory = join(root, 'src')) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(root, path) : [relative(root, path).split(sep).join('/')];
  });
}

export function countLines(source) {
  const lines = source.split(/\r?\n/);
  return lines.length - (lines.at(-1) === '' ? 1 : 0);
}

export function checkModuleSize(root, max = 300) {
  if (!Number.isSafeInteger(max) || max < 1) throw new Error('--max debe ser un entero positivo.');
  const exceptionPath = join(root, 'scripts', 'module-size-exceptions.json');
  const exceptions = JSON.parse(readFileSync(exceptionPath, 'utf8'));
  if (!Array.isArray(exceptions)) throw new Error('Las excepciones deben ser un arreglo.');
  const allowed = new Set();
  for (const item of exceptions) {
    if (!item || typeof item.path !== 'string' || typeof item.reason !== 'string' || !item.reason.trim()
      || typeof item.adr !== 'string' || !/^docs\/adr\/[^/.][^/]*\.md$/.test(item.adr)
      || !existsSync(join(root, item.adr)) || !statSync(join(root, item.adr)).isFile()) {
      throw new Error(`Excepcion invalida: ${item?.path ?? '(sin ruta)'}; requiere reason y ADR existente en docs/adr/.`);
    }
    allowed.add(item.path);
  }
  return sourceFiles(root).filter((path) => /\.tsx?$/.test(path)
    && !/\.(test|spec)\.tsx?$/.test(path)
    && !path.startsWith('src/test/')
    && path !== 'src/platform/supabase/database.types.ts')
    .map((path) => ({ path, lines: countLines(readFileSync(join(root, path), 'utf8')) }))
    .filter(({ path, lines }) => lines > max && !allowed.has(path))
    .sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
}
