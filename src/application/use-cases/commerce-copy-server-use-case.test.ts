import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ overrides: vi.fn(), updatedAt: vi.fn() }));
vi.mock('@/modules/commerce-copy/store', () => ({ createCommerceCopyStore: () => ({ overrides: mocks.overrides, updatedAt: mocks.updatedAt }) }));
import * as useCases from './commerce-copy-server-use-case';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.overrides.mockResolvedValue({ greeting: 'Hola' }); mocks.updatedAt.mockResolvedValue({ greeting: '2026-10-08T10:00:00Z' });
});
describe('commerce copy server use cases', () => {
  it('devuelve los textos editados y cuando se editaron', async () => {
    expect(await useCases.readCommerceCopyUseCase()).toEqual({ overrides: { greeting: 'Hola' }, updatedAt: { greeting: '2026-10-08T10:00:00Z' } });
  });
  it('solo lee: guardar textos de compras ya no pasa por aqui', () => {
    expect(Object.keys(useCases)).toEqual(['readCommerceCopyUseCase']);
  });
  it('propaga el error controlado del almacen', async () => {
    mocks.overrides.mockRejectedValue(new Error('No se pudieron leer los textos de compras.'));
    await expect(useCases.readCommerceCopyUseCase()).rejects.toThrow('No se pudieron leer');
  });
});
