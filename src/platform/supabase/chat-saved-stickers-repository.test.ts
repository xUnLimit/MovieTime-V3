import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown }, calls: [] as Array<[string, unknown[]]> }));
vi.mock('./client', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'insert', 'delete', 'eq']) {
    builder[method] = (...args: unknown[]) => { state.calls.push([method, args]); return builder; };
  }
  builder.single = async () => state.result;
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(state.result).then(resolve);
  return { supabase: { from: (table: string) => { state.calls.push(['from', [table]]); return builder; } } };
});

import { createChatSavedSticker, deleteChatSavedSticker, listChatSavedStickers } from './chat-saved-stickers-repository';

const row = { id: '11111111-1111-4111-8111-111111111111', media_id: '99988877766', mime_type: 'image/webp', created_by: '22222222-2222-4222-8222-222222222222', created_at: '' };
const input = { media_id: '99988877766', mime_type: 'image/webp' };

beforeEach(() => { state.result = { data: row, error: null }; state.calls.length = 0; });

describe('chat saved stickers repository', () => {
  it('lists the shared library by most recently saved', async () => {
    state.result.data = [row];
    await expect(listChatSavedStickers()).resolves.toEqual([row]);
    expect(state.calls).toEqual([['from', ['chat_saved_stickers']], ['select', ['*']], ['order', ['created_at', { ascending: false }]]]);
    state.result.data = null;
    await expect(listChatSavedStickers()).resolves.toEqual([]);
  });

  it('creates and deletes a row', async () => {
    await expect(createChatSavedSticker(input)).resolves.toEqual(row);
    expect(state.calls).toContainEqual(['insert', [input]]);
    state.calls.length = 0;
    await deleteChatSavedSticker(row.id);
    expect(state.calls).toContainEqual(['delete', []]);
    expect(state.calls).toContainEqual(['eq', ['id', row.id]]);
  });

  it('propagates database and RLS failures', async () => {
    state.result.error = new Error('denied');
    await expect(listChatSavedStickers()).rejects.toThrow('denied');
    await expect(createChatSavedSticker(input)).rejects.toThrow('denied');
    await expect(deleteChatSavedSticker(row.id)).rejects.toThrow('denied');
  });
});
