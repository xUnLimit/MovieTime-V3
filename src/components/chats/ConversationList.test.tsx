import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { ConversationList } from './ConversationList';

const NOW = new Date(2026, 8, 27, 15, 30);

const conversations: WhatsAppConversation[] = [
  {
    waId: '50760000000', contactName: 'Mary', terceroId: 't1', terceroNombre: 'María Pérez',
    lastDirection: 'inbound', lastPreview: 'Ya pagué', lastMessageAt: new Date(2026, 8, 27, 10, 32).toISOString(),
    lastInboundAt: new Date(2026, 8, 27, 10, 32).toISOString(), unreadCount: 2, nextExpiry: '2026-09-27',
  },
  {
    waId: '50761111111', contactName: null, terceroId: null, terceroNombre: null,
    lastDirection: 'outbound', lastPreview: 'vence_hoy', lastMessageAt: new Date(2026, 8, 26, 9, 0).toISOString(),
    lastInboundAt: null, unreadCount: 0, nextExpiry: null,
  },
  {
    waId: '50762222222', contactName: 'Juan', terceroId: 't2', terceroNombre: 'Juan Gómez',
    lastDirection: 'inbound', lastPreview: 'Gracias', lastMessageAt: new Date(2026, 8, 20, 9, 0).toISOString(),
    lastInboundAt: null, unreadCount: 0, nextExpiry: '2026-09-26',
  },
];

const counts = { todos: 3, no_leidos: 1, ventana_abierta: 1, sin_registrar: 1 };

function renderList(overrides: Partial<Parameters<typeof ConversationList>[0]> = {}) {
  const props = {
    visible: conversations,
    totalCount: conversations.length,
    counts,
    search: '',
    filter: 'todos' as const,
    selectedWaId: '50760000000',
    isLoading: false,
    now: NOW,
    onSearchChange: vi.fn(),
    onFilterChange: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  render(<ConversationList {...props} />);
  return props;
}

describe('ConversationList', () => {
  it('shows name, preview, time, unread count, due date and registration state', () => {
    renderList();

    expect(screen.getByText('María Pérez')).toBeTruthy();
    expect(screen.getByText('10:32')).toBeTruthy();
    expect(screen.getByLabelText('2 sin leer')).toBeTruthy();
    expect(screen.getByText(/Vence hoy/)).toBeTruthy();
    expect(screen.getByText(/Vencido/)).toBeTruthy();
    expect(screen.getByText('+507 6111-1111')).toBeTruthy();
    expect(screen.getByText('Tú:')).toBeTruthy();
    expect(screen.getByText(/No registrado/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /María Pérez/ }).getAttribute('aria-current')).toBe('true');
  });

  it('shows filter counts and reports filter, search and selection changes', async () => {
    const user = userEvent.setup();
    const props = renderList();

    expect(screen.getByRole('tab', { name: 'No leídos (1)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Todos' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Todos3', 'No leídos1', 'Ventana abierta1', 'Sin registrar1']);
    await user.click(screen.getByRole('tab', { name: 'Sin registrar (1)' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('sin_registrar');

    await user.type(screen.getByLabelText('Buscar conversación'), 'j');
    expect(props.onSearchChange).toHaveBeenCalledWith('j');

    await user.click(screen.getByRole('button', { name: /Juan Gómez/ }));
    expect(props.onSelect).toHaveBeenCalledWith('50762222222');
  });

  it('opens the first result with Enter and clears the search with Escape', async () => {
    const user = userEvent.setup();
    const props = renderList({ search: 'mar' });

    await user.type(screen.getByLabelText('Buscar conversación'), '{Enter}');
    expect(props.onSelect).toHaveBeenCalledWith('50760000000');

    await user.type(screen.getByLabelText('Buscar conversación'), '{Escape}');
    expect(props.onSearchChange).toHaveBeenCalledWith('');
  });

  it('clears search and resets an empty filtered result', async () => {
    const user = userEvent.setup();
    const props = renderList({ visible: [], search: 'desconocido', filter: 'no_leidos' });

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(props.onSearchChange).toHaveBeenCalledWith('');

    await user.click(screen.getByRole('button', { name: 'Ver todas las conversaciones' }));
    expect(props.onSearchChange).toHaveBeenLastCalledWith('');
    expect(props.onFilterChange).toHaveBeenCalledWith('todos');
  });

  it('explains empty, filtered and loading states', () => {
    const { unmount } = render(
      <ConversationList {...renderListProps({ visible: [], totalCount: 0 })} />
    );
    expect(screen.getByText(/Cuando un cliente escriba/)).toBeTruthy();
    unmount();

    const second = render(<ConversationList {...renderListProps({ visible: [], search: 'hbo' })} />);
    expect(screen.getByText('Ningún chat coincide con "hbo".')).toBeTruthy();
    second.unmount();

    const third = render(<ConversationList {...renderListProps({ visible: [], filter: 'no_leidos' })} />);
    expect(screen.getByText('No hay chats en este filtro.')).toBeTruthy();
    third.unmount();

    render(<ConversationList {...renderListProps({ isLoading: true })} />);
    expect(screen.queryByText('María Pérez')).toBeNull();
  });
});

function renderListProps(overrides: Partial<Parameters<typeof ConversationList>[0]>) {
  return {
    visible: conversations,
    totalCount: conversations.length,
    counts,
    search: '',
    filter: 'todos' as const,
    selectedWaId: null,
    isLoading: false,
    now: NOW,
    onSearchChange: vi.fn(),
    onFilterChange: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}
