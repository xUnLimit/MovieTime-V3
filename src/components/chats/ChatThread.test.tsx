import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WhatsAppChatMessage, WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const hooks = vi.hoisted(() => ({
  messages: [] as WhatsAppChatMessage[],
  sendMutate: vi.fn(),
  markReadMutate: vi.fn(),
  isPending: false,
}));
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-whatsapp-chat', () => ({
  useWhatsAppMessages: () => ({ data: hooks.messages, isLoading: false }),
  useSendWhatsAppMessage: () => ({ mutate: hooks.sendMutate, isPending: hooks.isPending }),
  useMarkWhatsAppConversationRead: () => ({ mutate: hooks.markReadMutate }),
}));
vi.mock('sonner', () => ({ toast: { error: toastError } }));
vi.mock('@/platform/utils/whatsapp', () => ({ getSaludo: () => 'Buenas tardes' }));

import { ChatThread } from './ChatThread';

const NOW = new Date(2026, 8, 27, 15, 30);

const openConversation: WhatsAppConversation = {
  waId: '50760000000', contactName: 'Mary', terceroId: 't1', terceroNombre: 'María Pérez',
  lastDirection: 'inbound', lastPreview: 'Hola', lastMessageAt: new Date(2026, 8, 27, 14, 30).toISOString(),
  lastInboundAt: new Date(2026, 8, 27, 14, 30).toISOString(), unreadCount: 1,
};

const closedConversation: WhatsAppConversation = {
  ...openConversation, terceroId: null, terceroNombre: null, contactName: null, lastInboundAt: null, unreadCount: 0,
};

beforeEach(() => {
  hooks.messages = [
    { id: 'm1', direction: 'inbound', kind: 'text', textBody: 'Hola', templateName: null, occurredAt: openConversation.lastMessageAt, status: 'received' },
    { id: 'm2', direction: 'outbound', kind: 'template', textBody: null, templateName: 'vence_hoy', occurredAt: openConversation.lastMessageAt, status: 'read' },
    { id: 'm3', direction: 'outbound', kind: 'text', textBody: 'Falló', templateName: null, occurredAt: openConversation.lastMessageAt, status: 'failed' },
  ];
  hooks.sendMutate.mockReset();
  hooks.markReadMutate.mockReset();
  hooks.isPending = false;
  toastError.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ChatThread', () => {
  it('shows the conversation, its messages and delivery states, and marks it read', () => {
    render(<ChatThread conversation={openConversation} now={NOW} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'María Pérez' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver cliente' }).getAttribute('href')).toBe('/terceros/t1');
    expect(screen.getByText('Plantilla: Vence hoy')).toBeTruthy();
    expect(screen.getByText(/Leído/)).toBeTruthy();
    expect(screen.getByText(/No entregado/)).toBeTruthy();
    expect(screen.getByText(/Ventana abierta · 23 h restantes/)).toBeTruthy();
    expect(hooks.markReadMutate).toHaveBeenCalledWith({ waId: '50760000000', readAt: expect.any(String) });
  });

  it('sends free text with an idempotency key and clears the draft on success', async () => {
    const user = userEvent.setup();
    hooks.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'accepted' }));
    render(<ChatThread conversation={openConversation} now={NOW} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText('Mensaje'), 'Hola María{Enter}');

    expect(hooks.sendMutate).toHaveBeenCalledWith(
      { to: '50760000000', message: { kind: 'text', text: 'Hola María' }, idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/) },
      expect.any(Object)
    );
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('');
  });

  it('reuses the idempotency key when retrying after a network error', async () => {
    const user = userEvent.setup();
    hooks.sendMutate.mockImplementation((_input, options) => options.onError(new Error('offline')));
    render(<ChatThread conversation={openConversation} now={NOW} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText('Mensaje'), 'Hola');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    const keys = hooks.sendMutate.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(toastError).toHaveBeenCalledWith('No se pudo enviar el mensaje. Intenta de nuevo.');
  });

  it('keeps the draft and explains when WhatsApp rejects the message', async () => {
    const user = userEvent.setup();
    hooks.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'failed', errorTitle: 'Número inválido' }));
    render(<ChatThread conversation={openConversation} now={NOW} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText('Mensaje'), 'Hola{Enter}');

    expect(toastError).toHaveBeenCalledWith('WhatsApp rechazó el mensaje: Número inválido');
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Hola');
  });

  it('only offers templates when the 24 hour window is closed', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    hooks.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'accepted' }));
    render(<ChatThread conversation={closedConversation} now={NOW} onBack={onBack} />);

    expect(screen.queryByLabelText('Mensaje')).toBeNull();
    expect(screen.getByText(/No registrado/)).toBeTruthy();
    expect(hooks.markReadMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    const greeting = screen.getByLabelText('Saludo y nombre') as HTMLInputElement;
    expect(greeting.value).toBe('Buenas tardes');

    await user.type(screen.getByLabelText('Servicio'), 'Netflix');
    await user.type(screen.getByLabelText('Fecha de vencimiento'), '30/09/2026');
    await user.type(screen.getByLabelText('Monto'), '$4.50');
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));

    expect(hooks.sendMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        message: { kind: 'template', templateName: 'recordatorio_vencimiento', params: ['Buenas tardes', 'Netflix', '30/09/2026', '$4.50'] },
      }),
      expect.any(Object)
    );

    await user.click(screen.getByRole('button', { name: 'Volver a la lista' }));
    expect(onBack).toHaveBeenCalled();
  });
});
