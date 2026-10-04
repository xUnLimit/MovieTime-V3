import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAutomationControl, postAutomationControl } from './automation-control-client';
afterEach(() => vi.unstubAllGlobals());
describe('private automation API client', () => {
  it('uses bearer authentication, no-store reads and structured JSON commands', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ ok: true, data: 'value', requestId: 'request' }));
    vi.stubGlobal('fetch', fetcher);
    expect(await getAutomationControl('session')).toBe('value');
    expect(fetcher).toHaveBeenCalledWith('/api/automations/control', { headers: { Authorization: 'Bearer session' }, cache: 'no-store' });
    expect(await postAutomationControl('session', { command: 'interest', id: 'i', action: 'pause' })).toBe('value');
    expect(fetcher).toHaveBeenLastCalledWith('/api/automations/control', expect.objectContaining({ method: 'POST',
      headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'interest', id: 'i', action: 'pause' }) }));
  });
  it('preserves safe typed API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'No autorizado' }, requestId: 'request' }, { status: 403 })));
    await expect(getAutomationControl('session')).rejects.toThrow('No autorizado');
  });
});
