const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!bypassSecret) {
  throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required for staged Lighthouse checks');
}

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless',
        extraHeaders: {
          'x-vercel-protection-bypass': bypassSecret,
          'x-vercel-set-bypass-cookie': 'true',
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
