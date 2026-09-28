import { describe, expect, it, vi } from 'vitest';

import { createTemplateCatalog } from './template-catalog';

describe('template catalog', () => {
  it('reads only approved nonretired templates by name and language', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { param_count: 4, buttons: [{ type: 'QUICK_REPLY', text: 'Renovar' }] }, error: null });
    const eq = vi.fn().mockReturnThis();
    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq, maybeSingle }) }) };
    const catalog = createTemplateCatalog(client as never);
    await expect(catalog.getApproved('aviso_vencimiento', 'es')).resolves.toEqual({
      paramCount: 4, buttons: [{ type: 'QUICK_REPLY', text: 'Renovar' }],
    });
    expect(eq.mock.calls).toEqual([
      ['name', 'aviso_vencimiento'], ['language', 'es'], ['status', 'APPROVED'], ['retired', false],
    ]);
  });

  it('returns null when no approved row exists', async () => {
    const query = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(query) }) };
    await expect(createTemplateCatalog(client as never).getApproved('unknown', 'es')).resolves.toBeNull();
  });

  it('fails closed when the cache lookup fails', async () => {
    const query = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: 'DB_ERROR' } }) };
    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(query) }) };
    await expect(createTemplateCatalog(client as never).getApproved('aviso', 'es'))
      .rejects.toThrow('DB_ERROR');
  });
});
