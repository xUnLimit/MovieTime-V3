import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCases = vi.hoisted(() => ({
  fetchWhatsAppConversationsUseCase: vi.fn(),
  fetchWhatsAppMessagesUseCase: vi.fn(),
  markWhatsAppConversationReadUseCase: vi.fn(),
  sendWhatsAppMessageUseCase: vi.fn(),
}));

vi.mock('@/application/use-cases/whatsapp-chat-use-cases', () => useCases);

import {
  useMarkWhatsAppConversationRead,
  useSendWhatsAppMessage,
  useWhatsAppConversations,
  useWhatsAppMessages,
} from './use-whatsapp-chat';

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

beforeEach(() => {
  Object.values(useCases).forEach((mock) => mock.mockReset());
});

describe('WhatsApp chat hooks', () => {
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
});
