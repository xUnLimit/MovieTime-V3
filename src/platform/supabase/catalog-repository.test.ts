import { describe, expect, it, vi } from 'vitest';
import { createCatalogRepository } from './catalog-repository';

const id = '61111111-1111-4111-8111-111111111111';
const timestamp = '2026-10-03T12:00:00Z';
const hold = { id, servicio_id: id, perfil_numero: 1, owner_ref: 'item-1',
  expira_at: timestamp, created_at: timestamp, cerrada_at: null };
const interest = { id, contact_id: '50760000000', categoria_id: id, plan_id: null,
  origen: 'manual', estado: 'avisado', created_at: timestamp, avisado_at: timestamp };
function setup(data: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  return { rpc, repo: createCatalogRepository(rpc) };
}

describe('catalog repository', () => {
  it('reads and validates the typed catalog without silently replacing missing data', async () => {
    const { rpc, repo } = setup([]);
    await expect(repo.list()).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith('catalogo_disponible', {});
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(repo.list()).rejects.toThrow('Respuesta invalida');
  });
  it('reserves with trimmed owner and optional plan, returning null for exhausted stock', async () => {
    const { rpc, repo } = setup([hold]);
    await expect(repo.reserve(id, ' item-1 ', id)).resolves.toEqual(hold);
    expect(rpc).toHaveBeenCalledWith('reservar_perfil', { p_servicio_id: id, p_owner_ref: 'item-1', p_plan_id: id });
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(repo.reserve(id, 'item-1')).resolves.toBeNull();
    expect(rpc).toHaveBeenLastCalledWith('reservar_perfil', { p_servicio_id: id, p_owner_ref: 'item-1', p_plan_id: null });
    rpc.mockResolvedValueOnce({ data: [hold, hold], error: null });
    await expect(repo.reserve(id, 'item-1')).rejects.toThrow('Respuesta invalida');
  });
  it('releases and expires with validated return types', async () => {
    const { rpc, repo } = setup(true);
    await expect(repo.release(id, 'item-1')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('liberar_reserva', { p_reserva_id: id, p_owner_ref: 'item-1' });
    rpc.mockResolvedValueOnce({ data: 2, error: null });
    await expect(repo.expire()).resolves.toBe(2);
    rpc.mockResolvedValueOnce({ data: -1, error: null });
    await expect(repo.expire()).rejects.toThrow('Respuesta invalida');
    rpc.mockResolvedValueOnce({ data: 'true', error: null });
    await expect(repo.release(id, 'item-1')).rejects.toThrow('Respuesta invalida');
  });
  it('registers interests with explicit or default origin and validates IDs', async () => {
    const { rpc, repo } = setup(id);
    await expect(repo.registerInterest('50760000000', id, id, 'manual')).resolves.toBe(id);
    expect(rpc).toHaveBeenCalledWith('registrar_interes', {
      p_contact_id: '50760000000', p_categoria_id: id, p_plan_id: id, p_origen: 'manual',
    });
    await repo.registerInterest('50760000000', id);
    expect(rpc).toHaveBeenLastCalledWith('registrar_interes', {
      p_contact_id: '50760000000', p_categoria_id: id, p_plan_id: null, p_origen: 'catalogo_agotado',
    });
    rpc.mockResolvedValueOnce({ data: 'broken', error: null });
    await expect(repo.registerInterest('50760000000', id)).rejects.toThrow('Respuesta invalida');
  });
  it('claims the exact FIFO bucket and does not retry empty or failed claims', async () => {
    const { rpc, repo } = setup([interest]);
    await expect(repo.nextInterest(id)).resolves.toEqual(interest);
    expect(rpc).toHaveBeenCalledWith('siguiente_interesado', { p_categoria_id: id, p_plan_id: null });
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(repo.nextInterest(id, id)).resolves.toBeNull();
    rpc.mockResolvedValueOnce({ data: [{ ...interest, estado: 'bad' }], error: null });
    await expect(repo.nextInterest(id)).rejects.toThrow('Respuesta invalida');
    expect(rpc).toHaveBeenCalledTimes(3);
  });
  it('rejects untrusted inputs before calling Supabase', async () => {
    const { rpc, repo } = setup();
    await expect(repo.reserve('bad', 'owner')).rejects.toThrow();
    await expect(repo.reserve(id, ' ')).rejects.toThrow();
    await expect(repo.reserve(id, 'owner', 'bad')).rejects.toThrow();
    await expect(repo.release('bad', 'owner')).rejects.toThrow();
    await expect(repo.registerInterest('not-a-contact', id)).rejects.toThrow();
    await expect(repo.registerInterest('5076', 'bad')).rejects.toThrow();
    await expect(repo.registerInterest('5076', id, 'bad')).rejects.toThrow();
    await expect(repo.nextInterest('bad')).rejects.toThrow();
    await expect(repo.nextInterest(id, 'bad')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('hides SQL details and transport failures with a typed public error', async () => {
    const { rpc, repo } = setup();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SQL secret' } });
    await expect(repo.list()).rejects.toMatchObject({ code: 'CATALOG_UNAVAILABLE', message: 'No se pudo operar el catalogo.' });
    rpc.mockRejectedValueOnce(new Error('transport secret'));
    await expect(repo.expire()).rejects.toMatchObject({ code: 'CATALOG_UNAVAILABLE', message: 'No se pudo operar el catalogo.' });
  });
  it('bounds transport waiting without retrying a possibly committed FIFO claim', async () => {
    vi.useFakeTimers();
    try {
      const rpc = vi.fn().mockImplementation(() => new Promise(() => {}));
      const repo = createCatalogRepository(rpc, 100);
      const pending = expect(repo.nextInterest(id)).rejects.toMatchObject({ code: 'CATALOG_UNAVAILABLE' });
      await vi.advanceTimersByTimeAsync(100);
      await pending;
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(() => createCatalogRepository(rpc, 0)).toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
