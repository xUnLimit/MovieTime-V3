import { afterEach, describe, expect, it, vi } from 'vitest';
import { flowExtensionsEnabled } from './flow-extensions';

afterEach(() => vi.unstubAllEnvs());

describe('flowExtensionsEnabled', () => {
  it('is off by default and only the exact value "true" turns it on', () => {
    vi.stubEnv('FLOW_EXTENSIONS_ENABLED', '');
    expect(flowExtensionsEnabled()).toBe(false);
    for (const value of ['1', 'TRUE', 'yes', 'false']) {
      vi.stubEnv('FLOW_EXTENSIONS_ENABLED', value);
      expect(flowExtensionsEnabled()).toBe(false);
    }
    vi.stubEnv('FLOW_EXTENSIONS_ENABLED', 'true');
    expect(flowExtensionsEnabled()).toBe(true);
  });
});
