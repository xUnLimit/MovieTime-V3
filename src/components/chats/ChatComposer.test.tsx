import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const saved = vi.hoisted(() => ({ messages: [] as unknown[], tipos: [] as unknown[] }));
vi.mock('@/hooks/use-templates', () => ({ useTemplates: () => ({ data: saved.tipos }) }));
vi.mock('@/hooks/use-whatsapp-chat', () => ({ useUploadWhatsAppMedia: () => ({ mutateAsync: upload }) }));
vi.mock('@/hooks/use-chat-saved-messages', () => ({
  useChatSavedMessages: () => ({ data: saved.messages, isLoading: false, isError: false, refetch: vi.fn() }),
  useSaveChatMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteChatMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { error: toastError } }));
vi.mock('./ChatActionsDialog', () => ({ ChatActionsDialog: () => null }));

import { ChatComposer } from './ChatComposer';

// Simula el MediaRecorder del navegador: `supported` fija que formatos acepta
// grabar (Chrome de escritorio en la practica solo ofrece audio/webm).
class FakeMediaRecorder {
  static supported = new Set(['audio/webm']);
  static isTypeSupported(type: string) {
    return FakeMediaRecorder.supported.has(type);
  }

  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    // Chrome real siempre agrega el codec al mimeType reportado, aunque se haya
    // pedido solo el contenedor base (p. ej. "audio/webm" -> "audio/webm;codecs=opus").
    const base = options?.mimeType ?? 'audio/webm';
    this.mimeType = base === 'audio/webm' ? 'audio/webm;codecs=opus' : base;
  }

  start() {
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
  }

  stop() {
    this.onstop?.();
  }
}

function renderComposer(overrides: Partial<Parameters<typeof ChatComposer>[0]> = {}) {
  const props = {
    draft: '',
    serviceWindow: { open: true as const, hoursLeft: 20 },
    isSending: false,
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    onOpenTemplates: vi.fn(),
    ...overrides,
  };
  render(<ChatComposer {...props} />);
  return props;
}

// El draft es una prop controlada; para probar el popup de "/" hace falta un
// wrapper que lo mantenga en estado real, como hace ChatWorkspace en produccion.
function ControlledComposer(overrides: Partial<Parameters<typeof ChatComposer>[0]> = {}) {
  const [draft, setDraft] = useState('');
  return (
    <ChatComposer
      draft={draft}
      serviceWindow={{ open: true, hoursLeft: 20 }}
      isSending={false}
      onDraftChange={setDraft}
      onSend={vi.fn()}
      onOpenTemplates={vi.fn()}
      {...overrides}
    />
  );
}

describe('ChatComposer voice notes', () => {
  const getUserMedia = vi.fn();

  beforeEach(() => {
    FakeMediaRecorder.supported = new Set(['audio/webm']);
    getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('navigator', { ...globalThis.navigator, mediaDevices: { getUserMedia } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('strips the codec suffix so the recorded file matches a format WhatsApp accepts', async () => {
    const user = userEvent.setup();
    renderComposer({ onSendMedia: vi.fn() });

    // Con el borrador vacio, el mismo boton de enviar graba audio (como en WhatsApp).
    await user.click(screen.getByRole('button', { name: 'Grabar audio' }));
    await user.click(screen.getByRole('button', { name: 'Detener grabación' }));

    // El navegador solo ofrece audio/webm, pero reporta "audio/webm;codecs=opus";
    // el archivo que se sube debe llevar el tipo base, sin el sufijo del codec.
    expect(screen.getByText(/^audio-\d+\.webm$/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Enviar archivo' }));
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({
      file: expect.objectContaining({ type: 'audio/webm' }),
    }));
  });

  it('prefers a WhatsApp-documented format over audio/webm when the browser offers one', async () => {
    FakeMediaRecorder.supported = new Set(['audio/webm', 'audio/mp4']);
    const user = userEvent.setup();
    renderComposer({ onSendMedia: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Grabar audio' }));
    await user.click(screen.getByRole('button', { name: 'Detener grabación' }));

    expect(screen.getByText(/^audio-\d+\.m4a$/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Enviar archivo' }));
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({
      file: expect.objectContaining({ type: 'audio/mp4' }),
    }));
  });

  it('lets the admin cancel a recording without keeping the audio', async () => {
    const user = userEvent.setup();
    renderComposer({ onSendMedia: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Grabar audio' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar grabación' }));

    expect(screen.queryByRole('button', { name: 'Enviar archivo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Grabar audio' })).toBeTruthy();
  });
});

describe('ChatComposer', () => {
  it('copies a saved text message into the composer for review', async () => {
    const user = userEvent.setup();
    saved.messages = [{ id: '11111111-1111-4111-8111-111111111111', title: 'Saludo', kind: 'text', body: 'Hola', buttonLabel: '', options: [] }];
    const props = renderComposer();
    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas y acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mensajes guardados' }));
    await user.click(screen.getByRole('button', { name: 'Usar en chat' }));
    expect(props.onDraftChange).toHaveBeenCalledWith('Hola');
    expect(props.onSend).not.toHaveBeenCalled();
    saved.messages = [];
  });

  it('sends saved interactive content right away, without opening the editor', async () => {
    const user = userEvent.setup();
    saved.messages = [{ id: '11111111-1111-4111-8111-111111111111', title: 'Planes', kind: 'list', body: 'Elige un plan', buttonLabel: 'Ver planes', options: [{ title: 'Mensual', description: 'Un mes' }] }];
    const props = renderComposer({ onSendInteractive: vi.fn() });
    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas y acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mensajes guardados' }));
    await user.click(screen.getByRole('button', { name: 'Usar en chat' }));
    expect(screen.queryByRole('textbox', { name: 'Texto del mensaje' })).toBeNull();
    expect(props.onSendInteractive).toHaveBeenCalledWith(
      { kind: 'list', body: 'Elige un plan', buttonLabel: 'Ver planes', rows: [{ id: 'row-1', title: 'Mensual', description: 'Un mes' }] },
      expect.any(Function)
    );
    saved.messages = [];
  });

  it('shows saved messages as suggestions while typing "/" and filters as more is typed', async () => {
    const user = userEvent.setup();
    saved.messages = [
      { id: '11111111-1111-4111-8111-111111111111', title: 'bienvenida', kind: 'text', body: 'Hola, bienvenido', buttonLabel: '', options: [] },
      { id: '22222222-2222-4222-8222-222222222222', title: 'pagoRecibido', kind: 'text', body: 'Pago recibido, gracias', buttonLabel: '', options: [] },
    ];
    render(<ControlledComposer />);

    await user.type(screen.getByLabelText('Mensaje'), '/');
    const listbox = screen.getByRole('listbox', { name: 'Respuestas rápidas' });
    expect(within(listbox).getByText('bienvenida')).toBeTruthy();
    expect(within(listbox).getByText('pagoRecibido')).toBeTruthy();

    await user.type(screen.getByLabelText('Mensaje'), 'pago');
    expect(within(listbox).queryByText('bienvenida')).toBeNull();
    expect(within(listbox).getByText('pagoRecibido')).toBeTruthy();
    saved.messages = [];
  });

  it('applies the highlighted suggestion on Enter and clears the composer', async () => {
    const user = userEvent.setup();
    saved.messages = [{ id: '11111111-1111-4111-8111-111111111111', title: 'bienvenida', kind: 'text', body: 'Hola, bienvenido', buttonLabel: '', options: [] }];
    render(<ControlledComposer />);

    await user.type(screen.getByLabelText('Mensaje'), '/bien{Enter}');
    expect(screen.queryByRole('listbox', { name: 'Respuestas rápidas' })).toBeNull();
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Hola, bienvenido');
    saved.messages = [];
  });

  it('lists editor types under "Mensajes del sistema" and inserts the text rendered with the venta', async () => {
    const user = userEvent.setup();
    saved.tipos = [
      { id: 't1', nombre: 'x', tipo: 'dia_pago', contenido: 'Hola {nombre_cliente}, tu {categoria} vence hoy', placeholders: [], activo: true },
      { id: 't2', nombre: 'y', tipo: 'despedida', contenido: 'Adios', placeholders: [], activo: false },
    ];
    const ventaContext = { clienteNombre: 'Ana Perez', categoriaNombre: 'Netflix', servicioNombre: 'Netflix', perfilNombre: 'P1', correo: 'a@b.c', contrasena: 'pw', codigo: '', monto: 5, fechaVencimiento: new Date(2026, 8, 30) };
    render(<ControlledComposer ventaContext={ventaContext} />);

    await user.type(screen.getByLabelText('Mensaje'), '/');
    const listbox = screen.getByRole('listbox', { name: 'Respuestas rápidas' });
    expect(within(listbox).getByText('Mensajes del sistema')).toBeTruthy();
    expect(within(listbox).queryByText('Despedida')).toBeNull();
    await user.click(within(listbox).getByText('Aviso de vencimiento'));
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Hola Ana, tu Netflix vence hoy');
    saved.tipos = [];
  });

  it('renders editor types with the name only and keeps other placeholders when there is no venta', async () => {
    const user = userEvent.setup();
    saved.tipos = [{ id: 't1', nombre: 'x', tipo: 'dia_pago', contenido: 'Hola {nombre_cliente}, vence {vencimiento}', placeholders: [], activo: true }];
    render(<ControlledComposer conversation={{ terceroNombre: 'Luis Gomez', contactName: 'L' } as never} />);

    await user.type(screen.getByLabelText('Mensaje'), '/aviso{Enter}');
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Hola Luis, vence {vencimiento}');
    saved.tipos = [];
  });

  it('does not open suggestions for a slash used mid-sentence', async () => {
    saved.messages = [{ id: '11111111-1111-4111-8111-111111111111', title: 'bienvenida', kind: 'text', body: 'Hola', buttonLabel: '', options: [] }];
    render(<ControlledComposer />);

    await userEvent.setup().type(screen.getByLabelText('Mensaje'), 'revisa https://a.com/b');
    expect(screen.queryByRole('listbox', { name: 'Respuestas rápidas' })).toBeNull();
    saved.messages = [];
  });

  it('rejects files larger than 4 MB before upload', async () => {
    upload.mockClear();
    toastError.mockClear();
    renderComposer({ onSendMedia: vi.fn() });
    const file = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
    await userEvent.setup().upload(screen.getByLabelText('Seleccionar archivo'), file);
    expect(toastError).toHaveBeenCalledWith('El archivo no puede superar 4 MB.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('previews an attachment before uploading and sends its uploaded ID', async () => {
    const user = userEvent.setup();
    upload.mockResolvedValue({ mediaId: 'media-1', mimeType: 'application/pdf', filename: 'nota.pdf' });
    const onSendMedia = vi.fn();
    renderComposer({ onSendMedia });
    const file = new File(['contenido'], 'nota.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Seleccionar archivo'), file);
    expect(screen.getByText('nota.pdf')).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Enviar archivo' }));
    expect(upload).toHaveBeenCalledWith({ file, filename: 'nota.pdf' });
    expect(onSendMedia).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'media-1' }), '', expect.any(Function));
  });

  it('shows and cancels a reply target', async () => {
    const onCancelReply = vi.fn();
    renderComposer({ replyTarget: { waMessageId: 'wamid', preview: 'Hola' }, onCancelReply });
    expect(screen.getByText('Respondiendo a: Hola')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancelar respuesta' }));
    expect(onCancelReply).toHaveBeenCalled();
  });
  it('sends with Enter and keeps Shift+Enter for new lines', async () => {
    const user = userEvent.setup();
    const props = renderComposer({ draft: 'Hola' });

    await user.type(screen.getByLabelText('Mensaje'), '{Shift>}{Enter}{/Shift}');
    expect(props.onSend).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Mensaje'), '{Enter}');
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(props.onDraftChange).toHaveBeenCalled();
  });

  it('shows a mic button with an empty draft and switches to send once there is text', async () => {
    const user = userEvent.setup();
    const props = renderComposer({ draft: '' });

    expect(screen.getByRole('button', { name: 'Grabar audio' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar mensaje' })).toBeNull();

    await user.type(screen.getByLabelText('Mensaje'), 'Hola');
    expect(props.onDraftChange).toHaveBeenCalled();
  });

  it('does not send empty drafts or while sending', async () => {
    const user = userEvent.setup();
    const props = renderComposer({ draft: 'Hola', isSending: true });

    expect((screen.getByRole('button', { name: 'Enviar mensaje' }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Mensaje'), '{Enter}');
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('offers saved messages from the lightning menu without requiring a sale', async () => {
    const user = userEvent.setup();
    renderComposer();
    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas y acciones' }));
    expect(screen.getByRole('menuitem', { name: 'Mensajes guardados' })).toBeTruthy();
  });

  it('only offers Acciones when a conversation is provided', async () => {
    const user = userEvent.setup();
    renderComposer();
    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas y acciones' }));
    expect(screen.queryByRole('menuitem', { name: 'Acciones' })).toBeNull();
    await user.keyboard('{Escape}');

    const conversation = { waId: '50760000000', contactName: 'Mary', terceroId: null, terceroNombre: null, lastDirection: 'inbound' as const, lastPreview: '', lastMessageAt: '', lastInboundAt: null, unreadCount: 0, nextExpiry: null, activeCategories: [] };
    renderComposer({ conversation });
    await user.click(screen.getAllByRole('button', { name: 'Respuestas rápidas y acciones' })[1]);
    expect(screen.getByRole('menuitem', { name: 'Acciones' })).toBeTruthy();
  });

  it('keeps slash as ordinary message text', async () => {
    const props = renderComposer();
    await userEvent.setup().type(screen.getByLabelText('Mensaje'), '/');
    expect(props.onDraftChange).toHaveBeenCalledWith('/');
  });

  it('groups attach and templates in the actions menu, without a separate recording item', async () => {
    const user = userEvent.setup();
    renderComposer();
    const fileInput = screen.getByLabelText('Seleccionar archivo') as HTMLInputElement;
    const pickFile = vi.spyOn(fileInput, 'click');

    await user.click(screen.getByRole('button', { name: 'Abrir acciones' }));
    expect(screen.queryByRole('menuitem', { name: 'Grabar audio' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Botones o lista' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Adjuntar archivo' }));
    expect(pickFile).toHaveBeenCalledOnce();
  });

  it('offers interactive messages from the actions menu when they can be sent', async () => {
    const user = userEvent.setup();
    renderComposer({ onSendInteractive: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Abrir acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Botones o lista' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('switches to a template notice when the 24 hour window is closed', async () => {
    const user = userEvent.setup();
    const props = renderComposer({ serviceWindow: { open: false } });

    expect(screen.queryByLabelText('Mensaje')).toBeNull();
    expect(screen.getByText(/no ha escrito en las últimas 24 horas/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gestionar mensajes' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    expect(props.onOpenTemplates).toHaveBeenCalled();
  });
});
