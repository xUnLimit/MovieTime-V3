import { describe, expect, it, vi } from 'vitest';

const from = vi.hoisted(() => vi.fn());
vi.mock('@/platform/supabase/client', () => ({ supabase: { from } }));

import { currencyService } from './index';

describe('services public API', () => {
  it('converts USD through the exported production service without consulting remote rates', async () => {
    await expect(currencyService.convertToUSD(37.25, 'USD')).resolves.toBe(37.25);
    expect(from).not.toHaveBeenCalled();
  });
});
