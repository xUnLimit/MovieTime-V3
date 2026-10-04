import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ overrides: vi.fn(), updatedAt: vi.fn(), rpc: vi.fn(), client: vi.fn() }));
vi.mock('@/modules/commerce-copy/store', () => ({ createCommerceCopyStore: () => ({ overrides: mocks.overrides, updatedAt: mocks.updatedAt }) }));
vi.mock('@/platform/server/supabase-server', () => ({ createUserRequestClient: mocks.client }));
import { readCommerceCopyUseCase, saveCommerceCopyUseCase } from './commerce-copy-server-use-case';
beforeEach(() => {
  vi.clearAllMocks(); mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.overrides.mockResolvedValue({ greeting: 'Hola' }); mocks.updatedAt.mockResolvedValue({ greeting: '2026-10-08T10:00:00Z' });
  mocks.rpc.mockResolvedValue({ data: 'greeting', error: null });
});
describe('commerce copy server use cases', () => {
  it('devuelve los textos editados y cuando se editaron', async () => {
    expect(await readCommerceCopyUseCase()).toEqual({ overrides: { greeting: 'Hola' }, updatedAt: { greeting: '2026-10-08T10:00:00Z' } });
  });
  it('guarda y restaura con la sesion del administrador', async () => {
    expect(await saveCommerceCopyUseCase({ key: 'greeting', text: 'Buenas' }, 'Bearer admin')).toBe('greeting');
    expect(mocks.client).toHaveBeenCalledWith('Bearer admin');
    expect(mocks.rpc).toHaveBeenCalledWith('mt_set_commerce_copy', { p_key: 'greeting', p_text: 'Buenas' });
    await saveCommerceCopyUseCase({ key: 'greeting', text: null }, 'Bearer admin');
    expect(mocks.rpc).toHaveBeenLastCalledWith('mt_set_commerce_copy', { p_key: 'greeting', p_text: null });
  });
  it('oculta el detalle de la base cuando falla', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'forbidden SQL detail' } });
    await expect(saveCommerceCopyUseCase({ key: 'greeting', text: 'Hola' }, 'Bearer user')).rejects.toThrow('No se pudo guardar el texto.');
    mocks.rpc.mockResolvedValue({ data: 42, error: null });
    await expect(saveCommerceCopyUseCase({ key: 'greeting', text: 'Hola' }, 'Bearer user')).rejects.toThrow();
  });
});
