import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptySavedMessageDraft } from '@/modules/whatsapp/saved-messages';
import { queryKeys } from '@/platform/query-keys';

const useCases = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock('@/application/use-cases/chat-saved-message-use-cases', () => ({
  listSavedMessagesUseCase: useCases.list,
  saveSavedMessageUseCase: useCases.save,
  deleteSavedMessageUseCase: useCases.remove,
}));

import { useChatSavedMessages, useDeleteChatMessage, useSaveChatMessage } from './use-chat-saved-messages';

function wrapperWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { wrapper, invalidate };
}

beforeEach(() => Object.values(useCases).forEach((mock) => mock.mockReset()));

describe('shared chat message hooks', () => {
  it('loads the team library only while it is open', async () => {
    useCases.list.mockResolvedValue([{ id: 'message-1' }]);
    const { wrapper } = wrapperWithClient();
    const closed = renderHook(() => useChatSavedMessages(false), { wrapper });
    expect(closed.result.current.fetchStatus).toBe('idle');
    expect(useCases.list).not.toHaveBeenCalled();

    const open = renderHook(() => useChatSavedMessages(true), { wrapper });
    await waitFor(() => expect(open.result.current.data).toEqual([{ id: 'message-1' }]));
    expect(useCases.list).toHaveBeenCalledTimes(1);
  });

  it('saves a message and refreshes the shared list', async () => {
    const draft = { ...emptySavedMessageDraft(), title: 'Saludo', body: 'Hola' };
    useCases.save.mockResolvedValue({ id: 'message-1' });
    const { wrapper, invalidate } = wrapperWithClient();
    const { result } = renderHook(() => useSaveChatMessage(), { wrapper });

    await result.current.mutateAsync({ draft, id: 'message-1' });
    expect(useCases.save).toHaveBeenCalledWith(draft, 'message-1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.whatsapp.savedMessages() });
  });

  it('removes a message and refreshes the shared list', async () => {
    useCases.remove.mockResolvedValue(undefined);
    const { wrapper, invalidate } = wrapperWithClient();
    const { result } = renderHook(() => useDeleteChatMessage(), { wrapper });

    await result.current.mutateAsync('message-1');
    expect(useCases.remove).toHaveBeenCalledWith('message-1', expect.any(Object));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.whatsapp.savedMessages() });
  });
});
