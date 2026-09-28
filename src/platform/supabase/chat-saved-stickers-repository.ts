import { supabase } from './client';
import type { Database } from './database.types';

type SavedStickerRow = Database['public']['Tables']['chat_saved_stickers']['Row'];
type SavedStickerWrite = Pick<SavedStickerRow, 'media_id' | 'mime_type'>;

export async function listChatSavedStickers(): Promise<SavedStickerRow[]> {
  const { data, error } = await supabase.from('chat_saved_stickers')
    .select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createChatSavedSticker(input: SavedStickerWrite): Promise<SavedStickerRow> {
  const { data, error } = await supabase.from('chat_saved_stickers')
    .insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteChatSavedSticker(id: string): Promise<void> {
  const { error } = await supabase.from('chat_saved_stickers').delete().eq('id', id);
  if (error) throw error;
}
