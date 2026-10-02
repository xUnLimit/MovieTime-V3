import { beforeEach, describe, expect, it, vi } from 'vitest';
const fakes = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: () => ({ rpc: fakes.rpc }) }));
import { createBotCatalogStore } from './bot-catalog-store';

const ID = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); });
describe('bot catalog adapter', () => {
  it('awaits the generated-client RPC results and exposes only catalog and interest', async () => {
    const store = createBotCatalogStore();
    fakes.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await store.list()).toEqual([]);
    expect(fakes.rpc).toHaveBeenCalledWith('catalogo_disponible', {});
    fakes.rpc.mockResolvedValueOnce({ data: ID, error: null });
    expect(await store.registerInterest('50760000000', ID, ID)).toBe(ID);
    expect(fakes.rpc).toHaveBeenCalledWith('registrar_interes', {
      p_contact_id: '50760000000', p_categoria_id: ID, p_plan_id: ID, p_origen: 'catalogo_agotado',
    });
    expect(Object.keys(store)).toEqual(['list', 'registerInterest']);
  });
  it('rejects invalid contacts before sending and translates RPC errors', async () => {
    const store = createBotCatalogStore();
    await expect(store.registerInterest('bad', ID)).rejects.toThrow();
    expect(fakes.rpc).not.toHaveBeenCalled();
    fakes.rpc.mockResolvedValueOnce({ data: null, error: { message: 'private SQL' } });
    await expect(store.list()).rejects.toThrow('No se pudo operar el catalogo.');
  });
});
