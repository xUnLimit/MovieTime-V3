import { ConflictError } from '@/platform/errors/domain-errors';
import {
  createChatSavedSticker,
  deleteChatSavedSticker,
  listChatSavedStickers,
} from '@/platform/supabase/chat-saved-stickers-repository';
import { assertUuid } from '@/platform/utils/safety';

export type SavedSticker = {
  id: string;
  mediaId: string;
  mimeType: string;
  createdBy: string;
  createdAt: string;
};

const UNIQUE_VIOLATION = '23505';

export async function listSavedStickersUseCase(): Promise<SavedSticker[]> {
  const rows = await listChatSavedStickers();
  return rows.map((row) => ({
    id: row.id,
    mediaId: row.media_id,
    mimeType: row.mime_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export async function saveStickerUseCase(mediaId: string, mimeType: string): Promise<SavedSticker> {
  try {
    const row = await createChatSavedSticker({ media_id: mediaId, mime_type: mimeType });
    return { id: row.id, mediaId: row.media_id, mimeType: row.mime_type, createdBy: row.created_by, createdAt: row.created_at };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === UNIQUE_VIOLATION) {
      throw new ConflictError('Ese sticker ya está guardado.');
    }
    throw error;
  }
}

export async function deleteSavedStickerUseCase(id: string): Promise<void> {
  await deleteChatSavedSticker(assertUuid(id, 'sticker guardado'));
}
