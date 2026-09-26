import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

type CspViolation = {
  blockedUri: string;
  directive: string;
};

declare global {
  interface Window {
    __cspViolations?: CspViolation[];
  }
}

test('@smoke exposes a minimal health endpoint with production headers', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['strict-transport-security']).toContain('max-age=63072000');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response.headers()['permissions-policy']).toContain('camera=()');
});

test('@smoke serves the web app manifest without a redirect loop', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  const manifest = await response.json();

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/manifest+json');
  expect(manifest).toMatchObject({
    name: expect.any(String),
    start_url: '/dashboard',
  });
});

test('@smoke preserves the mobile zoom policy on login and operational routes', async ({ request }) => {
  const login = await request.get('/login');
  const dashboard = await request.get('/dashboard');
  const viewportTag = (html: string) => html.match(/<meta name="viewport"[^>]*>/)?.[0] ?? '';

  expect(login.status()).toBe(200);
  expect(dashboard.status()).toBe(200);
  expect(viewportTag(await login.text())).toContain('initial-scale=1');
  expect(viewportTag(await login.text())).toContain('maximum-scale=1');
  expect(viewportTag(await login.text())).toContain('user-scalable=no');
  expect(viewportTag(await dashboard.text())).toContain('maximum-scale=1');
  expect(viewportTag(await dashboard.text())).toContain('user-scalable=no');
});

test('@smoke does not attempt CSP-blocked dynamic code evaluation', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations?.push({
        blockedUri: event.blockedURI,
        directive: event.effectiveDirective,
      });
    });
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const dynamicEvaluationViolations = await page.evaluate(() =>
    (window.__cspViolations ?? []).filter(
      ({ blockedUri, directive }) =>
        directive === 'script-src' && (blockedUri === 'eval' || blockedUri === 'inline'),
    ),
  );

  expect(dynamicEvaluationViolations).toEqual([]);
});

test('@smoke rejects a protected API without authentication', async ({ request }) => {
  const response = await request.post('/api/push/pending', {
    data: { endpoint: 'https://push.example/subscription' },
  });

  expect(response.status()).toBe(401);
});

test('@smoke redirects an anonymous dashboard visitor to login', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
});

test('@a11y login has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test('@performance login meets the local navigation budget', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();

  const timing = await page.evaluate(() => {
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
      load: navigation.loadEventEnd - navigation.startTime,
    };
  });

  expect(timing.domContentLoaded).toBeLessThanOrEqual(2_500);
  expect(timing.load).toBeLessThanOrEqual(4_000);
});
