// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectMigrations, unsafeStatements } from '../lib/migration-safety.mjs';

const roots = [];
const run = (root, ...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'migration-safety-'));
  roots.push(root);
  mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true });
  run(root, 'init');
  run(root, 'config', 'user.email', 'test@example.invalid');
  run(root, 'config', 'user.name', 'Test');
  writeFileSync(join(root, 'supabase', 'migrations', '001.sql'), 'CREATE TABLE one (id int);\n');
  run(root, 'add', '.');
  run(root, 'commit', '-m', 'base');
  return root;
}
const path = (root, name) => join(root, 'supabase', 'migrations', name);
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('seguridad de migraciones', () => {
  it('acepta una nueva migracion y usa el arbol local sin base', () => {
    const root = fixture();
    writeFileSync(path(root, '002.sql'), 'CREATE TABLE two (id int);\n');
    expect(inspectMigrations(root, {}).failures).toEqual([]);
    expect(inspectMigrations(root, {}).files).toContain('supabase/migrations/002.sql');
  });

  it.each([
    ['modificar', (root) => writeFileSync(path(root, '001.sql'), 'CREATE TABLE changed (id int);')],
    ['borrar', (root) => rmSync(path(root, '001.sql'))],
    ['renombrar', (root) => renameSync(path(root, '001.sql'), path(root, 'renamed.sql'))],
  ])('rechaza %s una migracion existente', (_, change) => {
    const root = fixture();
    change(root);
    expect(inspectMigrations(root, {}).failures.length).toBeGreaterThan(0);
  });

  it.each(['DROP TABLE one;', 'ALTER TABLE one ALTER COLUMN id TYPE text;', 'ALTER TABLE one RENAME TO two;'])
    ('rechaza SQL destructivo nuevo: %s', (sql) => {
      const root = fixture();
      writeFileSync(path(root, '002.sql'), sql);
      expect(inspectMigrations(root, {}).failures).toHaveLength(1);
    });

  it('ignora comentarios y literales, pero permite reemplazar objetos', () => {
    expect(unsafeStatements("-- DROP TABLE one\n/* ALTER TABLE one RENAME TO two */\nSELECT 'DROP SCHEMA public'; DROP POLICY old ON one; DROP TRIGGER old ON one; DROP FUNCTION old(); ALTER TABLE one DROP CONSTRAINT old;")).toEqual([]);
  });

  it.each([
    ['DROP COLUMN', 'ALTER TABLE one DROP COLUMN id;'],
    ['DROP SCHEMA', 'DROP SCHEMA old;'],
    ['TRUNCATE', 'TRUNCATE one;'],
    ['DELETE sin WHERE', 'DELETE FROM one;'],
  ])('detecta %s', (rule, sql) => {
    expect(unsafeStatements(sql)).toContain(rule);
  });

  it('ignora un DELETE limitado por WHERE', () => {
    expect(unsafeStatements('DELETE FROM one WHERE id = 1;')).toEqual([]);
  });

  it('falla en CI con base de ceros cuando no hay historial anterior', () => {
    const root = fixture();
    expect(() => inspectMigrations(root, { CI: 'true', MIGRATION_BASE: '000000' })).toThrow(/base Git valida/);
  });

  it('compara cambios confirmados con la base explicita', () => {
    const root = fixture();
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    writeFileSync(path(root, '001.sql'), 'CREATE TABLE changed (id int);');
    run(root, 'add', '.');
    run(root, 'commit', '-m', 'bad');
    expect(inspectMigrations(root, { MIGRATION_BASE: base }).failures).toMatchObject([expect.stringContaining('modificar')]);
  });
});
