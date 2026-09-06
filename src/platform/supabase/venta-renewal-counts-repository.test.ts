import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), in: vi.fn() }));
vi.mock('./client', () => ({ supabase: { from: mocks.from } }));
import { readVentaRenewalCounts } from './venta-renewal-counts-repository';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ in: mocks.in });
  mocks.in.mockResolvedValue({ data: [], error: null });
});

describe('venta renewal counts', () => {
  it('reads only the live SQL count for each sale, deduplicating IDs', async () => {
    mocks.in.mockResolvedValue({ data: [{ id: 'sale-1', renovaciones: 3 }, { id: 'sale-2', renovaciones: 0 }], error: null });
    expect(await readVentaRenewalCounts(['sale-1', 'sale-2', 'sale-1'])).toEqual([
      { id: 'sale-1', renovaciones: 3 }, { id: 'sale-2', renovaciones: 0 },
    ]);
    expect(mocks.from).toHaveBeenCalledWith('v_ventas_full');
    expect(mocks.select).toHaveBeenCalledWith('id, renovaciones');
    expect(mocks.in).toHaveBeenCalledExactlyOnceWith('id', ['sale-1', 'sale-2']);
  });
  it('does not query for an empty page', async () => {
    expect(await readVentaRenewalCounts([])).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('chunks large pages instead of exceeding API limits', async () => {
    await readVentaRenewalCounts(Array.from({ length: 205 }, (_, i) => `sale-${i}`));
    expect(mocks.in.mock.calls.map(call => call[1].length)).toEqual([100, 100, 5]);
  });
  it('propagates read errors rather than reporting a false zero', async () => {
    mocks.in.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
    await expect(readVentaRenewalCounts(['sale-1'])).rejects.toThrow('Unavailable');
  });
});
