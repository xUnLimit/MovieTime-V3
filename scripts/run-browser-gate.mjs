import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localPort = process.env.BROWSER_GATE_PORT || '3210';
const baseUrl = externalBaseUrl || `http://127.0.0.1:${localPort}`;
let server;

try {
  if (!externalBaseUrl) {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', localPort], {
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_URL: baseUrl,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'browser-gate-anon-placeholder-0000',
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'browser-gate-vapid-public-placeholder',
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || 'browser-gate-vapid-private-placeholder',
        PUSH_CRON_SECRET: process.env.PUSH_CRON_SECRET || 'browser-gate-cron-secret',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'browser-gate-service-role-placeholder',
      },
    });
    await waitForHealth(`${baseUrl}/api/health`, server);
  }

  const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
  const testProcess = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
  });
  const exitCode = await new Promise((resolve, reject) => {
    testProcess.once('error', reject);
    testProcess.once('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
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
      execFileSync('taskkill', ['/pid', String(processHandle.pid), '/T', '/F'], { stdio: 'ignore' });
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
