import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WhatsAppChatMessage, WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const state = vi.hoisted(() => ({
  sendMutate: vi.fn(),
  markRead: vi.fn(),
  markUnread: vi.fn(),
  ventas: [] as unknown[],
  context: null as unknown,
  wide: false,
  messages: [] as WhatsAppChatMessage[],
}));
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-whatsapp-chat', () => ({
  useWhatsAppMessages: () => ({ data: state.messages, isLoading: false }),
  useSendWhatsAppMessage: () => ({ mutate: state.sendMutate, isPending: false }),
  useMarkWhatsAppConversationRead: () => ({ mutate: state.markRead }),
  useMarkWhatsAppConversationUnread: () => ({ mutate: state.markUnread }),
  useVentaMessageContext: (ventaId: string | null) => ({ data: ventaId ? state.context : null }),
  useUploadWhatsAppMedia: () => ({ mutateAsync: vi.fn() }),
  useWhatsAppMedia: () => ({ objectUrl: null, isLoading: false, isError: false }),
}));
vi.mock('@/hooks/use-templates', () => ({
  useTemplates: () => ({
    data: [
      { id: '1', nombre: 'Día', tipo: 'dia_pago', contenido: '{saludo}, pagar {categoria} {monto}', placeholders: [], activo: true },
      { id: '2', nombre: 'Datos', tipo: 'suscripcion', contenido: 'Clave: {contrasena}', placeholders: [], activo: true },
    ],
  }),
}));
vi.mock('@/hooks/use-ventas-tercero', () => ({
  useVentasTercero: () => ({ ventas: state.ventas, isLoading: false }),
}));
vi.mock('@/platform/utils/whatsapp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/utils/whatsapp')>()),
  getSaludo: () => 'Buenas tardes',
}));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

import { ChatWorkspace } from './ChatWorkspace';

const NOW = new Date(2026, 8, 27, 15, 30);

const open: WhatsAppConversation = {
  waId: '50760000000', contactName: 'Mary', terceroId: 't1', terceroNombre: 'María Pérez',
  lastDirection: 'inbound', lastPreview: 'Hola', lastMessageAt: NOW.toISOString(),
  lastInboundAt: new Date(2026, 8, 27, 14, 30).toISOString(), unreadCount: 1, nextExpiry: '2026-09-27',
};
const closed: WhatsAppConversation = { ...open, lastInboundAt: null, unreadCount: 0 };

const venta = {
  id: 'v1', clienteId: 't1', categoriaId: 'c', categoriaNombre: 'Netflix', servicioId: 's', servicioNombre: 'Netflix 01',
  servicioCorreo: 'x', perfilNumero: 1, cicloPago: 'mensual', fechaInicio: null, fechaFin: new Date(2026, 8, 27),
  precio: 4.5, precioFinal: 4.5, estado: 'activo', moneda: 'USD',
};

function renderWorkspace(conversation = open, overrides: Partial<Parameters<typeof ChatWorkspace>[0]> = {}) {
  const props = { conversation, now: NOW, panelPreferred: false, onPanelPreferredChange: vi.fn(), onBack: vi.fn(), ...overrides };
  render(<ChatWorkspace {...props} />);
  return props;
}

beforeEach(() => {
  state.sendMutate.mockReset();
  state.markRead.mockReset();
  state.markUnread.mockReset();
  state.ventas = [venta];
  state.context = {
    clienteNombre: 'María Pérez', categoriaNombre: 'Netflix', servicioNombre: 'Netflix 01', perfilNombre: 'María',
    correo: 'c@example.com', contrasena: 'clave-demo', codigo: '', fechaVencimiento: new Date(2026, 8, 27), monto: 4.5,
  };
  state.wide = false;
  state.messages = [];
  toastError.mockReset();
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: state.wide })) as unknown as typeof window.matchMedia;
});

describe('ChatWorkspace', () => {
  it('retries and forwards media using the original media ID', async () => {
    const original: WhatsAppChatMessage = { id: 'media-message', waMessageId: 'wa-media', direction: 'outbound', kind: 'document', textBody: 'Archivo', templateName: null, occurredAt: NOW.toISOString(), status: 'failed', mediaId: 'media-123', mediaMimeType: 'application/pdf', mediaFilename: 'nota.pdf', contextWaMessageId: null, reactionEmoji: null, payload: {} };
    state.messages = [original];
    state.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'accepted' }));
    const user = userEvent.setup();
    renderWorkspace(open, { conversations: [open, { ...open, waId: '50761111111', contactName: 'Pedro', terceroNombre: null }] });
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reintentar' }));
    expect(state.sendMutate).toHaveBeenCalledWith(expect.objectContaining({ message: expect.objectContaining({ kind: 'document', mediaId: 'media-123', mimeType: 'application/pdf' }) }), expect.any(Object));
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reenviar' }));
    await user.click(screen.getByRole('button', { name: /Pedro/ }));
    expect(state.sendMutate).toHaveBeenCalledWith(expect.objectContaining({ to: '50761111111', message: expect.objectContaining({ mediaId: 'media-123' }) }), expect.any(Object));
  });

  it('sends and removes reactions through a fresh attempt', async () => {
    state.messages = [{ id: 'm1', waMessageId: 'wa-m1', direction: 'inbound', kind: 'text', textBody: 'Hola', templateName: null, occurredAt: NOW.toISOString(), status: 'received', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} }];
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('button', { name: 'Reaccionar 👍' }));
    expect(state.sendMutate).toHaveBeenCalledWith(expect.objectContaining({ message: { kind: 'reaction', targetWaMessageId: 'wa-m1', emoji: '👍' }, idempotencyKey: expect.any(String) }), expect.any(Object));
  });
  it('restores a draft per chat and clears it after sending', async () => {
    const storage = new Map<string, string>();
    vi.mocked(window.localStorage.getItem).mockImplementation((key) => storage.get(key) ?? null);
    vi.mocked(window.localStorage.setItem).mockImplementation((key, value) => { storage.set(key, value); });
    vi.mocked(window.localStorage.removeItem).mockImplementation((key) => { storage.delete(key); });
    window.localStorage.setItem(`chat-draft:${open.waId}`, 'Borrador guardado');
    expect(window.localStorage.getItem(`chat-draft:${open.waId}`)).toBe('Borrador guardado');
    state.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'accepted' }));
    renderWorkspace();
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Borrador guardado');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(window.localStorage.getItem(`chat-draft:${open.waId}`)).toBeNull();
  });

  it('searches the thread and sends a reply with its WhatsApp context', async () => {
    state.messages = [{ id: 'm1', waMessageId: 'wamid-1', direction: 'inbound', kind: 'text', textBody: 'Hola María', templateName: null, occurredAt: NOW.toISOString(), status: 'received', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} }];
    state.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'accepted' }));
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Buscar en la conversación' }));
    await user.type(screen.getByLabelText('Buscar en la conversación'), 'hola');
    expect(screen.getByText('1/1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Responder' }));
    await user.type(screen.getByLabelText('Mensaje'), 'Listo{Enter}');
    expect(state.sendMutate).toHaveBeenCalledWith(expect.objectContaining({ message: { kind: 'text', text: 'Listo', replyTo: 'wamid-1' } }), expect.any(Object));
  });
  it('marks the chat read and sends text with an idempotency key', async () => {
    const user = userEvent.setup();
    state.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'accepted' }));
    renderWorkspace();

    expect(state.markRead).toHaveBeenCalledWith({ waId: '50760000000', readAt: expect.any(String) });
    await user.type(screen.getByLabelText('Mensaje'), 'Hola María{Enter}');

    expect(state.sendMutate).toHaveBeenCalledWith(
      { to: '50760000000', message: { kind: 'text', text: 'Hola María' }, idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/) },
      expect.any(Object)
    );
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('');
  });

  it('reuses the key on retry and explains rejections', async () => {
    const user = userEvent.setup();
    state.sendMutate
      .mockImplementationOnce((_input, options) => options.onError(new Error('offline')))
      .mockImplementationOnce((_input, options) => options.onSuccess({ sendStatus: 'failed', errorTitle: 'Número inválido' }));
    renderWorkspace();

    await user.type(screen.getByLabelText('Mensaje'), 'Hola{Enter}');
    await user.type(screen.getByLabelText('Mensaje'), '{Enter}');

    const [first, second] = state.sendMutate.mock.calls.map(([input]) => input.idempotencyKey);
    expect(first).toBe(second);
    expect(toastError).toHaveBeenCalledWith('No se pudo enviar el mensaje. Intenta de nuevo.');
    expect(toastError).toHaveBeenCalledWith('WhatsApp rechazó el mensaje: Número inválido');
  });

  it('fills an editor message with the sale data from the customer panel', async () => {
    const user = userEvent.setup();
    renderWorkspace(open, { panelPreferred: true });

    const panel = screen.getAllByRole('complementary', { name: 'Ficha del cliente' })[0];
    await user.click(within(panel).getByRole('button', { name: 'Datos de acceso' }));

    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Clave: clave-demo');
  });

  it('asks for a sale when the quick reply has no data', async () => {
    const user = userEvent.setup();
    state.ventas = [];
    renderWorkspace();

    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas' }));
    expect(screen.getByRole('menuitem', { name: 'Día de pago' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('opens the suggested Meta template pre-filled when the window is closed', async () => {
    const user = userEvent.setup();
    state.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'accepted' }));
    renderWorkspace(closed);

    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Datos tomados de Netflix/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Enviar plantilla' }));

    expect(state.sendMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        message: { kind: 'template', templateName: 'vence_hoy', params: ['Netflix', '27 de septiembre de 2026', '$4.50'] },
      }),
      expect.any(Object)
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('marks the chat unread and returns to the list', async () => {
    const user = userEvent.setup();
    state.markUnread.mockImplementation((_input, options) => options.onSuccess());
    const props = renderWorkspace();

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: /Marcar como no leído/ }));

    expect(state.markUnread).toHaveBeenCalledWith(
      { waId: '50760000000', lastInboundAt: open.lastInboundAt },
      expect.any(Object)
    );
    expect(props.onBack).toHaveBeenCalled();
  });

  it('overlays the panel on narrow screens and pins it on wide ones', async () => {
    const user = userEvent.setup();
    const props = renderWorkspace();

    await user.click(screen.getByRole('button', { name: 'Ver ficha de María Pérez' }));
    expect(screen.getByRole('complementary', { name: 'Ficha del cliente' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cerrar ficha' }));
    expect(screen.queryByRole('complementary', { name: 'Ficha del cliente' })).toBeNull();
    expect(props.onPanelPreferredChange).toHaveBeenCalledWith(false);

    state.wide = true;
    await user.click(screen.getByRole('button', { name: 'Ver ficha de María Pérez' }));
    expect(props.onPanelPreferredChange).toHaveBeenCalledWith(true);
  });

  it('does not undo "Marcar como no leído" when the list refreshes while the chat is still open', async () => {
    const user = userEvent.setup();
    const props = { now: NOW, panelPreferred: false, onPanelPreferredChange: vi.fn(), onBack: vi.fn() };
    const readChat = { ...open, unreadCount: 0 };
    const { rerender } = render(<ChatWorkspace conversation={readChat} {...props} />);
    expect(state.markRead).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: /Marcar como no leído/ }));
    rerender(<ChatWorkspace conversation={{ ...readChat, unreadCount: 1 }} {...props} />);

    expect(state.markUnread).toHaveBeenCalled();
    expect(state.markRead).not.toHaveBeenCalled();
  });

});
