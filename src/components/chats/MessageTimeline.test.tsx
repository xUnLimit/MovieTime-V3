import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';

vi.mock('./MessageAttachment', () => ({
  MessageAttachment: ({ mediaId }: { mediaId: string }) => <span>Adjunto {mediaId}</span>,
}));

import { MessageTimeline } from './MessageTimeline';

const NOW = new Date(2026, 8, 27, 15, 30);

it('selecciona las acciones de un solo mensaje al tocarlo y las cierra al desplazar la conversación', () => {
  const { container } = render(<MessageTimeline messages={[message({ id: 'touch-1' }), message({ id: 'touch-2' })]} isLoading={false} unreadCount={0} now={NOW} onReact={vi.fn()} />);
  const first = container.querySelector('[data-message-id="touch-1"]')!;
  const second = container.querySelector('[data-message-id="touch-2"]')!;
  const touch = (target: Element) => { const event = new Event('pointerdown', { bubbles: true }); Object.defineProperty(event, 'pointerType', { value: 'touch' }); fireEvent(target, event); };
  touch(first);
  expect(first.getAttribute('data-actions-active')).toBe('true');
  touch(second);
  expect(first.getAttribute('data-actions-active')).toBe('false');
  expect(second.getAttribute('data-actions-active')).toBe('true');
  fireEvent.scroll(container.querySelector('.overflow-y-auto')!);
  expect(second.getAttribute('data-actions-active')).toBe('false');
});

function message(overrides: Partial<WhatsAppChatMessage>): WhatsAppChatMessage {
  return {
    id: 'm', direction: 'inbound', kind: 'text', textBody: 'Hola', templateName: null,
    occurredAt: new Date(2026, 8, 27, 10, 0).toISOString(), status: 'received',
    mediaId: null, mediaMimeType: null, mediaFilename: null, ...overrides,
    waMessageId: overrides.waMessageId ?? null, contextWaMessageId: overrides.contextWaMessageId ?? null,
    reactionEmoji: overrides.reactionEmoji ?? null, payload: overrides.payload ?? {},
  };
}

const messages = [
  message({ id: 'm1', textBody: '*Hola*' }),
  message({ id: 'm2', direction: 'outbound', textBody: null, templateName: 'vence_hoy', status: 'read' }),
  message({ id: 'm3', direction: 'outbound', textBody: 'Enviando', status: 'pending' }),
  message({ id: 'm4', direction: 'outbound', textBody: 'Falló', status: 'failed' }),
  message({ id: 'm5', direction: 'outbound', textBody: 'Entregado', status: 'delivered' }),
  message({ id: 'm6', direction: 'outbound', textBody: 'Aceptado', status: 'accepted' }),
  message({ id: 'm7', kind: 'image', textBody: 'Comprobante', mediaId: '777' }),
  message({ id: 'm8', kind: 'audio', textBody: null, mediaId: '778' }),
];

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

describe('MessageTimeline', () => {
  it('shows the text of an approved template with the values that were sent', () => {
    const sent = message({ id: 'tpl', direction: 'outbound', textBody: null, templateName: 'acceso_actualizado', templateParams: ['Buenas tardes, Allan', 'Crunchyroll'], status: 'read' });
    const catalog = [{ id: 'x', name: 'acceso_actualizado', language: 'es', status: 'APPROVED', category: 'UTILITY', body: '{{1}}. Actualizamos tu servicio de *{{2}}*.', header: null, footer: null, buttons: [{ type: 'QUICK_REPLY', text: 'Recibir mis datos' }], paramCount: 2, retired: false, syncedAt: '2026-09-29T00:00:00Z' }];
    render(<MessageTimeline messages={[sent]} isLoading={false} unreadCount={0} now={NOW} metaTemplates={catalog} />);
    expect(screen.getByText(/Buenas tardes, Allan/)).toBeTruthy();
    expect(screen.getByText('Crunchyroll').tagName).toBe('STRONG');
    expect(screen.getByLabelText('Botones de la plantilla').textContent).toBe('Recibir mis datos');
  });

  it('quotes a template with its text, not just its name, when the client replies to it', () => {
    const sent = message({ id: 'tpl', waMessageId: 'wa-tpl', direction: 'outbound', textBody: null, templateName: 'acceso_actualizado', templateParams: ['Buenas noches, Dino', 'Crunchyroll'], status: 'read' });
    const reply = message({ id: 'reply', textBody: 'Recibir mis datos', contextWaMessageId: 'wa-tpl' });
    const body = ['🔐 *Acceso actualizado*', '', '{{1}}. Actualizamos tu servicio de *{{2}}*.'].join('\n');
    const catalog = [{ id: 'x', name: 'acceso_actualizado', language: 'es', status: 'APPROVED', category: 'UTILITY', body, header: null, footer: null, buttons: [{ type: 'QUICK_REPLY', text: 'Recibir mis datos' }], paramCount: 2, retired: false, syncedAt: '2026-09-29T00:00:00Z' }];
    render(<MessageTimeline messages={[sent, reply]} isLoading={false} unreadCount={0} now={NOW} metaTemplates={catalog} />);
    expect(screen.getByText('🔐 Acceso actualizado Buenas noches, Dino. Actualizamos tu servicio de Crunchyroll.')).toBeTruthy();
    expect(screen.queryByText('Plantilla: acceso_actualizado')).toBeNull();
  });

  it('starts with the check and the heart, then moves the most used emoji to the front for every chat', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(undefined as unknown as string);
    const onReact = vi.fn();
    const target = message({ id: 'target', waMessageId: 'wa-target', textBody: 'Pago recibido' });
    const { unmount } = render(<MessageTimeline messages={[target]} isLoading={false} unreadCount={0} now={NOW} onReact={onReact} />);

    const picker = () => within(screen.getByLabelText('Reaccionar')).getAllByRole('button').map((button) => button.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Reaccionar al mensaje' }), { button: 0 });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reaccionar al mensaje' }), { button: 0, ctrlKey: false });
    expect(picker()).toEqual(['✅', '❤️', '👍', '😂', '😮', '😢', '🙏']);

    fireEvent.click(screen.getByRole('button', { name: 'Reaccionar 😂' }));
    expect(onReact).toHaveBeenCalledWith(expect.objectContaining({ id: 'target' }), '😂');
    expect(localStorage.setItem).toHaveBeenCalledWith('chat-reaction-usage', '{"😂":1}');
    unmount();

    // Otro chat: el conteo guardado mueve 😂 al frente.
    vi.mocked(localStorage.getItem).mockReturnValue('{"😂":1}');
    render(<MessageTimeline messages={[target]} isLoading={false} unreadCount={0} now={NOW} onReact={onReact} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reaccionar al mensaje' }), { button: 0, ctrlKey: false });
    expect(picker().slice(0, 3)).toEqual(['😂', '✅', '❤️']);
  });

  it('attaches reactions and quoted previews without rendering reaction events', () => {
    const original = message({ id: 'original', waMessageId: 'wa-original', textBody: 'Mensaje inicial' });
    const reply = message({ id: 'reply', textBody: 'Respuesta', contextWaMessageId: 'wa-original' });
    const reaction = message({ id: 'reaction', kind: 'reaction', textBody: null, contextWaMessageId: 'wa-original', reactionEmoji: '👍', direction: 'outbound' });
    render(<MessageTimeline messages={[original, reply, reaction]} isLoading={false} unreadCount={0} now={NOW} />);
    expect(screen.getAllByText('Mensaje inicial')).toHaveLength(2);
    expect(screen.getByText('👍')).toBeTruthy();
    expect(screen.getAllByLabelText('Opciones del mensaje')).toHaveLength(2);
  });

  it('highlights and scrolls to the selected search result', () => {
    const { container } = render(<MessageTimeline messages={[message({ id: 'match', textBody: 'Encontrar esto' })]} isLoading={false} unreadCount={0} now={NOW} searchQuery="encontrar" matchIds={['match']} activeMatchIndex={0} />);
    expect(container.querySelector('[data-message-id="match"] > div')?.className).toContain('ring');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
  it('renders day separators, formatted text, templates, attachments and every delivery state', () => {
    render(<MessageTimeline messages={messages} isLoading={false} unreadCount={0} now={NOW} />);

    expect(screen.getByText('Hoy')).toBeTruthy();
    expect(screen.getByText('Hola').tagName).toBe('STRONG');
    expect(screen.getByText('vence_hoy')).toBeTruthy();
    expect(screen.getByText('Plantilla')).toBeTruthy();
    expect(screen.getByLabelText('Leído')).toBeTruthy();
    expect(screen.getByLabelText('Enviando')).toBeTruthy();
    expect(screen.getByLabelText('No entregado')).toBeTruthy();
    expect(screen.getByLabelText('Entregado')).toBeTruthy();
    expect(screen.getByLabelText('Enviado')).toBeTruthy();
    expect(screen.getByText(/No se entregó/)).toBeTruthy();
    expect(screen.getByText('Adjunto 777')).toBeTruthy();
    expect(screen.getByText('Comprobante')).toBeTruthy();
    expect(screen.getByText('Adjunto 778')).toBeTruthy();
  });

  it('marks unread messages when opening the chat', () => {
    render(<MessageTimeline messages={messages.slice(0, 1)} isLoading={false} unreadCount={1} now={NOW} />);

    expect(screen.getByText('1 mensaje sin leer')).toBeTruthy();
  });

  it('shows loading and empty states', () => {
    const { unmount, container } = render(<MessageTimeline messages={[]} isLoading unreadCount={0} now={NOW} />);
    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThan(0);
    unmount();

    render(<MessageTimeline messages={[]} isLoading={false} unreadCount={0} now={NOW} />);
    expect(screen.getByText('Aún no hay mensajes en esta conversación.')).toBeTruthy();
  });

  it('offers a jump to new messages when reading older ones', () => {
    const { rerender, container } = render(
      <MessageTimeline messages={messages.slice(0, 2)} isLoading={false} unreadCount={0} now={NOW} />
    );
    const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement;
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });
    fireEvent.scroll(scroller);

    rerender(<MessageTimeline messages={[...messages.slice(0, 2), message({ id: 'new', textBody: 'Nuevo' })]} isLoading={false} unreadCount={0} now={NOW} />);
    const jump = screen.getByRole('button', { name: 'Ir a 1 mensajes nuevos' });

    fireEvent.click(jump);
    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' });
    expect(screen.queryByRole('button', { name: /mensajes nuevos/ })).toBeNull();
  });

  it('follows the conversation when the admin sends a message', () => {
    const { rerender, container } = render(
      <MessageTimeline messages={messages.slice(0, 1)} isLoading={false} unreadCount={0} now={NOW} />
    );
    const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement;

    rerender(<MessageTimeline messages={[...messages.slice(0, 1), message({ id: 'mine', direction: 'outbound', textBody: 'Listo', status: 'pending' })]} isLoading={false} unreadCount={0} now={NOW} />);

    expect(scroller.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });
});
