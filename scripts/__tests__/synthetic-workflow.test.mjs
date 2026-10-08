import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/synthetic.yml', 'utf8');

describe('production synthetic monitoring', () => {
  it('reads PRODUCTION_URL from the production environment', () => {
    const productionJob = workflow.split('  production:')[1];
    expect(productionJob).toMatch(/^    environment: production$/m);
    expect(productionJob).toContain('PRODUCTION_URL: ${{ vars.PRODUCTION_URL }}');
  });
});
