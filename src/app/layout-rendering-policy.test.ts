import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT_LAYOUT = join(process.cwd(), 'src/app/layout.tsx');

describe('root layout rendering policy', () => {
  it('does not force every route under the app root to be dynamic', () => {
    const source = readFileSync(ROOT_LAYOUT, 'utf8');

    expect(source).not.toMatch(/from ['"]next\/headers['"]/);
    expect(source).not.toContain("dynamic = 'force-dynamic'");
    expect(source).not.toContain('dynamic = "force-dynamic"');
  });
});
