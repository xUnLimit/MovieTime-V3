import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(process.cwd(), 'src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const MOJIBAKE_PATTERN = /[\u00c3\u00c2\ufffd]|\u00e2[\u0080-\uffff]/;

function getSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return getSourceFiles(path);
    }

    const extension = path.match(/\.[^.]+$/)?.[0];
    return extension && SOURCE_EXTENSIONS.has(extension) ? [path] : [];
  });
}

describe('source text encoding', () => {
  it('does not contain mojibake sequences in source files', () => {
    const filesWithMojibake = getSourceFiles(SOURCE_ROOT).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return MOJIBAKE_PATTERN.test(source) ? [path.replace(process.cwd(), '')] : [];
    });

    expect(filesWithMojibake).toEqual([]);
  });
});
