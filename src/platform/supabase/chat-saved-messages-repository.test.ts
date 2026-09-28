import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown }, calls: [] as Array<[string, unknown[]]> }));
vi.mock('./client', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'insert', 'update', 'delete', 'eq']) {
    builder[method] = (...args: unknown[]) => { state.calls.push([method, args]); return builder; };
  }
  builder.single = async () => state.result;
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(state.result).then(resolve);
  return { supabase: { from: (table: string) => { state.calls.push(['from', [table]]); return builder; } } };
});

import { createChatSavedMessage, deleteChatSavedMessage, listChatSavedMessages, updateChatSavedMessage } from './chat-saved-messages-repository';

const row = { id: '11111111-1111-4111-8111-111111111111', title: 'Hola', kind: 'text', body: 'Hola', button_label: null, options: [], created_by: '22222222-2222-4222-8222-222222222222', created_at: '', updated_at: '' };
const input = { title: 'Hola', kind: 'text', body: 'Hola', button_label: null, options: [] };

beforeEach(() => { state.result = { data: row, error: null }; state.calls.length = 0; });

describe('chat saved messages repository', () => {
  it('lists the shared library by most recently updated', async () => {
    state.result.data = [row];
    await expect(listChatSavedMessages()).resolves.toEqual([row]);
    expect(state.calls).toEqual([['from', ['chat_saved_messages']], ['select', ['*']], ['order', ['updated_at', { ascending: false }]]]);
    state.result.data = null;
    await expect(listChatSavedMessages()).resolves.toEqual([]);
  });

  it('creates, updates and deletes a row', async () => {
    await expect(createChatSavedMessage(input)).resolves.toEqual(row);
    expect(state.calls).toContainEqual(['insert', [input]]);
    state.calls.length = 0;
    await expect(updateChatSavedMessage(row.id, input)).resolves.toEqual(row);
    expect(state.calls).toContainEqual(['update', [input]]);
    expect(state.calls).toContainEqual(['eq', ['id', row.id]]);
    state.calls.length = 0;
    await deleteChatSavedMessage(row.id);
    expect(state.calls).toContainEqual(['delete', []]);
    expect(state.calls).toContainEqual(['eq', ['id', row.id]]);
  });

  it('propagates database and RLS failures', async () => {
    state.result.error = new Error('denied');
    await expect(listChatSavedMessages()).rejects.toThrow('denied');
    await expect(createChatSavedMessage(input)).rejects.toThrow('denied');
    await expect(updateChatSavedMessage(row.id, input)).rejects.toThrow('denied');
    await expect(deleteChatSavedMessage(row.id)).rejects.toThrow('denied');
  });
});
