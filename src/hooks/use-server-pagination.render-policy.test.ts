import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const HOOK_FILE = join(process.cwd(), 'src/hooks/use-server-pagination.ts');

describe('useServerPagination render policy', () => {
  it('does not reset pagination state during render', () => {
    const source = readFileSync(HOOK_FILE, 'utf8');

    expect(source).not.toMatch(/if \(signatureChanged\) \{[\s\S]{0,160}setPaginationState/);
  });
});
