const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!bypassSecret) {
  throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required for staged Lighthouse checks');
}

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      puppeteerScript: './scripts/lighthouse-vercel-auth.cjs',
      puppeteerLaunchOptions: { args: ['--no-sandbox'] },
      settings: {
        extraHeaders: {
          'x-vercel-protection-bypass': bypassSecret,
        },
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
