import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.env.MIGRATION_BASE?.trim();
const args = base && !/^0+$/.test(base)
  ? ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`, '--', 'supabase/migrations/*.sql']
  : ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--', 'supabase/migrations/*.sql'];
const trackedChanges = execFileSync('git', args, { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const untrackedChanges = execFileSync('git',
  ['ls-files', '--others', '--exclude-standard', '--', 'supabase/migrations/*.sql'],
  { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const files = [...new Set([...trackedChanges, ...untrackedChanges])];
const forbidden = [
  { name: 'DROP TABLE', pattern: /\bDROP\s+TABLE\b/i },
  { name: 'DROP COLUMN', pattern: /\bDROP\s+COLUMN\b/i },
  { name: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { name: 'unbounded DELETE', pattern: /\bDELETE\s+FROM\s+[\w."-]+\s*;/i },
];

const failures = [];
for (const file of files) {
  const sql = readFileSync(file, 'utf8').replace(/--.*$/gm, '');
  for (const rule of forbidden) {
    if (rule.pattern.test(sql)) failures.push(`${file}: ${rule.name}`);
  }
}

if (failures.length > 0) {
  console.error('Destructive production migration detected. Use an expand/contract migration instead:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Migration safety passed (${files.length} changed migration files).`);
