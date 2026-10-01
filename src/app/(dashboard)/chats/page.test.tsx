import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const state = vi.hoisted(() => ({
  wa: null as string | null,
  conversations: [] as WhatsAppConversation[],
  isLoading: false,
  replace: vi.fn(),
  panel: vi.fn(),
  realtime: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => ({ get: (key: string) => (key === 'wa' ? state.wa : null) }),
  usePathname: () => '/chats',
}));
vi.mock('@/hooks/use-whatsapp-chat', () => ({
  useWhatsAppConversations: () => ({ data: state.conversations, isLoading: state.isLoading }),
}));
vi.mock('@/hooks/use-whatsapp-realtime', () => ({ useWhatsAppRealtime: state.realtime }));
vi.mock('@/components/chats/ChatWorkspace', () => ({
  ChatWorkspace: ({ conversation, onBack, panelPreferred, onPanelPreferredChange }: {
    conversation: WhatsAppConversation;
    onBack: () => void;
    panelPreferred: boolean;
    onPanelPreferredChange: (open: boolean) => void;
  }) => {
    state.panel(panelPreferred);
    return (
      <div>
        <p>Hilo de {conversation.waId}</p>
        <button type="button" onClick={onBack}>Volver</button>
        <button type="button" onClick={() => onPanelPreferredChange(!panelPreferred)}>Panel</button>
      </div>
    );
  },
}));

import ChatsPage from './page';

function conversation(waId: string, name: string, unreadCount = 0): WhatsAppConversation {
  return {
    waId, contactName: name, terceroId: null, terceroNombre: null,
    lastDirection: 'inbound', lastPreview: `Hola de ${name}`, lastMessageAt: new Date().toISOString(),
    lastInboundAt: new Date().toISOString(), unreadCount, nextExpiry: null, activeCategories: [], pinnedAt: null, archived: false,
  };
}

const storage = new Map<string, string>();

beforeEach(() => {
  state.wa = null;
  state.conversations = [conversation('50760000000', 'Mary', 2), conversation('50761111111', 'Juan')];
  state.isLoading = false;
  state.replace.mockReset();
  state.panel.mockReset();
  state.realtime.mockReset();
  storage.clear();
  vi.mocked(localStorage.getItem).mockImplementation((key) => storage.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
    storage.set(key, value);
  });
});

describe('ChatsPage', () => {
  it('asks to pick a chat and navigates on select', async () => {
    const user = userEvent.setup();
    render(<ChatsPage />);

    expect(state.realtime).toHaveBeenCalledWith();

    expect(screen.getByRole('heading', { level: 1, name: 'Conversaciones' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Selecciona una conversación' })).toBeTruthy();
    expect(screen.getByText(/Elige un chat para responder/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Mary/ }));
    expect(state.replace).toHaveBeenCalledWith('/chats?wa=50760000000', { scroll: false });
  });

  it('filters and searches the list', async () => {
    const user = userEvent.setup();
    render(<ChatsPage />);

    await user.click(screen.getByRole('button', { name: 'No leídos (1)' }));
    expect(screen.queryByText('Juan')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Todos' }));

    await user.type(screen.getByLabelText('Buscar conversación'), 'juan');
    expect(screen.queryByText('Mary')).toBeNull();
    expect(screen.getByText('Juan')).toBeTruthy();
  });

  it('opens the chat from the URL, remembers the panel preference and goes back', async () => {
    const user = userEvent.setup();
    state.wa = '50760000000';
    render(<ChatsPage />);

    expect(screen.getByText('Hilo de 50760000000')).toBeTruthy();
    expect(state.panel).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Panel' }));
    expect(storage.get('chats:panel-open')).toBe('false');
    expect(state.panel).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(state.replace).toHaveBeenCalledWith('/chats', { scroll: false });
  });

  it('starts with the panel hidden when the device preference says so', () => {
    storage.set('chats:panel-open', 'false');
    state.wa = '50760000000';
    render(<ChatsPage />);

    expect(state.panel).toHaveBeenLastCalledWith(false);
  });

  it('supports keyboard shortcuts for search, switching chats and closing', () => {
    state.wa = '50760000000';
    render(<ChatsPage />);

    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(screen.getByLabelText('Buscar conversación'));

    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
    expect(state.replace).toHaveBeenLastCalledWith('/chats?wa=50761111111', { scroll: false });
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
    expect(state.replace).toHaveBeenLastCalledWith('/chats?wa=50760000000', { scroll: false });

    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(state.replace).toHaveBeenLastCalledWith('/chats', { scroll: false });
  });

  it('opens the first chat with Alt+Down when none is selected', () => {
    render(<ChatsPage />);
    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
    expect(state.replace).toHaveBeenCalledWith('/chats?wa=50760000000', { scroll: false });
  });

  it('reports an unknown chat and ignores malformed ids', () => {
    state.wa = '50799999999';
    const { unmount } = render(<ChatsPage />);
    expect(screen.getByText('No se encontró esa conversación.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Elige otro chat de la lista.');
    unmount();

    state.wa = 'javascript:alert(1)';
    render(<ChatsPage />);
    expect(screen.getByText(/Elige un chat para responder/)).toBeTruthy();
  });

  it('keeps working when browser storage is unavailable and refreshes the clock', () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.useFakeTimers();
    try {
      state.wa = '50760000000';
      render(<ChatsPage />);
      expect(state.panel).toHaveBeenLastCalledWith(true);
      fireEvent.click(screen.getByRole('button', { name: 'Panel' }));
      expect(state.panel).toHaveBeenLastCalledWith(false);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
