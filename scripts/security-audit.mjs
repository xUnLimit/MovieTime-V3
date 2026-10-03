import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const productionOnly = process.argv.includes('--production');
const allDependencies = process.argv.includes('--all');

if (productionOnly === allDependencies) {
  console.error('Use exactly one of --production or --all.');
  process.exit(2);
}

const args = ['audit', '--json'];
if (productionOnly) args.push('--omit=dev');

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const commandArgs = npmCli ? [npmCli, ...args] : args;
const result = spawnSync(command, commandArgs, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
if (!result.stdout?.trim()) {
  console.error(result.stderr || 'npm audit did not return JSON.');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit returned invalid JSON.');
  process.exit(2);
}

if (report.error) {
  console.error(`npm audit failed: ${report.error.summary || report.error.detail || report.error}`);
  process.exit(2);
}

const exceptions = allDependencies ? loadValidExceptions() : new Map();
const findings = [];

for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  const advisories = (vulnerability.via ?? []).filter((item) => typeof item === 'object');
  const advisoryIds = advisories.map((item) => String(item.url ?? item.source));
  const excepted = advisoryIds.length > 0 && advisoryIds.every((id) => exceptions.has(id));
  if (!excepted) findings.push({ name, severity: vulnerability.severity, advisoryIds });
}

if (findings.length > 0) {
  console.error(`${productionOnly ? 'Production' : 'Full-tree'} dependency audit failed:`);
  for (const finding of findings) {
    console.error(`- ${finding.severity}: ${finding.name}${finding.advisoryIds.length ? ` (${finding.advisoryIds.join(', ')})` : ''}`);
  }
  process.exit(1);
}

console.log(`${productionOnly ? 'Production' : 'Full-tree'} dependency audit passed with zero unexcepted findings.`);

function loadValidExceptions() {
  const parsed = JSON.parse(readFileSync(new URL('../security-audit-exceptions.json', import.meta.url), 'utf8'));
  const entries = Array.isArray(parsed.exceptions) ? parsed.exceptions : [];
  const now = new Date();
  const valid = new Map();

  for (const entry of entries) {
    const expires = new Date(entry.expiresAt);
    const created = new Date(entry.createdAt);
    const lifetimeDays = (expires.getTime() - created.getTime()) / 86_400_000;
    if (!entry.advisory || !entry.owner || !entry.reason || !entry.mitigation) {
      throw new Error('Every audit exception requires advisory, owner, reason and mitigation.');
    }
    if (!Number.isFinite(expires.getTime()) || expires <= now || lifetimeDays > 30 || lifetimeDays < 0) {
      throw new Error(`Invalid or expired audit exception: ${entry.advisory}`);
    }
    valid.set(entry.advisory, entry);
  }
  return valid;
}
