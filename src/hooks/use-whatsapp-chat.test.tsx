import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as realtimeStatus from './whatsapp-realtime-status';

const useCases = vi.hoisted(() => ({
  fetchVentaMessageContextUseCase: vi.fn(),
  fetchWhatsAppConversationsUseCase: vi.fn(),
  fetchWhatsAppMediaUseCase: vi.fn(),
  fetchWhatsAppMessagesUseCase: vi.fn(),
  hideWhatsAppMessageUseCase: vi.fn(),
  markWhatsAppConversationReadUseCase: vi.fn(),
  markWhatsAppConversationUnreadUseCase: vi.fn(),
  sendWhatsAppMessageUseCase: vi.fn(),
  setWhatsAppConversationArchivedUseCase: vi.fn(),
  setWhatsAppConversationPinnedUseCase: vi.fn(),
  uploadWhatsAppMediaUseCase: vi.fn(),
}));

vi.mock('@/application/use-cases/whatsapp-chat-use-cases', () => useCases);

let lastClient: QueryClient;

import {
  useHideWhatsAppMessage,
  useMarkWhatsAppConversationRead,
  useMarkWhatsAppConversationUnread,
  useSetWhatsAppConversationArchived,
  useSetWhatsAppConversationPinned,
  useVentaMessageContext,
  useWhatsAppUnreadChats,
  useSendWhatsAppMessage,
  useWhatsAppMedia,
  useWhatsAppConversations,
  useWhatsAppMessages,
  useUploadWhatsAppMedia,
} from './use-whatsapp-chat';

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lastClient = client;
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

beforeEach(() => {
  Object.values(useCases).forEach((mock) => mock.mockReset());
  realtimeStatus.setWhatsAppRealtimeStatus('offline');
});

describe('WhatsApp chat hooks', () => {
  it('configura el respaldo lento para los tres sondeos', () => {
    const polling = vi.spyOn(realtimeStatus, 'pollingInterval');
    const conversations = renderHook(() => useWhatsAppConversations(), { wrapper: createWrapper().wrapper });
    const messages = renderHook(() => useWhatsAppMessages('507'), { wrapper: createWrapper().wrapper });
    const badge = renderHook(() => useWhatsAppUnreadChats(true), { wrapper: createWrapper().wrapper });

    expect(polling).toHaveBeenCalledWith(10_000, 60_000);
    expect(polling).toHaveBeenCalledWith(5_000, 30_000);
    expect(polling).toHaveBeenCalledWith(30_000, 120_000);
    conversations.unmount();
    messages.unmount();
    badge.unmount();
    polling.mockRestore();
  });
  it('uploads selected media through the use case', async () => {
    useCases.uploadWhatsAppMediaUseCase.mockResolvedValue({ mediaId: 'media-1', mimeType: 'image/png', filename: 'foto.png' });
    const { wrapper } = createWrapper();
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    const { result } = renderHook(() => useUploadWhatsAppMedia(), { wrapper });
    expect(await result.current.mutateAsync({ file, filename: file.name })).toMatchObject({ mediaId: 'media-1' });
    expect(useCases.uploadWhatsAppMediaUseCase).toHaveBeenCalledWith(file, 'foto.png');
  });
  it('loads conversations', async () => {
    useCases.fetchWhatsAppConversationsUseCase.mockResolvedValue([{ waId: '507' }]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWhatsAppConversations(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([{ waId: '507' }]));
  });

  it('loads messages only for a selected conversation', async () => {
    useCases.fetchWhatsAppMessagesUseCase.mockResolvedValue([{ id: 'm1' }]);
    const { wrapper } = createWrapper();

    const idle = renderHook(() => useWhatsAppMessages(null), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');

    const { result } = renderHook(() => useWhatsAppMessages('507'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'm1' }]));
    expect(useCases.fetchWhatsAppMessagesUseCase).toHaveBeenCalledWith('507');
  });

  it('marks a conversation read and refreshes the list', async () => {
    useCases.markWhatsAppConversationReadUseCase.mockResolvedValue(undefined);
    const { wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useMarkWhatsAppConversationRead(), { wrapper });

    result.current.mutate({ waId: '507', readAt: '2026-09-27T12:00:00Z' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useCases.markWhatsAppConversationReadUseCase).toHaveBeenCalledWith('507', '2026-09-27T12:00:00Z');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
  });

  it('sends a message and refreshes the thread and the list even on failure', async () => {
    useCases.sendWhatsAppMessageUseCase.mockRejectedValue(new Error('offline'));
    const { wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useSendWhatsAppMessage(), { wrapper });
    const input = { to: '507', message: { kind: 'text' as const, text: 'Hola' }, idempotencyKey: 'k' };

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useCases.sendWhatsAppMessageUseCase).toHaveBeenCalledWith(input);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'messages', '507'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
  });

  it('downloads media only when enabled and exposes a revocable blob url', async () => {
    const createObjectURL = vi.fn(() => 'blob:local');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    useCases.fetchWhatsAppMediaUseCase.mockResolvedValue(new Blob(['x']));
    const { wrapper } = createWrapper();

    const idle = renderHook(() => useWhatsAppMedia('123', false), { wrapper });
    expect(idle.result.current.objectUrl).toBeNull();
    expect(useCases.fetchWhatsAppMediaUseCase).not.toHaveBeenCalled();

    const { result, unmount } = renderHook(() => useWhatsAppMedia('123', true), { wrapper });
    await waitFor(() => expect(result.current.objectUrl).toBe('blob:local'));
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local');
  });

  it('reports media download errors', async () => {
    useCases.fetchWhatsAppMediaUseCase.mockRejectedValue(new Error('404'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWhatsAppMedia('999', true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('counts chats with unread messages only for admins', async () => {
    useCases.fetchWhatsAppConversationsUseCase.mockResolvedValue([
      { waId: '1', unreadCount: 2 }, { waId: '2', unreadCount: 0 }, { waId: '3', unreadCount: 1 },
      { waId: '4', unreadCount: 5, archived: true },
    ]);
    const { wrapper } = createWrapper();

    const admin = renderHook(() => useWhatsAppUnreadChats(true), { wrapper });
    await waitFor(() => expect(admin.result.current).toBe(2));

    const other = renderHook(() => useWhatsAppUnreadChats(false), { wrapper: createWrapper().wrapper });
    expect(other.result.current).toBe(0);
  });

  it('pins a conversation in the list right away and refreshes from the server', async () => {
    useCases.setWhatsAppConversationPinnedUseCase.mockResolvedValue(undefined);
    const { wrapper, invalidate } = createWrapper();
    lastClient.setQueryData(['whatsapp', 'conversations'], [{ waId: '507', pinnedAt: null }, { waId: '508', pinnedAt: null }]);
    const { result } = renderHook(() => useSetWhatsAppConversationPinned(), { wrapper });

    result.current.mutate({ waId: '507', pinned: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useCases.setWhatsAppConversationPinnedUseCase).toHaveBeenCalledWith('507', true);
    const list = lastClient.getQueryData<Array<{ waId: string; pinnedAt: string | null }>>(['whatsapp', 'conversations']);
    expect(list?.[0]?.pinnedAt).toEqual(expect.any(String));
    expect(list?.[1]?.pinnedAt).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
  });

  it('archives and unarchives a conversation and reloads the list when the server fails', async () => {
    useCases.setWhatsAppConversationArchivedUseCase.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('forbidden'));
    const { wrapper, invalidate } = createWrapper();
    lastClient.setQueryData(['whatsapp', 'conversations'], [{ waId: '507', archived: false }]);
    const { result } = renderHook(() => useSetWhatsAppConversationArchived(), { wrapper });

    result.current.mutate({ waId: '507', archived: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useCases.setWhatsAppConversationArchivedUseCase).toHaveBeenCalledWith('507', true);
    expect(lastClient.getQueryData<Array<{ archived: boolean }>>(['whatsapp', 'conversations'])?.[0]?.archived).toBe(true);

    invalidate.mockClear();
    result.current.mutate({ waId: '507', archived: false });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
  });

  it('loads the sale context only when a sale is chosen', async () => {
    useCases.fetchVentaMessageContextUseCase.mockResolvedValue({ categoriaNombre: 'Netflix' });
    const { wrapper } = createWrapper();

    const idle = renderHook(() => useVentaMessageContext(null), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');

    const { result } = renderHook(() => useVentaMessageContext('v1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ categoriaNombre: 'Netflix' }));
    expect(useCases.fetchVentaMessageContextUseCase).toHaveBeenCalledWith('v1');
  });

  it('marks a conversation unread and refreshes the list', async () => {
    useCases.markWhatsAppConversationUnreadUseCase.mockResolvedValue(undefined);
    const { wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useMarkWhatsAppConversationUnread(), { wrapper });

    result.current.mutate({ waId: '507', lastInboundAt: '2026-09-27T12:00:00Z' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useCases.markWhatsAppConversationUnreadUseCase).toHaveBeenCalledWith('507', '2026-09-27T12:00:00Z');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
  });

  it('shows the message instantly while sending and removes it if sending fails', async () => {
    let fail: (error: Error) => void = () => undefined;
    useCases.sendWhatsAppMessageUseCase.mockImplementation(() => new Promise((_resolve, rejectFn) => {
      fail = rejectFn;
    }));
    const { wrapper } = createWrapper();
    lastClient.setQueryData(['whatsapp', 'messages', '507'], [{ id: 'old' }]);
    const { result } = renderHook(() => useSendWhatsAppMessage(), { wrapper });

    result.current.mutate({ to: '507', message: { kind: 'template', templateName: 'vence_hoy', params: [] }, idempotencyKey: 'k1' });

    await waitFor(() => expect(lastClient.getQueryData<Array<{ id: string }>>(['whatsapp', 'messages', '507'])).toHaveLength(2));
    expect(lastClient.getQueryData<Array<Record<string, unknown>>>(['whatsapp', 'messages', '507'])?.[1]).toMatchObject({
      id: 'pending-k1', direction: 'outbound', status: 'pending', templateName: 'vence_hoy', textBody: null,
    });

    fail(new Error('offline'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(lastClient.getQueryData<Array<{ id: string }>>(['whatsapp', 'messages', '507'])?.map((item) => item.id)).not.toContain('pending-k1');
  });

  it('shows attachment metadata and captions while a media send is pending', async () => {
    useCases.sendWhatsAppMessageUseCase.mockImplementation(() => new Promise(() => undefined));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendWhatsAppMessage(), { wrapper });
    result.current.mutate({ to: '507', message: { kind: 'document', mediaId: 'media-1', mimeType: 'application/pdf', filename: 'nota.pdf', caption: 'Adjunto', replyTo: 'wa-parent' }, idempotencyKey: 'media-attempt' });
    await waitFor(() => expect(lastClient.getQueryData<Array<Record<string, unknown>>>(['whatsapp', 'messages', '507'])?.[0]).toMatchObject({
      kind: 'document', textBody: 'Adjunto', mediaId: 'media-1', mediaMimeType: 'application/pdf', mediaFilename: 'nota.pdf', contextWaMessageId: 'wa-parent',
    }));
  });

  it('shows reaction and location details in optimistic messages', async () => {
    useCases.sendWhatsAppMessageUseCase.mockImplementation(() => new Promise(() => undefined));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendWhatsAppMessage(), { wrapper });
    result.current.mutate({ to: '507', message: { kind: 'reaction', targetWaMessageId: 'wa-target', emoji: '👍' }, idempotencyKey: 'reaction-attempt' });
    result.current.mutate({ to: '507', message: { kind: 'location', location: { latitude: 8.9, longitude: -79.5 } }, idempotencyKey: 'location-attempt' });
    await waitFor(() => expect(lastClient.getQueryData<Array<Record<string, unknown>>>(['whatsapp', 'messages', '507'])).toHaveLength(2));
    expect(lastClient.getQueryData<Array<Record<string, unknown>>>(['whatsapp', 'messages', '507'])).toEqual([
      expect.objectContaining({ kind: 'reaction', reactionEmoji: '👍', contextWaMessageId: 'wa-target' }),
      expect.objectContaining({ kind: 'location', payload: { location: { latitude: 8.9, longitude: -79.5 } } }),
    ]);
  });


  it('shows the chat as unread right away and keeps it if the server fails', async () => {
    let fail: (error: Error) => void = () => undefined;
    useCases.markWhatsAppConversationUnreadUseCase.mockImplementation(() => new Promise((_resolve, rejectFn) => {
      fail = rejectFn;
    }));
    useCases.fetchWhatsAppConversationsUseCase.mockResolvedValue([]);
    const { wrapper } = createWrapper();
    lastClient.setQueryData(['whatsapp', 'conversations'], [
      { waId: '507', unreadCount: 0 },
      { waId: '508', unreadCount: 3 },
    ]);
    const { result } = renderHook(() => useMarkWhatsAppConversationUnread(), { wrapper });

    result.current.mutate({ waId: '507', lastInboundAt: '2026-09-27T12:00:00Z' });

    await waitFor(() => expect(lastClient.getQueryData<Array<{ waId: string; unreadCount: number }>>(['whatsapp', 'conversations']))
      .toEqual([{ waId: '507', unreadCount: 1 }, { waId: '508', unreadCount: 3 }]));
    fail(new Error('offline'));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('ignores the optimistic update when the list is not loaded yet', async () => {
    useCases.markWhatsAppConversationUnreadUseCase.mockResolvedValue(undefined);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarkWhatsAppConversationUnread(), { wrapper });

    result.current.mutate({ waId: '507', lastInboundAt: '2026-09-27T12:00:00Z' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lastClient.getQueryData(['whatsapp', 'conversations'])).toBeUndefined();
  });

  it('hides a message instantly and refreshes the thread and the list', async () => {
    useCases.hideWhatsAppMessageUseCase.mockResolvedValue(undefined);
    const { wrapper, invalidate } = createWrapper();
    lastClient.setQueryData(['whatsapp', 'messages', '507'], [{ id: 'm1' }, { id: 'm2' }]);
    const { result } = renderHook(() => useHideWhatsAppMessage('507'), { wrapper });

    result.current.mutate({ messageId: 'm1', direction: 'inbound' });

    await waitFor(() => expect(lastClient.getQueryData<Array<{ id: string }>>(['whatsapp', 'messages', '507']))
      .toEqual([{ id: 'm2' }]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useCases.hideWhatsAppMessageUseCase).toHaveBeenCalledWith('m1', 'inbound');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'messages', '507'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
  });

  it('restores the message if hiding fails on the server', async () => {
    let fail: (error: Error) => void = () => undefined;
    useCases.hideWhatsAppMessageUseCase.mockImplementation(() => new Promise((_resolve, rejectFn) => {
      fail = rejectFn;
    }));
    const { wrapper } = createWrapper();
    lastClient.setQueryData(['whatsapp', 'messages', '507'], [{ id: 'm1' }]);
    const { result } = renderHook(() => useHideWhatsAppMessage('507'), { wrapper });

    result.current.mutate({ messageId: 'm1', direction: 'outbound' });
    await waitFor(() => expect(lastClient.getQueryData(['whatsapp', 'messages', '507'])).toEqual([]));

    fail(new Error('forbidden'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(lastClient.getQueryData(['whatsapp', 'messages', '507'])).toEqual([{ id: 'm1' }]);
  });

});
