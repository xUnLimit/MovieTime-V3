// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { config } from 'dotenv';
import { afterEach, describe, expect, it } from 'vitest';

const roots = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'movietime-dotenv-'));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    const localPath = relative(tmpdir(), root);
    if (!localPath.startsWith('movietime-dotenv-') || localPath.includes('..')) {
      throw new Error('El fixture debe permanecer en el directorio temporal.');
    }
    rmSync(root, { recursive: true, force: true });
  }
});

describe('script environment loading with dotenv 18', () => {
  it('preserves external values, then local values, then fallback values', () => {
    const root = fixture();
    writeFileSync(join(root, '.env.local'), 'EXTERNAL=local\nSHARED=local\nLOCAL_ONLY=yes\n');
    writeFileSync(join(root, '.env'), 'EXTERNAL=fallback\nSHARED=fallback\nFALLBACK_ONLY=yes\n');
    const environment = { EXTERNAL: 'external' };
    expect(config({ path: join(root, '.env.local'), quiet: true, processEnv: environment }).error).toBeUndefined();
    expect(config({ path: join(root, '.env'), quiet: true, processEnv: environment }).error).toBeUndefined();
    expect(environment).toEqual({ EXTERNAL: 'external', SHARED: 'local', LOCAL_ONLY: 'yes', FALLBACK_ONLY: 'yes' });
  });

  it('still loads the fallback when the optional local file is absent', () => {
    const root = fixture();
    writeFileSync(join(root, '.env'), 'FALLBACK_ONLY=yes\n');
    const environment = {};
    const local = config({ path: join(root, '.env.local'), quiet: true, processEnv: environment });
    expect(local.error?.code).toBe('ENOENT');
    expect(config({ path: join(root, '.env'), quiet: true, processEnv: environment }).error).toBeUndefined();
    expect(environment).toEqual({ FALLBACK_ONLY: 'yes' });
  });
});
