import { describe, expect, it, vi } from 'vitest';

import { createMetaTemplateStore, fetchMetaTemplates, syncMetaTemplates } from './meta-template-sync';

const first = {
  data: [{
    id: 'meta-1', name: 'aviso_vencimiento', language: 'es', status: 'APPROVED', category: 'UTILITY',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Aviso' },
      { type: 'BODY', text: 'Hola {{1}}, {{2}} y {{1}}' },
      { type: 'FOOTER', text: 'MovieTime' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Renovar' }, { type: 'URL', text: 'Sitio' }] },
    ],
  }],
  paging: { next: 'https://graph.facebook.com/v23.0/123/message_templates?after=next' },
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('Meta template sync', () => {
  it('fetches all pages and normalizes the components', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(first))
      .mockResolvedValueOnce(response({ data: [{
        id: 'meta-2', name: 'vence_hoy', language: 'es', status: 'PENDING', category: 'UTILITY',
        components: [{ type: 'BODY', text: 'Paga hoy' }],
      }] }));
    const result = await fetchMetaTemplates('123', 'access-token', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://graph.facebook.com/v23.0/123/message_templates?fields=name,language,status,category,components,id&limit=100');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer access-token');
    expect(result).toEqual([
      { name: 'aviso_vencimiento', language: 'es', status: 'APPROVED', category: 'UTILITY', body: 'Hola {{1}}, {{2}} y {{1}}',
        header: 'Aviso', footer: 'MovieTime', buttons: [{ type: 'QUICK_REPLY', text: 'Renovar' }], param_count: 2, meta_template_id: 'meta-1' },
      { name: 'vence_hoy', language: 'es', status: 'PENDING', category: 'UTILITY', body: 'Paga hoy',
        header: null, footer: null, buttons: [], param_count: 0, meta_template_id: 'meta-2' },
    ]);
  });

  it('does not touch the cache if a later page fails', async () => {
    const store = { replaceSnapshot: vi.fn() };
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(first)).mockResolvedValueOnce(response({}, 503));
    await expect(syncMetaTemplates('123', 'access-token', store, fetchImpl)).rejects.toThrow('HTTP 503');
    expect(store.replaceSnapshot).not.toHaveBeenCalled();
  });

  it('rejects pagination to another origin before sending the token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ data: [], paging: { next: 'https://elsewhere.test/steal' } }));
    await expect(fetchMetaTemplates('123', 'access-token', fetchImpl)).rejects.toThrow('pagination URL');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('upserts the snapshot before retiring missing templates', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const lt = vi.fn().mockReturnValue({ eq });
    const update = vi.fn().mockReturnValue({ lt });
    const client = { from: vi.fn().mockReturnValue({ upsert, update }) };
    const store = createMetaTemplateStore(client as never);
    await store.replaceSnapshot([{ name: 'x', language: 'es', status: 'APPROVED', category: 'UTILITY', body: '',
      header: null, footer: null, buttons: [], param_count: 0, meta_template_id: '1' }], '2026-09-28T12:00:00Z');
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ name: 'x', retired: false })], { onConflict: 'name,language' });
    expect(lt).toHaveBeenCalledWith('synced_at', '2026-09-28T12:00:00Z');
    expect(eq).toHaveBeenCalledWith('retired', false);
  });

  it('does not retire existing templates when the upsert fails', async () => {
    const update = vi.fn();
    const client = { from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { code: 'DB_ERROR' } }), update,
    }) };
    const store = createMetaTemplateStore(client as never);
    await expect(store.replaceSnapshot([{ name: 'x', language: 'es', status: 'APPROVED', category: 'UTILITY', body: '',
      header: null, footer: null, buttons: [], param_count: 0, meta_template_id: '1' }], '2026-09-28T12:00:00Z'))
      .rejects.toThrow('DB_ERROR');
    expect(update).not.toHaveBeenCalled();
  });
});
