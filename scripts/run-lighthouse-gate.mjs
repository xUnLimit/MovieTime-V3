import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const config = JSON.parse(readFileSync(new URL('../lighthouserc.json', import.meta.url), 'utf8'));
const assertions = Object.entries(config.ci.assert.assertions)
  .filter(([name]) => name.startsWith('categories:'))
  .map(([name, [, { minScore }]]) => ({ category: name.slice('categories:'.length), minScore }));
const configuredUrl = new URL(config.ci.collect.url[0]);
const localPort = '3212';
configuredUrl.port = localPort;
const targetUrl = process.env.LIGHTHOUSE_URL || configuredUrl.href;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHeaders = bypassSecret
  ? { 'x-vercel-protection-bypass': bypassSecret, 'x-vercel-set-bypass-cookie': 'true' }
  : undefined;
const chromePath = process.env.CHROME_PATH || chromium.executablePath();

let server;
let chrome;
let chromeProfile;

try {
  if (!existsSync(chromePath)) {
    throw new Error('Chromium is missing. Run: npx playwright install chromium');
  }

  if (!process.env.LIGHTHOUSE_URL) {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', localPort], {
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_URL: configuredUrl.origin,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'lighthouse-anon-placeholder-0000',
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'lighthouse-vapid-public-placeholder',
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || 'lighthouse-vapid-private-placeholder',
        PUSH_CRON_SECRET: process.env.PUSH_CRON_SECRET || 'lighthouse-cron-secret-placeholder',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'lighthouse-service-role-placeholder',
      },
    });
    await waitForHealth(new URL('/api/health', configuredUrl).href, server);
  }

  const profileRoot = resolve('.next');
  chromeProfile = mkdtempSync(join(profileRoot, 'lighthouse-chrome-'));
  if (!resolve(chromeProfile).startsWith(profileRoot + sep)) {
    throw new Error('Chromium profile escaped the build directory.');
  }
  chrome = await launch({
    chromePath,
    chromeFlags: ['--headless', '--no-sandbox'],
    userDataDir: chromeProfile,
  });
  const results = [];

  for (let run = 0; run < config.ci.collect.numberOfRuns; run += 1) {
    const result = await lighthouse(targetUrl, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: assertions.map(({ category }) => category),
      extraHeaders,
    });
    if (!result) throw new Error(`Lighthouse returned no result for run ${run + 1}.`);
    results.push(result.lhr);
    console.log(`Lighthouse run ${run + 1}: ${assertions.map(({ category }) =>
      `${category} ${Math.round(result.lhr.categories[category].score * 100)}`).join(', ')}`);
  }

  for (const { category, minScore } of assertions) {
    const scores = results.map((result) => result.categories[category].score).sort((a, b) => a - b);
    const median = scores[Math.floor(scores.length / 2)];
    if (median < minScore) {
      const report = results[Math.floor(results.length / 2)];
      const failedAudits = report.categories[category].auditRefs
        .filter(({ id, weight }) => weight > 0 && report.audits[id]?.score === 0)
        .map(({ id }) => id);
      console.error(`${category} failed: median ${median} < ${minScore}; failed audits: ${failedAudits.join(', ')}`);
      process.exitCode = 1;
    }
  }
} finally {
  try {
    await chrome?.kill();
    if (chromeProfile) {
      await rm(chromeProfile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
  } finally {
    terminateServer(server);
  }
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
