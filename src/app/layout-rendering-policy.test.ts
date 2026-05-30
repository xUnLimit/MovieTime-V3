import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT_LAYOUT = join(process.cwd(), 'src/app/layout.tsx');
const PROXY = join(process.cwd(), 'src/proxy.ts');

describe('root layout rendering policy', () => {
  it('keeps the root dynamic when CSP uses a per-request script nonce', () => {
    const layoutSource = readFileSync(ROOT_LAYOUT, 'utf8');
    const proxySource = readFileSync(PROXY, 'utf8');

    expect(proxySource).toContain("'strict-dynamic'");
    expect(proxySource).toContain("'nonce-${nonce}'");
    expect(layoutSource).toMatch(/from ['"]next\/headers['"]/);
    expect(layoutSource).toMatch(/dynamic\s*=\s*['"]force-dynamic['"]/);
  });
});
