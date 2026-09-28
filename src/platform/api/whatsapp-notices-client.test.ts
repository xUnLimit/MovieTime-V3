import { afterEach, describe, expect, it, vi } from 'vitest';

import { postWhatsAppNotices } from './whatsapp-notices-client';

afterEach(() => vi.unstubAllGlobals());

describe('postWhatsAppNotices', () => {
  it('posts tipo and ventaIds with the bearer token and returns the results', async () => {
    const results = [{ noticeId: 'n1', clienteNombre: 'Ana', ventaIds: ['v1'], status: 'accepted', channel: 'template', waId: '50760000000' }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, requestId: 'r', data: { results } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = { tipo: 'dia_pago' as const, ventaIds: ['v1'] };

    await expect(postWhatsAppNotices('tok', body)).resolves.toEqual({ results });
    expect(fetchMock).toHaveBeenCalledWith('/api/whatsapp/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify(body),
    });
  });

  it('surfaces the public API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false, requestId: 'r', error: { code: 'NOT_CONFIGURED', message: 'No configurado.' },
    }), { status: 503 })));
    await expect(postWhatsAppNotices('t', { tipo: 'dia_pago', ventaIds: ['v'] }))
      .rejects.toMatchObject({ status: 503, code: 'NOT_CONFIGURED' });
  });
});
