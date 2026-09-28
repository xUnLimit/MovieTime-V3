import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WhatsAppChatMessage, WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const state = vi.hoisted(() => ({
  sendMutate: vi.fn(),
  markRead: vi.fn(),
  markUnread: vi.fn(),
  hideMessage: vi.fn(),
  saveSticker: vi.fn(),
  ventas: [] as unknown[],
  context: null as unknown,
  wide: false,
  mediaListener: null as (() => void) | null,
  messages: [] as WhatsAppChatMessage[],
  mediaObjectUrl: null as string | null,
  tipos: [] as unknown[],
  metas: [] as unknown[],
}));
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-whatsapp-chat', () => ({
  useWhatsAppMessages: () => ({ data: state.messages, isLoading: false }),
  useSendWhatsAppMessage: () => ({ mutate: state.sendMutate, isPending: false }),
  useMarkWhatsAppConversationRead: () => ({ mutate: state.markRead }),
  useMarkWhatsAppConversationUnread: () => ({ mutate: state.markUnread }),
  useHideWhatsAppMessage: () => ({ mutate: state.hideMessage }),
  useVentaMessageContext: (ventaId: string | null) => ({ data: ventaId ? state.context : null }),
  useUploadWhatsAppMedia: () => ({ mutateAsync: vi.fn() }),
  useWhatsAppMedia: () => ({ objectUrl: state.mediaObjectUrl, isLoading: false, isError: false }),
}));
vi.mock('@/hooks/use-templates', () => ({
  useTemplates: () => ({ data: state.tipos }),
  useMetaTemplates: () => ({ data: state.metas }),
}));
vi.mock('@/hooks/use-chat-saved-stickers', () => ({
  useChatSavedStickers: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSaveChatSticker: () => ({ mutate: state.saveSticker }),
  useDeleteChatSticker: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/use-chat-saved-messages', () => ({
  useChatSavedMessages: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
// El dialogo de acciones (registrar cliente / generar venta) reutiliza formularios
// pesados con su propia cadena de datos; se prueba por separado en su propio test.
vi.mock('./ChatActionsDialog', () => ({
  ChatActionsDialog: () => null,
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
  activeCategories: [],
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
  state.hideMessage.mockReset();
  state.mediaObjectUrl = null;
  state.ventas = [venta];
  state.context = {
    clienteNombre: 'María Pérez', categoriaNombre: 'Netflix', servicioNombre: 'Netflix 01', perfilNombre: 'María',
    correo: 'c@example.com', contrasena: 'clave-demo', codigo: '', fechaVencimiento: new Date(2026, 8, 27), monto: 4.5,
  };
  state.tipos = [{
    id: 'tpl-dia', nombre: 'Día de pago', tipo: 'dia_pago', contenido: '', placeholders: [], activo: true,
    metaTemplateName: 'aviso_vence_hoy', metaParamMap: ['servicios', 'vencimiento', 'monto_total'],
  }];
  state.metas = [{
    id: 'm1', name: 'aviso_vence_hoy', language: 'es', status: 'APPROVED', category: 'UTILITY',
    body: 'Vence hoy {{1}} el {{2}} por {{3}}', header: null, footer: null, buttons: [], paramCount: 3, retired: false, syncedAt: '2026-09-28T10:00:00Z',
  }];
  state.wide = false;
  state.mediaListener = null;
  state.messages = [];
  toastError.mockReset();
  // Sin esto, un test anterior que deja un borrador guardado (localStorage
  // sigue siendo el mismo mock entre tests) filtra su valor a los siguientes.
  vi.mocked(window.localStorage.getItem).mockReset().mockReturnValue(null);
  vi.mocked(window.localStorage.setItem).mockReset();
  vi.mocked(window.localStorage.removeItem).mockReset();
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() { return state.wide; },
    addEventListener: (_event: string, listener: () => void) => { state.mediaListener = listener; },
    removeEventListener: () => { state.mediaListener = null; },
  })) as unknown as typeof window.matchMedia;
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
    await user.click(screen.getByRole('button', { name: 'Reaccionar al mensaje' }));
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
    await user.click(screen.getByRole('button', { name: 'Buscar en la conversación' }));
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

  it('clears the composer right away and reuses the key while retrying the same attempt', async () => {
    const user = userEvent.setup();
    state.sendMutate
      .mockImplementationOnce((_input, options) => options.onError(new Error('offline')))
      .mockImplementationOnce((_input, options) => options.onSuccess({ sendStatus: 'failed', errorTitle: 'Número inválido' }));
    renderWorkspace();

    await user.type(screen.getByLabelText('Mensaje'), 'Hola{Enter}');
    // El cuadro se vacia al instante, sin esperar la respuesta del servidor.
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('');
    await user.type(screen.getByLabelText('Mensaje'), 'Hola{Enter}');

    const [first, second] = state.sendMutate.mock.calls.map(([input]) => input.idempotencyKey);
    expect(first).toBe(second);
    expect(toastError).toHaveBeenCalledWith('No se pudo enviar el mensaje. Intenta de nuevo.');
    expect(toastError).toHaveBeenCalledWith('WhatsApp rechazó el mensaje: Número inválido');
  });

  it('offers saved messages even when the client has no active sale', async () => {
    state.ventas = [];
    renderWorkspace();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Respuestas rápidas y acciones' }));
    expect(screen.getByRole('menuitem', { name: 'Mensajes guardados' })).toBeTruthy();
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
        message: { kind: 'template', templateName: 'aviso_vence_hoy', params: ['Netflix', '27 de septiembre de 2026', '$4.50'] },
      }),
      expect.any(Object)
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists no template when none is approved and linked', async () => {
    const user = userEvent.setup();
    state.metas = [];
    renderWorkspace(closed);

    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    expect(within(screen.getByRole('dialog')).getByText(/No hay plantillas de Meta aprobadas/)).toBeTruthy();
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
    act(() => state.mediaListener?.());
    await user.click(screen.getByRole('button', { name: 'Ver ficha de María Pérez' }));
    expect(props.onPanelPreferredChange).toHaveBeenCalledWith(true);
  });

  it('does not report a hidden customer panel as open on a narrow screen', async () => {
    const user = userEvent.setup();
    renderWorkspace(open, { panelPreferred: true });
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Mostrar ficha del cliente' })).toBeTruthy();
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

  it('sends reply buttons from the composer, quoting the selected message', async () => {
    state.messages = [{ id: 'm1', waMessageId: 'wamid-1', direction: 'inbound', kind: 'text', textBody: 'Quiero renovar', templateName: null, occurredAt: NOW.toISOString(), status: 'received', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} }];
    state.sendMutate.mockImplementation((_input, options) => options.onSuccess({ sendStatus: 'accepted' }));
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Responder' }));
    await user.click(screen.getByRole('button', { name: 'Abrir acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Botones o lista' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Texto del mensaje'), '¿Cómo quieres pagar?');
    await user.type(within(dialog).getByRole('textbox', { name: 'Botón 1' }), 'Yappy');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar botón' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Botón 2' }), 'Efectivo');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar mensaje' }));
    expect(state.sendMutate).toHaveBeenCalledWith(expect.objectContaining({ message: {
      kind: 'buttons', body: '¿Cómo quieres pagar?', buttons: [{ id: 'btn-1', title: 'Yappy' }, { id: 'btn-2', title: 'Efectivo' }], replyTo: 'wamid-1',
    } }), expect.any(Object));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Respondiendo a/)).toBeNull();
  });

  it('validates and sends a list message', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Abrir acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Botones o lista' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: /Lista/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Enviar mensaje' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Escribe el texto del mensaje.');
    expect(state.sendMutate).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText('Texto del mensaje'), 'Elige tu plan');
    await user.type(within(dialog).getByRole('textbox', { name: 'Opción 1' }), 'Netflix 1 mes');
    await user.type(within(dialog).getByRole('textbox', { name: 'Descripción de la opción 1' }), '$4.50');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar mensaje' }));
    expect(state.sendMutate).toHaveBeenCalledWith(expect.objectContaining({ message: {
      kind: 'list', body: 'Elige tu plan', buttonLabel: 'Ver opciones', rows: [{ id: 'row-1', title: 'Netflix 1 mes', description: '$4.50' }],
    } }), expect.any(Object));
  });

  it('shows sent buttons in the bubble and retries a failed interactive message', async () => {
    state.messages = [{ id: 'i1', waMessageId: null, direction: 'outbound', kind: 'interactive', textBody: '¿Cómo quieres pagar?', templateName: null, occurredAt: NOW.toISOString(), status: 'failed', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: { buttons: [{ id: 'btn-1', title: 'Yappy' }] } }];
    const user = userEvent.setup();
    renderWorkspace();
    expect(within(screen.getByLabelText('Botones del mensaje')).getByText('Yappy')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reintentar' }));
    expect(state.sendMutate).toHaveBeenCalledWith(expect.objectContaining({ message: {
      kind: 'buttons', body: '¿Cómo quieres pagar?', buttons: [{ id: 'btn-1', title: 'Yappy' }],
    } }), expect.any(Object));
  });

  it('shows a sent list with its options', () => {
    state.messages = [{ id: 'l1', waMessageId: 'wa-l1', direction: 'outbound', kind: 'interactive', textBody: 'Elige tu plan', templateName: null, occurredAt: NOW.toISOString(), status: 'delivered', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: { buttonLabel: 'Ver planes', rows: [{ id: 'row-1', title: 'Netflix', description: '$4.50' }] } }];
    renderWorkspace();
    const options = screen.getByLabelText('Opciones de la lista');
    expect(within(options).getByText('Ver planes')).toBeTruthy();
    expect(within(options).getByText('• Netflix — $4.50')).toBeTruthy();
  });

  it('hides buttons and lists when the 24-hour window is closed', () => {
    renderWorkspace(closed);
    expect(screen.queryByRole('button', { name: 'Abrir acciones' })).toBeNull();
  });

  it('hides a message from the inbox after confirming, without contacting WhatsApp', async () => {
    state.messages = [{ id: 'm1', waMessageId: 'wamid-1', direction: 'inbound', kind: 'text', textBody: 'Hola', templateName: null, occurredAt: NOW.toISOString(), status: 'received', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} }];
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Eliminar', hidden: true }));
    expect(state.hideMessage).toHaveBeenCalledWith({ messageId: 'm1', direction: 'inbound' }, expect.any(Object));
  });

  it('shows a toast when hiding a message fails on the server', async () => {
    state.messages = [{ id: 'm1', waMessageId: 'wamid-1', direction: 'inbound', kind: 'text', textBody: 'Hola', templateName: null, occurredAt: NOW.toISOString(), status: 'received', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} }];
    state.hideMessage.mockImplementation((_input, options) => options.onError(new Error('rpc missing')));
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Opciones del mensaje' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar', hidden: true }));
    expect(toastError).toHaveBeenCalledWith('No se pudo eliminar el mensaje. Intenta de nuevo.');
  });

  it('opens an image message in a lightbox instead of a new tab', async () => {
    state.messages = [{ id: 'img1', waMessageId: 'wa-img1', direction: 'inbound', kind: 'image', textBody: null, templateName: null, occurredAt: NOW.toISOString(), status: 'received', mediaId: 'media-1', mediaMimeType: 'image/jpeg', mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} }];
    state.mediaObjectUrl = 'blob:image-1';
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Ver imagen en grande' }));
    expect(screen.getByRole('dialog', { name: 'Imagen del mensaje' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog', { name: 'Imagen del mensaje' })).toBeNull();
  });

  it('shows a mic button that switches to send once text is typed', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(screen.getByRole('button', { name: 'Grabar audio' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar mensaje' })).toBeNull();
    await user.type(screen.getByLabelText('Mensaje'), 'Hola');
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Grabar audio' })).toBeNull();
  });

  it('keeps slash in the composer as message text', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.type(screen.getByLabelText('Mensaje'), '/');
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('/');
  });
});
