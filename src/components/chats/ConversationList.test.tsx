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
    lastInboundAt: new Date(2026, 8, 27, 10, 32).toISOString(), unreadCount: 2,
  },
  {
    waId: '50761111111', contactName: null, terceroId: null, terceroNombre: null,
    lastDirection: 'outbound', lastPreview: 'vence_hoy', lastMessageAt: new Date(2026, 8, 26, 9, 0).toISOString(),
    lastInboundAt: null, unreadCount: 0,
  },
];

function renderList(overrides: Partial<Parameters<typeof ConversationList>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <ConversationList
      conversations={conversations}
      selectedWaId="50760000000"
      isLoading={false}
      now={NOW}
      onSelect={onSelect}
      {...overrides}
    />
  );
  return { onSelect };
}

describe('ConversationList', () => {
  it('shows each conversation with its name, preview, time and unread count', () => {
    renderList();

    expect(screen.getByText('María Pérez')).toBeTruthy();
    expect(screen.getByText('Ya pagué')).toBeTruthy();
    expect(screen.getByText('10:32')).toBeTruthy();
    expect(screen.getByLabelText('2 sin leer')).toBeTruthy();
    expect(screen.getByText('+507 6111-1111')).toBeTruthy();
    expect(screen.getByText('Tú: vence_hoy')).toBeTruthy();
    expect(screen.getByText('No registrado')).toBeTruthy();
    expect(screen.getByRole('button', { name: /María Pérez/ }).getAttribute('aria-current')).toBe('true');
  });

  it('filters by name or number and reports no matches', async () => {
    const user = userEvent.setup();
    renderList();

    await user.type(screen.getByLabelText('Buscar conversación'), '6111');
    expect(screen.queryByText('María Pérez')).toBeNull();
    expect(screen.getByText('+507 6111-1111')).toBeTruthy();

    await user.clear(screen.getByLabelText('Buscar conversación'));
    await user.type(screen.getByLabelText('Buscar conversación'), 'maría');
    expect(screen.getByText('María Pérez')).toBeTruthy();

    await user.clear(screen.getByLabelText('Buscar conversación'));
    await user.type(screen.getByLabelText('Buscar conversación'), 'zzz');
    expect(screen.getByText('Sin resultados.')).toBeTruthy();
  });

  it('selects a conversation on click', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderList();

    await user.click(screen.getByRole('button', { name: /6111-1111/ }));

    expect(onSelect).toHaveBeenCalledWith('50761111111');
  });

  it('shows loading and empty states', () => {
    const { unmount } = render(
      <ConversationList conversations={[]} selectedWaId={null} isLoading now={NOW} onSelect={vi.fn()} />
    );
    expect(screen.getByText('Cargando conversaciones...')).toBeTruthy();
    unmount();

    renderList({ conversations: [] });
    expect(screen.getByText('Todavía no hay conversaciones.')).toBeTruthy();
  });
});
