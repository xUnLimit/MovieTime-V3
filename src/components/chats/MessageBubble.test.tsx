import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { MessageBubble } from './MessageBubble';

vi.mock('./MessageAttachment', () => ({ MessageAttachment: ({ mediaId }: { mediaId: string }) => <span>Adjunto {mediaId}</span> }));

const base: WhatsAppChatMessage = { id: 'm1', waMessageId: 'wa-1', direction: 'outbound', kind: 'text', textBody: 'Hola', templateName: null, occurredAt: '2026-09-27T12:00:00Z', status: 'sent', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} };

describe('MessageBubble', () => {
  it('shows quotes, grouped reactions and accessible message actions', async () => {
    const onReply = vi.fn();
    const onReact = vi.fn();
    const quoted = { ...base, id: 'parent', textBody: 'Mensaje anterior' };
    render(<MessageBubble message={{ ...base, contextWaMessageId: 'parent-wa' }} continued={false} quotedByWaMessageId={{ 'parent-wa': quoted }} reactions={{ mine: '👍', theirs: '👍' }} onReply={onReply} onReact={onReact} />);
    expect(screen.getByText('Mensaje anterior')).toBeTruthy();
    expect(screen.getByText('👍 x2')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('button', { name: 'Reaccionar 👍' }));
    expect(onReact).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), '');
    await user.click(screen.getByRole('menuitem', { name: 'Responder' }));
    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });

  it('offers forwarding and retry for a failed outbound attachment', async () => {
    const onForward = vi.fn();
    const onRetry = vi.fn();
    render(<MessageBubble message={{ ...base, kind: 'document', mediaId: 'media-1', mediaMimeType: 'application/pdf', status: 'failed' }} continued={false} onForward={onForward} onRetry={onRetry} canRetry={() => true} />);
    expect(screen.getByText('Adjunto media-1')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reenviar' }));
    expect(onForward).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders maps and shared contact details', () => {
    const { unmount } = render(<MessageBubble message={{ ...base, kind: 'location', payload: { location: { latitude: 8.9, longitude: -79.5, name: 'Oficina' } } }} continued={false} />);
    expect(screen.getByRole('link', { name: 'Ubicación: Oficina' }).getAttribute('href')).toContain('8.9');
    unmount();
    render(<MessageBubble message={{ ...base, kind: 'contacts', payload: { contacts: [{ name: 'Ana', phone: '+50760000000' }] } }} continued={false} />);
    expect(screen.getByText('Ana · +50760000000')).toBeTruthy();
  });
});
