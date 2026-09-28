import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listResult: [] as unknown[],
  createError: null as unknown,
}));

vi.mock('@/platform/supabase/chat-saved-stickers-repository', () => ({
  listChatSavedStickers: async () => state.listResult,
  createChatSavedSticker: async (input: { media_id: string; mime_type: string }) => {
    if (state.createError) throw state.createError;
    return { id: '11111111-1111-4111-8111-111111111111', media_id: input.media_id, mime_type: input.mime_type, created_by: '22222222-2222-4222-8222-222222222222', created_at: '2026-09-28T00:00:00.000Z' };
  },
  deleteChatSavedSticker: vi.fn(async () => {}),
}));

import { deleteSavedStickerUseCase, listSavedStickersUseCase, saveStickerUseCase } from './chat-saved-sticker-use-cases';
import { deleteChatSavedSticker } from '@/platform/supabase/chat-saved-stickers-repository';

beforeEach(() => {
  state.listResult = [];
  state.createError = null;
  vi.mocked(deleteChatSavedSticker).mockClear();
});

describe('chat saved sticker use cases', () => {
  it('maps stored rows to the saved sticker shape', async () => {
    state.listResult = [{ id: 'id-1', media_id: '123', mime_type: 'image/webp', created_by: 'user-1', created_at: '2026-09-28T00:00:00.000Z' }];
    await expect(listSavedStickersUseCase()).resolves.toEqual([
      { id: 'id-1', mediaId: '123', mimeType: 'image/webp', createdBy: 'user-1', createdAt: '2026-09-28T00:00:00.000Z' },
    ]);
  });

  it('saves a sticker by media id and mime type', async () => {
    await expect(saveStickerUseCase('99988877766', 'image/webp')).resolves.toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      mediaId: '99988877766',
      mimeType: 'image/webp',
      createdBy: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-09-28T00:00:00.000Z',
    });
  });

  it('turns a duplicate media id into a clear conflict error', async () => {
    state.createError = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    await expect(saveStickerUseCase('99988877766', 'image/webp')).rejects.toThrow('Ese sticker ya está guardado.');
  });

  it('propagates unrelated database errors as-is', async () => {
    state.createError = new Error('network down');
    await expect(saveStickerUseCase('99988877766', 'image/webp')).rejects.toThrow('network down');
  });

  it('validates the id before deleting', async () => {
    await expect(deleteSavedStickerUseCase('not-a-uuid')).rejects.toThrow();
    expect(deleteChatSavedSticker).not.toHaveBeenCalled();
    await deleteSavedStickerUseCase('11111111-1111-4111-8111-111111111111');
    expect(deleteChatSavedSticker).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });
});
