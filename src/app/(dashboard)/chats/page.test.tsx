import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const state = vi.hoisted(() => ({
  wa: null as string | null,
  conversations: [] as WhatsAppConversation[],
  isLoading: false,
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => ({ get: (key: string) => (key === 'wa' ? state.wa : null) }),
}));
vi.mock('@/hooks/use-whatsapp-chat', () => ({
  useWhatsAppConversations: () => ({ data: state.conversations, isLoading: state.isLoading }),
}));
vi.mock('@/components/chats/ChatThread', () => ({
  ChatThread: ({ conversation, onBack }: { conversation: WhatsAppConversation; onBack: () => void }) => (
    <div>
      <p>Hilo de {conversation.waId}</p>
      <button type="button" onClick={onBack}>Volver</button>
    </div>
  ),
}));

import ChatsPage from './page';

const conversation: WhatsAppConversation = {
  waId: '50760000000', contactName: 'Mary', terceroId: null, terceroNombre: null,
  lastDirection: 'inbound', lastPreview: 'Hola', lastMessageAt: new Date().toISOString(),
  lastInboundAt: new Date().toISOString(), unreadCount: 0,
};

beforeEach(() => {
  state.wa = null;
  state.conversations = [conversation];
  state.isLoading = false;
  state.replace.mockReset();
});

describe('ChatsPage', () => {
  it('asks to pick a conversation when none is selected and navigates on select', async () => {
    const user = userEvent.setup();
    render(<ChatsPage />);

    expect(screen.getByRole('heading', { name: 'Chats de WhatsApp' })).toBeTruthy();
    expect(screen.getByText('Selecciona una conversación para verla.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Mary/ }));
    expect(state.replace).toHaveBeenCalledWith('/chats?wa=50760000000', { scroll: false });
  });

  it('opens the conversation from the URL and goes back to the list', async () => {
    const user = userEvent.setup();
    state.wa = '50760000000';
    render(<ChatsPage />);

    expect(screen.getByText('Hilo de 50760000000')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(state.replace).toHaveBeenCalledWith('/chats', { scroll: false });
  });

  it('reports an unknown conversation and ignores malformed ids', () => {
    state.wa = '50799999999';
    const { unmount } = render(<ChatsPage />);
    expect(screen.getByText('No se encontró esa conversación.')).toBeTruthy();
    unmount();

    state.wa = 'javascript:alert(1)';
    render(<ChatsPage />);
    expect(screen.getByText('Selecciona una conversación para verla.')).toBeTruthy();
  });

  it('refreshes relative times every minute', () => {
    vi.useFakeTimers();
    try {
      render(<ChatsPage />);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(screen.getByText('Hola')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
