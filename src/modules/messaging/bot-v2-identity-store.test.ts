import { describe, expect, it, vi } from 'vitest';
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));
import { createBotV2IdentityStore } from './bot-v2-identity-store';

const ID = '11111111-1111-4111-8111-111111111111';
const WA = '50760000000';
function setup() {
  const client = {
    people: vi.fn(async () => ({ data: [{ id: ID }], error: null })),
    sale: vi.fn(async () => ({ data: { servicio_id: ID, servicio_correo: 'mail@example.test', perfil_nombre: 'Ana', acceso_por_codigo: true }, error: null })),
    service: vi.fn(async () => ({ data: { activo: true, acceso_por_codigo: true, categorias: { code_provider: 'netflix' } }, error: null })),
    categories: vi.fn(async () => ({ data: [{ categoria_id: ID }], error: null })),
    orders: vi.fn(async () => ({ data: [{ id: ID }], error: null })),
    taps: vi.fn(async () => ({ data: 5, error: null })),
  };
  return { client, store: createBotV2IdentityStore(client) };
}
describe('v2 sale identity boundary', () => {
  it('uses the single active wa_id customer and binds the requested sale to that customer', async () => {
    const { client, store } = setup();
    expect(await store.codeSale(WA, ID)).toEqual({ serviceId: ID, email: 'mail@example.test', profiles: ['Ana'], providerKey: 'netflix' });
    expect(client.people).toHaveBeenCalledWith(WA);
    expect(client.sale).toHaveBeenCalledWith(ID, ID);
    expect(await store.context(WA)).toEqual({ activeCategories: [ID], pendingOrder: true });
    expect(await store.requestsSince(WA, '2026-10-04T04:00:00Z')).toBe(5);
  });
  it('validates the sale ID before querying and rejects ambiguous/unknown customers', async () => {
    const { client, store } = setup();
    await expect(store.codeSale(WA, 'invalid')).rejects.toThrow();
    expect(client.people).not.toHaveBeenCalled();
    client.people.mockResolvedValue({ data: [], error: null });
    expect(await store.codeSale(WA, ID)).toBeNull();
    client.people.mockResolvedValue({ data: [{ id: ID }, { id: ID }], error: null });
    expect(await store.codeSale(WA, ID)).toBeNull();
    expect(client.sale).not.toHaveBeenCalled();
  });
  it.each(['disabled-sale', 'disabled-service', 'inactive', 'unsupported'] as const)('blocks %s', async reason => {
    const { client, store } = setup();
    if (reason === 'disabled-sale') client.sale.mockResolvedValue({ data: { servicio_id: ID, servicio_correo: 'mail@example.test', perfil_nombre: 'Ana', acceso_por_codigo: false }, error: null });
    else client.service.mockResolvedValue({ data: { activo: reason !== 'inactive', acceso_por_codigo: reason !== 'disabled-service', categorias: { code_provider: reason === 'unsupported' ? 'other' : 'netflix' } }, error: null });
    expect(await store.codeSale(WA, ID)).toBeNull();
  });
  it('fails closed on failed database reads and invalid wa IDs', async () => {
    const client = { people: vi.fn(async () => ({ data: null, error: { code: 'offline' } })),
      sale: vi.fn(async () => ({ data: null, error: null })), service: vi.fn(async () => ({ data: null, error: null })),
      categories: vi.fn(async () => ({ data: null, error: null })), orders: vi.fn(async () => ({ data: null, error: null })), taps: vi.fn(async () => ({ data: null, error: null })) };
    const store = createBotV2IdentityStore(client);
    await expect(store.codeSale(WA, ID)).rejects.toThrow('identity lookup');
    await expect(store.codeSale('bad', ID)).rejects.toThrow();
    expect(client.sale).not.toHaveBeenCalled();
  });
});
