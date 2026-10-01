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
  expect(response.headers()['permissions-policy']).toContain('microphone=(self)');
  expect(response.headers()['permissions-policy']).toContain('geolocation=()');
});

test('@smoke applies the browser permissions policy to login', async ({ request }) => {
  const response = await request.get('/login');

  expect(response.status()).toBe(200);
  expect(response.headers()['permissions-policy']).toContain('camera=()');
  expect(response.headers()['permissions-policy']).toContain('microphone=(self)');
  expect(response.headers()['permissions-policy']).toContain('geolocation=()');
});

test('@smoke serves the web app manifest without a redirect loop', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  const manifest = await response.json();

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/manifest+json');
  expect(manifest).toMatchObject({
    name: expect.any(String),
    start_url: '/dashboard',
    display: 'standalone',
  });
});

test('@smoke serves the chat stylesheet used by the current interface', async ({ request }) => {
  const page = await request.get('/chats');
  expect(page.status()).toBe(200);

  const html = await page.text();
  const stylesheets = html.split('<link').slice(1)
    .map((fragment) => fragment.split('>')[0])
    .filter((tag) => tag.includes('rel="stylesheet"'))
    .map((tag) => tag.split('href="')[1]?.split('"')[0])
    .filter((href): href is string => Boolean(href?.includes('.css')));
  expect(stylesheets.length).toBeGreaterThan(0);

  const css = (await Promise.all(stylesheets.map(async (href) => {
    const response = await request.get(href);
    expect(response.status()).toBe(200);
    return response.text();
  }))).join('\n');

  expect(css.includes('.chats-surface'), 'Faltan los estilos del contenedor de Chats').toBe(true);
  expect(css.includes('.bg-chat-bubble-in'), 'Falta el fondo de los mensajes recibidos').toBe(true);
  expect(css.includes('.bg-chat-bubble-out'), 'Falta el fondo de los mensajes enviados').toBe(true);
});

test('@smoke draws the iOS web app under the status bar and compensates with safe areas', async ({ request }) => {
  const response = await request.get('/dashboard');
  const html = await response.text();

  expect(response.status()).toBe(200);
  expect(html).toContain('name="mobile-web-app-capable" content="yes"');
  expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
});

test('@smoke allows zoom on login and preserves the operational viewport', async ({ request }) => {
  const login = await request.get('/login');
  const dashboard = await request.get('/dashboard');
  const viewportTag = (html: string) => html.match(/<meta name="viewport"[^>]*>/)?.[0] ?? '';

  expect(login.status()).toBe(200);
  expect(dashboard.status()).toBe(200);
  expect(viewportTag(await login.text())).toContain('initial-scale=1');
  expect(viewportTag(await login.text())).toContain('maximum-scale=5');
  expect(viewportTag(await login.text())).toContain('user-scalable=yes');
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

test('@smoke serves the public privacy policy without authentication', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/privacidad');
  await expect(page).toHaveURL(/\/privacidad$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();
});

test('@smoke rejects unsigned WhatsApp webhook deliveries', async ({ request }) => {
  const response = await request.post('/api/whatsapp/webhook', {
    data: { object: 'whatsapp_business_account', entry: [] },
  });

  expect([401, 503]).toContain(response.status());
});

test('@a11y privacy policy has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/privacidad');
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test('@performance privacy policy meets the local navigation budget', async ({ page }) => {
  await page.goto('/privacidad');
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();

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

test('@smoke rejects WhatsApp sends without an admin session', async ({ request }) => {
  const response = await request.post('/api/whatsapp/messages', {
    data: { idempotencyKey: '5b0f3c3e-8d8f-4c55-9a4b-3c9f1a2b7d10', to: '50760000000', message: { kind: 'text', text: 'Hola' } },
  });

  expect(response.status()).toBe(401);
});
