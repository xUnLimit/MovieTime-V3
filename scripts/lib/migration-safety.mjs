import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = (path) => /^supabase\/migrations\/[^/]+\.sql$/.test(path);
const lines = (value) => value.split(/\r?\n/).filter(Boolean);
const git = (root, args) => execFileSync('git', args, {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
}).trim();

function validCommit(root, ref) {
  try {
    git(root, ['rev-parse', '--verify', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveBase(root, environment) {
  const explicit = environment.MIGRATION_BASE?.trim();
  if (explicit && !/^0+$/.test(explicit)) {
    if (!validCommit(root, explicit)) throw new Error(`MIGRATION_BASE invalida: ${explicit}`);
    return explicit;
  }
  if (validCommit(root, 'origin/main')) return git(root, ['merge-base', 'origin/main', 'HEAD']);
  if (validCommit(root, 'HEAD~1')) return 'HEAD~1';
  if (environment.CI) throw new Error('CI requiere una base Git valida para migraciones.');
  return null;
}

function changedEntries(root, args) {
  return lines(git(root, ['diff', '--name-status', '--find-renames', ...args]))
    .map((line) => {
      const [status, first, second] = line.split('\t');
      return { status: status[0], first, second };
    });
}

// El lexer elimina comentarios y cadenas SQL para evitar coincidencias falsas.
function executableSql(sql) {
  let result = '';
  for (let i = 0; i < sql.length;) {
    if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\n') i++;
    } else if (sql.startsWith('/*', i)) {
      i += 2;
      while (i < sql.length && !sql.startsWith('*/', i)) i++;
      i += 2;
      result += ' ';
    } else if (sql[i] === "'") {
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i++] === "'") break;
      }
      result += ' ';
    } else if (sql[i] === '$') {
      const delimiter = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i))?.[0];
      if (delimiter) {
        const end = sql.indexOf(delimiter, i + delimiter.length);
        if (end >= 0) {
          i = end + delimiter.length;
          result += ' ';
          continue;
        }
      }
      result += sql[i++];
    } else {
      result += sql[i++];
    }
  }
  return result;
}

export function unsafeStatements(sql) {
  const executable = executableSql(sql);
  const rules = [
    ['DROP TABLE', /\bDROP\s+TABLE\b/i],
    ['DROP COLUMN', /\bDROP\s+COLUMN\b/i],
    ['DROP SCHEMA', /\bDROP\s+SCHEMA\b/i],
    ['TRUNCATE', /\bTRUNCATE\b/i],
    ['ALTER COLUMN TYPE', /\bALTER\s+TABLE\b[^;]*\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i],
    ['ALTER TABLE RENAME', /\bALTER\s+TABLE\b[^;]*\bRENAME\b/i],
    ['DELETE sin WHERE', /\bDELETE\s+FROM\s+[\w."-]+\s*;/i],
  ];
  return rules.filter(([, pattern]) => pattern.test(executable)).map(([name]) => name);
}

export function inspectMigrations(root, environment = process.env) {
  const base = resolveBase(root, environment);
  const baseFiles = new Set(lines(git(root, ['ls-tree', '-r', '--name-only', base ?? 'HEAD', '--', 'supabase/migrations'])));
  const committed = base ? changedEntries(root, [`${base}...HEAD`]) : [];
  const working = changedEntries(root, ['HEAD']);
  const untracked = lines(git(root, ['ls-files', '--others', '--exclude-standard', '--', 'supabase/migrations']));
  const failures = [];
  const newFiles = new Set();
  const changed = new Set();

  for (const entry of [...committed, ...working]) {
    const paths = [entry.first, entry.second].filter((path) => path && migration(path));
    for (const path of paths) changed.add(path);
    if (!paths.length) continue;
    if (entry.status === 'R') failures.push(`${entry.first} -> ${entry.second}: no se permite renombrar migraciones.`);
    else if (entry.status === 'D' && migration(entry.first)) failures.push(`${entry.first}: no se permite eliminar migraciones.`);
    else if (entry.status === 'M' && baseFiles.has(entry.first)) failures.push(`${entry.first}: no se permite modificar una migracion existente.`);
    else if (entry.status === 'A' && migration(entry.first)) newFiles.add(entry.first);
    else if (entry.status !== 'M' && entry.status !== 'A') failures.push(`${entry.first}: cambio de migracion no permitido (${entry.status}).`);
  }
  for (const file of untracked.filter(migration)) {
    changed.add(file);
    newFiles.add(file);
  }
  for (const file of newFiles) {
    for (const rule of unsafeStatements(readFileSync(join(root, file), 'utf8'))) {
      failures.push(`${file}: instruccion incompatible con expand/contract (${rule}).`);
    }
  }
  return { files: [...changed].sort(), failures: [...new Set(failures)] };
}
