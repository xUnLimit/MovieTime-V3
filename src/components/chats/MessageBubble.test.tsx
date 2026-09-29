import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { MessageBubble } from './MessageBubble';

vi.mock('./MessageAttachment', () => ({
  MessageAttachment: ({ mediaId, onOpenImage }: { mediaId: string; onOpenImage?: (objectUrl: string) => void }) => (
    <span>
      Adjunto {mediaId}
      {onOpenImage ? <button type="button" onClick={() => onOpenImage('blob:test')}>Abrir imagen de prueba</button> : null}
    </span>
  ),
}));

const base: WhatsAppChatMessage = { id: 'm1', waMessageId: 'wa-1', direction: 'outbound', kind: 'text', textBody: 'Hola', templateName: null, occurredAt: '2026-09-27T12:00:00Z', status: 'sent', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} };

describe('MessageBubble', () => {
  it('reserves room for the always-visible mobile menu button so it never overlaps short text', () => {
    const { container } = render(<MessageBubble message={{ ...base, textBody: 'Test' }} continued={false} />);
    const spacer = container.querySelector('p span[aria-hidden]');
    expect(spacer?.className).toContain('float-right');
  });

  it.each([
    ['outbound', false],
    ['inbound', false],
    ['outbound', true],
    ['inbound', true],
  ] as const)('renders a rounded %s bubble without a detached tail when continued is %s', (direction, continued) => {
    const { container } = render(<MessageBubble message={{ ...base, direction }} continued={continued} />);
    const bubble = container.querySelector('[data-message-id] > div');
    expect(bubble?.classList.contains('rounded-md')).toBe(true);
    expect(container.querySelector('svg[viewBox="0 0 8 13"]')).toBeNull();
  });

  it('shows quotes, grouped reactions and accessible message actions', async () => {
    const onReply = vi.fn();
    const onReact = vi.fn();
    const quoted = { ...base, id: 'parent', textBody: 'Mensaje anterior' };
    render(<MessageBubble message={{ ...base, contextWaMessageId: 'parent-wa' }} continued={false} quotedByWaMessageId={{ 'parent-wa': quoted }} reactions={{ mine: '👍', theirs: '👍' }} onReply={onReply} onReact={onReact} />);
    expect(screen.getByText('Mensaje anterior')).toBeTruthy();
    expect(screen.getByLabelText('Reacciones').textContent).toBe('👍x2');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reaccionar al mensaje' }));
    await user.click(screen.getByRole('button', { name: 'Reaccionar 👍' }));
    expect(onReact).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), '');
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
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

  it('confirms before hiding a message and warns it only hides the inbox', async () => {
    const onHide = vi.fn();
    render(<MessageBubble message={base} continued={false} onHide={onHide} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toMatch(/WhatsApp no permite revocar mensajes/);
    expect(onHide).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onHide).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });

  it('wires onOpenImage into the attachment only for image messages', async () => {
    const onOpenImage = vi.fn();
    const { rerender } = render(<MessageBubble message={{ ...base, kind: 'image', mediaId: 'img-1', mediaMimeType: 'image/png' }} continued={false} onOpenImage={onOpenImage} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Abrir imagen de prueba' }));
    expect(onOpenImage).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), 'blob:test');

    rerender(<MessageBubble message={{ ...base, kind: 'document', mediaId: 'doc-1', mediaMimeType: 'application/pdf' }} continued={false} onOpenImage={onOpenImage} />);
    expect(screen.queryByRole('button', { name: 'Abrir imagen de prueba' })).toBeNull();
  });

  it('shows the time only once on an interactive message with a text body', () => {
    render(<MessageBubble message={{
      ...base, kind: 'interactive', textBody: '¿Qué servicio desea adquirir?',
      payload: { buttons: [{ id: 'b1', title: 'Ver planes' }] },
    }} continued={false} />);
    expect(screen.getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(1);
  });

  it('shows the time only once on a list message with a text body', () => {
    render(<MessageBubble message={{
      ...base, kind: 'interactive', textBody: 'Elige tu plan',
      payload: { buttonLabel: 'Ver opciones', rows: [{ id: 'r1', title: 'Netflix' }] },
    }} continued={false} />);
    expect(screen.getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(1);
  });

  it('renders maps and shared contact details', () => {
    const { unmount } = render(<MessageBubble message={{ ...base, kind: 'location', payload: { location: { latitude: 8.9, longitude: -79.5, name: 'Oficina' } } }} continued={false} />);
    expect(screen.getByRole('link', { name: 'Ubicación: Oficina' }).getAttribute('href')).toContain('8.9');
    unmount();
    render(<MessageBubble message={{ ...base, kind: 'contacts', payload: { contacts: [{ name: 'Ana', phone: '+50760000000' }] } }} continued={false} />);
    expect(screen.getByText('Ana · +50760000000')).toBeTruthy();
  });
});
