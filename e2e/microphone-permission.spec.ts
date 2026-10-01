import { expect, test } from '@playwright/test';

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

test('@smoke allows audio recording on the same origin', async ({ page }) => {
  const response = await page.goto('/login');

  expect(response?.status()).toBe(200);

  const result = await page.evaluate(async () => {
    const policy = 'featurePolicy' in document ? document.featurePolicy : undefined;
    const allowedByPolicy = policy && typeof policy === 'object'
      && 'allowsFeature' in policy && typeof policy.allowsFeature === 'function'
      ? policy.allowsFeature('microphone')
      : null;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    try {
      return { allowedByPolicy, audioTracks: stream.getAudioTracks().length };
    } finally {
      stream.getTracks().forEach((track) => track.stop());
    }
  });

  if (result.allowedByPolicy === null) {
    expect(response?.headers()['permissions-policy']).toContain('microphone=(self)');
  } else {
    expect(result.allowedByPolicy).toBe(true);
  }
  expect(result.audioTracks).toBeGreaterThan(0);
});
