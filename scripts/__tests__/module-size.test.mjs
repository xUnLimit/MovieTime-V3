// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkModuleSize, countLines } from '../lib/module-size.mjs';

const roots = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'module-size-'));
  roots.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'src', 'test'), { recursive: true });
  writeFileSync(join(root, 'scripts', 'module-size-exceptions.json'), '[]');
  return root;
}
function source(root, name, count) {
  const target = join(root, 'src', name);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, `${'const x = 1;\n'.repeat(count)}`);
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('limite de modulos', () => {
  it('cuenta lineas reales con CRLF y sin contar el terminador final', () => {
    expect(countLines('a\r\nb\r\n')).toBe(2);
  });

  it('ordena infractores y excluye pruebas y tipos generados', () => {
    const root = fixture();
    source(root, 'a.ts', 301);
    source(root, 'b.tsx', 305);
    source(root, 'a.test.ts', 400);
    source(root, 'test/helper.ts', 400);
    source(root, 'platform/supabase/database.types.ts', 400);
    expect(checkModuleSize(root)).toEqual([
      { path: 'src/b.tsx', lines: 305 }, { path: 'src/a.ts', lines: 301 },
    ]);
    expect(checkModuleSize(root, 310)).toEqual([]);
  });

  it('exige razon y ADR existente para cada excepcion', () => {
    const root = fixture();
    source(root, 'a.ts', 301);
    writeFileSync(join(root, 'scripts', 'module-size-exceptions.json'),
      JSON.stringify([{ path: 'src/a.ts', reason: 'Modulo indivisible', adr: 'docs/adr/001.md' }]));
    expect(() => checkModuleSize(root)).toThrow(/ADR existente/);
    mkdirSync(join(root, 'docs', 'adr'), { recursive: true });
    writeFileSync(join(root, 'docs', 'adr', '001.md'), '# Decision');
    expect(checkModuleSize(root)).toEqual([]);
  });
});
