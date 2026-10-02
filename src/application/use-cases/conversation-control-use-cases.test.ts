import { it, expect, vi } from 'vitest';
import { createConversationControlUseCases } from './conversation-control-use-cases';
it('authorizes each operation before repository access and validates identifiers', async () => {
  const repository = { owner: vi.fn().mockResolvedValue('bot'), change: vi.fn() };
  const useCases = createConversationControlUseCases(repository);
  for (const role of [undefined, 'vendedor']) {
    await expect(useCases.owner(role, '50760000001')).rejects.toThrow('administradores');
    await expect(useCases.change(role, '50760000001', 'humano')).rejects.toThrow('administradores');
  }
  expect(repository.owner).not.toHaveBeenCalled(); expect(repository.change).not.toHaveBeenCalled();
  await expect(useCases.owner('admin', 'bad')).rejects.toThrow();
  expect(await useCases.owner('admin', '50760000001')).toBe('bot');
  await useCases.change('admin', '50760000001', 'humano');
  await useCases.change('admin', '50760000001', 'bot');
  expect(repository.change).toHaveBeenLastCalledWith('50760000001', 'bot');
  repository.owner.mockResolvedValueOnce(null); expect(await useCases.owner('admin', '50760000001')).toBeNull();
  repository.change.mockRejectedValueOnce(new Error('Unavailable'));
  await expect(useCases.change('admin', '50760000001', 'bot')).rejects.toThrow('Unavailable');
});
