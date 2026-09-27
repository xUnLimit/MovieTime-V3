import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { ForwardDialog } from './ForwardDialog';

const conversations: WhatsAppConversation[] = [
  { waId: '50760000000', contactName: 'María', terceroId: null, terceroNombre: null, lastDirection: 'inbound', lastPreview: 'Hola', lastMessageAt: '2026-09-27T12:00:00Z', lastInboundAt: null, unreadCount: 0, nextExpiry: null },
  { waId: '50761111111', contactName: 'Pedro', terceroId: null, terceroNombre: null, lastDirection: 'inbound', lastPreview: 'Hola', lastMessageAt: '2026-09-27T12:00:00Z', lastInboundAt: null, unreadCount: 0, nextExpiry: null },
];

describe('ForwardDialog', () => {
  it('filters recipients and forwards to the selected WhatsApp ID', async () => {
    const onForward = vi.fn();
    render(<ForwardDialog open conversations={conversations} onOpenChange={vi.fn()} onForward={onForward} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Buscar destino'), 'pedro');
    expect(screen.queryByText('María')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Pedro/ }));
    expect(onForward).toHaveBeenCalledWith('50761111111');
  });
});
