import { describe, expect, it } from 'vitest';

import { z } from './zod';

describe('configured Zod', () => {
  it('keeps runtime validation in CSP-safe jitless mode', () => {
    expect(z.config().jitless).toBe(true);
    expect(z.object({ status: z.literal('ok') }).parse({ status: 'ok' })).toEqual({
      status: 'ok',
    });
  });
});
