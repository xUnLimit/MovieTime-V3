import { afterEach, describe, expect, it, vi } from 'vitest';
import { commerceCanvasEnabled } from './commerce-flow';

afterEach(() => vi.unstubAllEnvs());

describe('commerceCanvasEnabled', () => {
  it('is off by default and only the exact value "true" turns it on', () => {
    vi.stubEnv('COMMERCE_FLOW_CANVAS_ENABLED', '');
    expect(commerceCanvasEnabled()).toBe(false);
    for (const value of ['1', 'TRUE', 'yes', 'false']) {
      vi.stubEnv('COMMERCE_FLOW_CANVAS_ENABLED', value);
      expect(commerceCanvasEnabled()).toBe(false);
    }
    vi.stubEnv('COMMERCE_FLOW_CANVAS_ENABLED', 'true');
    expect(commerceCanvasEnabled()).toBe(true);
  });
});
