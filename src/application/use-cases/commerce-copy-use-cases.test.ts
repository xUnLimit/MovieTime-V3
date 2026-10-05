import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn() }));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: mocks.session }));
vi.mock('@/platform/api/commerce-copy-client', () => ({ getCommerceCopy: mocks.get }));
import * as useCases from './commerce-copy-use-cases';

beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ access_token: 'session' }); mocks.get.mockResolvedValue({ overrides: {}, updatedAt: {} }); });

describe('commerce copy browser use cases', () => {
  it('lee los textos con la sesión actual', async () => {
    await expect(useCases.fetchCommerceCopyUseCase()).resolves.toEqual({ overrides: {}, updatedAt: {} });
    expect(mocks.get).toHaveBeenCalledWith('session');
  });
  it('sin sesión no consulta nada y pide iniciar sesión', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(useCases.fetchCommerceCopyUseCase()).rejects.toThrow('Inicia sesión');
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it('ya no ofrece guardar textos fuera del recorrido', () => {
    expect(Object.keys(useCases)).toEqual(['fetchCommerceCopyUseCase']);
  });
});
