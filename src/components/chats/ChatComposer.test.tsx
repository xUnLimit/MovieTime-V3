import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-whatsapp-chat', () => ({ useUploadWhatsAppMedia: () => ({ mutateAsync: upload }) }));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

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
    quickReplies: [{ tipo: 'dia_pago' as const, label: 'Día de pago' }],
    quickReplyContext: 'Netflix',
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    onQuickReply: vi.fn(),
    onOpenTemplates: vi.fn(),
    ...overrides,
  };
  render(<ChatComposer {...props} />);
  return props;
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

  it('does not send empty drafts or while sending', async () => {
    const user = userEvent.setup();
    const props = renderComposer({ draft: '   ' });

    expect((screen.getByRole('button', { name: 'Enviar mensaje' }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Mensaje'), '{Enter}');
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('offers quick replies filled from the selected sale and Meta templates', async () => {
    const user = userEvent.setup();
    const props = renderComposer();

    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas' }));
    expect(screen.getByText('Con los datos de Netflix')).toBeTruthy();
    await user.click(screen.getByRole('menuitem', { name: 'Día de pago' }));
    expect(props.onQuickReply).toHaveBeenCalledWith('dia_pago');

    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas' }));
    await user.click(screen.getByRole('menuitem', { name: /Plantillas de Meta/ }));
    expect(props.onOpenTemplates).toHaveBeenCalled();
  });

  it('explains when no sale or template is available', async () => {
    const user = userEvent.setup();
    renderComposer({ quickReplyContext: null });
    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas' }));
    expect(screen.getByText(/Elige una venta/)).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Día de pago' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('shows an empty quick reply list', async () => {
    const user = userEvent.setup();
    renderComposer({ quickReplies: [] });
    await user.click(screen.getByRole('button', { name: 'Respuestas rápidas' }));
    expect(screen.getByText('No hay plantillas activas en el editor')).toBeTruthy();
  });

  it('switches to a template notice when the 24 hour window is closed', async () => {
    const user = userEvent.setup();
    const props = renderComposer({ serviceWindow: { open: false } });

    expect(screen.queryByLabelText('Mensaje')).toBeNull();
    expect(screen.getByText(/no ha escrito en las últimas 24 horas/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    expect(props.onOpenTemplates).toHaveBeenCalled();
  });
});
