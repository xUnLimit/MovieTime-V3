import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const secretPatterns = [
  {
    name: 'private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    name: 'Supabase service role JWT',
    pattern: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]*cm9sZSI6InNlcnZpY2Vfcm9sZSI[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{20,}/,
  },
  {
    name: 'hardcoded secret assignment',
    pattern: /\b(?:api[_-]?key|secret|token|password|passwd|pwd|private[_-]?key)\b\s*[:=]\s*["'][^"'\n]{16,}["']/i,
  },
  {
    name: 'VAPID private key',
    pattern: /\bVAPID_PRIVATE_KEY\s*=\s*(?:"[^"'\s]{24,}"|'[^"'\s]{24,}'|[A-Za-z0-9_-]{24,})/,
  },
  {
    name: 'service role key',
    pattern: /\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY)\s*=\s*(?:"[^"'\s]{24,}"|'[^"'\s]{24,}'|[A-Za-z0-9_-]{24,})/,
  },
];

const ignoredPaths = [
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^scripts\/scan-secrets\.mjs$/,
];

function getStagedFiles() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
    encoding: 'utf8',
  });

  return output
    .split('\0')
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => !ignoredPaths.some((ignored) => ignored.test(path.replaceAll('\\', '/'))));
}

function getWorkingTreeFiles() {
  const tracked = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', '-z'], {
    encoding: 'utf8',
  });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8',
  });

  return [...tracked.split('\0'), ...untracked.split('\0')]
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => !ignoredPaths.some((ignored) => ignored.test(path.replaceAll('\\', '/'))));
}

function getStagedContent(path) {
  try {
    return execFileSync('git', ['show', `:${path}`], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function getWorkingTreeContent(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

const findings = [];

function scanContent(scope, file, content) {
  if (content.includes('\0')) return;

  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const { name, pattern } of secretPatterns) {
      if (pattern.test(line)) {
        findings.push(`${scope}:${file}:${index + 1} possible ${name}`);
      }
    }
  }
}

for (const file of getStagedFiles()) {
  scanContent('staged', file, getStagedContent(file));
}

for (const file of getWorkingTreeFiles()) {
  scanContent('working-tree', file, getWorkingTreeContent(file));
}

if (findings.length > 0) {
  console.error('Secret scan failed. Review these lines before committing:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}
