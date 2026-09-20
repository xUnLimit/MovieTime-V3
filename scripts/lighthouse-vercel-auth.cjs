module.exports = async (browser, context) => {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  if (!bypassSecret) {
    throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required for Lighthouse authentication');
  }

  const page = await browser.newPage();

  try {
    await page.setExtraHTTPHeaders({
      'x-vercel-protection-bypass': bypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    });
    const response = await page.goto(context.url, { waitUntil: 'domcontentloaded' });

    if (!response || !response.ok()) {
      throw new Error('Unable to authenticate Lighthouse against the staged deployment');
    }
  } finally {
    await page.close();
  }
};
