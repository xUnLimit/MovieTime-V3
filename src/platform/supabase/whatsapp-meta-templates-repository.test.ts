import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ result: { data: [] as unknown[] | null, error: null as Error | null }, order: vi.fn() }));
vi.mock('./client', () => ({
  supabase: { from: () => ({ select: () => ({ order: state.order }) }) },
}));

import { listMetaTemplateRows } from './whatsapp-meta-templates-repository';

describe('whatsapp meta templates repository', () => {
  beforeEach(() => {
    state.order.mockImplementation(() => Promise.resolve(state.result));
  });

  it('returns cached rows ordered by name', async () => {
    state.result = { data: [{ name: 'a' }], error: null };
    await expect(listMetaTemplateRows()).resolves.toEqual([{ name: 'a' }]);
    expect(state.order).toHaveBeenCalledWith('name');
  });

  it('returns an empty list without data and throws on errors', async () => {
    state.result = { data: null, error: null };
    await expect(listMetaTemplateRows()).resolves.toEqual([]);
    state.result = { data: null, error: new Error('boom') };
    await expect(listMetaTemplateRows()).rejects.toThrow('boom');
  });
});
