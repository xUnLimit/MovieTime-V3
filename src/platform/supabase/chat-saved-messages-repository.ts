import { supabase } from './client';
import type { Database } from './database.types';

type SavedMessageRow = Database['public']['Tables']['chat_saved_messages']['Row'];
type SavedMessageWrite = Pick<SavedMessageRow, 'title' | 'kind' | 'body' | 'button_label' | 'options'>;

export async function listChatSavedMessages(): Promise<SavedMessageRow[]> {
  const { data, error } = await supabase.from('chat_saved_messages')
    .select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createChatSavedMessage(input: SavedMessageWrite): Promise<SavedMessageRow> {
  const { data, error } = await supabase.from('chat_saved_messages')
    .insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateChatSavedMessage(id: string, input: SavedMessageWrite): Promise<SavedMessageRow> {
  const { data, error } = await supabase.from('chat_saved_messages')
    .update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteChatSavedMessage(id: string): Promise<void> {
  const { error } = await supabase.from('chat_saved_messages').delete().eq('id', id);
  if (error) throw error;
}
