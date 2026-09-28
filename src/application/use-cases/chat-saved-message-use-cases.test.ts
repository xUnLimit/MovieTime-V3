import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptySavedMessageDraft } from '@/modules/whatsapp/saved-messages';

const repository = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('@/platform/supabase/chat-saved-messages-repository', () => ({
  listChatSavedMessages: repository.list,
  createChatSavedMessage: repository.create,
  updateChatSavedMessage: repository.update,
  deleteChatSavedMessage: repository.remove,
}));

import { deleteSavedMessageUseCase, listSavedMessagesUseCase, saveSavedMessageUseCase } from './chat-saved-message-use-cases';

const id = '11111111-1111-4111-8111-111111111111';
const row = {
  id, title: 'Planes', kind: 'list', body: 'Elige tu plan', button_label: 'Ver planes',
  options: [{ title: 'Mensual', description: 'Un mes' }],
  created_by: '22222222-2222-4222-8222-222222222222',
  created_at: '2026-09-27T00:00:00Z', updated_at: '2026-09-27T00:00:00Z',
};

beforeEach(() => Object.values(repository).forEach((mock) => mock.mockReset()));

describe('shared chat message use cases', () => {
  it('lists messages created by team members', async () => {
    repository.list.mockResolvedValue([row]);
    await expect(listSavedMessagesUseCase()).resolves.toEqual([expect.objectContaining({ id, title: 'Planes', kind: 'list' })]);
  });

  it('creates and updates validated text with list options', async () => {
    const draft = { ...emptySavedMessageDraft(), title: 'Planes', kind: 'list' as const, body: 'Elige tu plan', buttonLabel: 'Ver planes', options: [{ title: 'Mensual', description: 'Un mes' }] };
    repository.create.mockResolvedValue(row);
    repository.update.mockResolvedValue(row);
    await expect(saveSavedMessageUseCase(draft)).resolves.toMatchObject({ title: 'Planes', kind: 'list' });
    expect(repository.create).toHaveBeenCalledWith({ title: 'Planes', kind: 'list', body: 'Elige tu plan', button_label: 'Ver planes', options: draft.options });
    await saveSavedMessageUseCase(draft, id);
    expect(repository.update).toHaveBeenCalledWith(id, expect.objectContaining({ kind: 'list' }));
  });

  it('rejects invalid drafts and IDs before writing', async () => {
    await expect(saveSavedMessageUseCase({ ...emptySavedMessageDraft(), title: 'Sin texto' })).rejects.toThrow('Escribe el texto');
    await expect(saveSavedMessageUseCase({ ...emptySavedMessageDraft(), title: 'Hola', body: 'Hola' }, 'bad-id')).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('deletes only a validated message ID', async () => {
    repository.remove.mockResolvedValue(undefined);
    await deleteSavedMessageUseCase(id);
    expect(repository.remove).toHaveBeenCalledWith(id);
    await expect(deleteSavedMessageUseCase('bad-id')).rejects.toThrow();
    expect(repository.remove).toHaveBeenCalledTimes(1);
  });
});
