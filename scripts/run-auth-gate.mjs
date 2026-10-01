import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildPlaywrightArgs,
  buildServerEnv,
  missingE2eVars,
  missingE2eVarsMessage,
  resolvePort,
  resolveTaskkillExecutable,
} from './lib/auth-gate.mjs';

// Gate E2E autenticado: arranca `next start` (build de produccion previo, con las NEXT_PUBLIC_*
// de Supabase local ya horneadas) y ejecuta Playwright contra el. No usa placeholders.
const missing = missingE2eVars(process.env);
if (missing.length > 0) {
  console.error(missingE2eVarsMessage(missing));
  process.exit(1);
}

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localPort = resolvePort(process.env);
const baseUrl = externalBaseUrl || `http://127.0.0.1:${localPort}`;
const { args, visual } = buildPlaywrightArgs(process.argv.slice(2));
let server;

try {
  if (!externalBaseUrl) {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', localPort], {
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: buildServerEnv(process.env, baseUrl),
    });
    await waitForHealth(`${baseUrl}/api/health`, server);
  }

  const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
  const testProcess = spawn(process.execPath, [cli, ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseUrl,
      ...(visual ? { VISUAL_SNAPSHOTS: '1' } : {}),
    },
  });
  process.exitCode = await new Promise((resolve, reject) => {
    testProcess.once('error', reject);
    testProcess.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  terminateServer(server);
}

async function waitForHealth(url, processHandle) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error('Next.js exited before becoming healthy.');
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function terminateServer(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  if (process.platform === 'win32') {
    try {
      execFileSync(resolveTaskkillExecutable(), ['/pid', String(processHandle.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      processHandle.kill();
    }
    return;
  }
  try {
    process.kill(-processHandle.pid, 'SIGTERM');
  } catch {
    processHandle.kill('SIGTERM');
  }
}
