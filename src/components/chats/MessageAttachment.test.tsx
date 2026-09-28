import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const media = vi.hoisted(() => ({
  state: { objectUrl: null as string | null, isLoading: false, isError: false },
  calls: [] as Array<{ mediaId: string | null; enabled: boolean }>,
}));
const observed = vi.hoisted(() => ({ callback: null as IntersectionObserverCallback | null, observe: vi.fn(), disconnect: vi.fn() }));

vi.mock('@/hooks/use-whatsapp-chat', () => ({
  useWhatsAppMedia: (mediaId: string | null, enabled: boolean) => {
    media.calls.push({ mediaId, enabled });
    return enabled ? media.state : { objectUrl: null, isLoading: false, isError: false };
  },
}));

import { MessageAttachment } from './MessageAttachment';

beforeEach(() => {
  media.state = { objectUrl: null, isLoading: false, isError: false };
  media.calls.length = 0;
});

describe('MessageAttachment', () => {
  it('loads images right away and shows them', () => {
    media.state.objectUrl = 'blob:image';
    render(<MessageAttachment mediaId="1" kind="image" mimeType="image/jpeg" filename={null} />);

    expect(media.calls[0]).toEqual({ mediaId: '1', enabled: true });
    expect(screen.getByRole('img', { name: 'Imagen del mensaje' }).getAttribute('src')).toBe('blob:image');
  });

  it('opens images through onOpenImage instead of a link when provided', async () => {
    const user = userEvent.setup();
    const onOpenImage = vi.fn();
    media.state.objectUrl = 'blob:image';
    render(<MessageAttachment mediaId="1" kind="image" mimeType="image/jpeg" filename={null} onOpenImage={onOpenImage} />);

    expect(screen.queryByRole('link')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver imagen en grande' }));
    expect(onOpenImage).toHaveBeenCalledOnce();
  });

  it('falls back to opening images in a new tab without onOpenImage', () => {
    media.state.objectUrl = 'blob:image';
    render(<MessageAttachment mediaId="1" kind="image" mimeType="image/jpeg" filename={null} />);

    expect(screen.getByRole('link', { name: 'Imagen del mensaje' }).getAttribute('target')).toBe('_blank');
  });

  it('shows a placeholder while an image loads', () => {
    render(<MessageAttachment mediaId="1" kind="image" mimeType={null} filename={null} />);

    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('shows a fixed-size sticker that cannot be opened or downloaded', () => {
    media.state.objectUrl = 'blob:sticker';
    render(<MessageAttachment mediaId="1" kind="sticker" mimeType="image/webp" filename={null} onOpenImage={vi.fn()} />);

    const image = screen.getByRole('img', { name: 'Sticker' });
    expect(image.getAttribute('src')).toBe('blob:sticker');
    expect(image.className).toContain('h-32 w-32');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows a fixed-size placeholder while a sticker loads', () => {
    render(<MessageAttachment mediaId="1" kind="sticker" mimeType="image/webp" filename={null} />);

    expect(screen.getByRole('status', { name: 'Cargando sticker' }).className).toContain('h-32 w-32');
  });

  it('waits for a click before downloading documents and video', async () => {
    const user = userEvent.setup();
    media.state.objectUrl = 'blob:doc';
    render(<MessageAttachment mediaId="2" kind="document" mimeType="application/pdf" filename="recibo.pdf" />);

    expect(media.calls[0]).toEqual({ mediaId: '2', enabled: false });
    await user.click(screen.getByRole('button', { name: /Ver recibo.pdf/ }));

    const link = screen.getByRole('link', { name: /recibo.pdf/ });
    expect(link.getAttribute('href')).toBe('blob:doc');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('plays video once loaded, after a click', async () => {
    const user = userEvent.setup();
    media.state.objectUrl = 'blob:media';
    render(<MessageAttachment mediaId="4" kind="video" mimeType="video/mp4" filename={null} />);
    await user.click(screen.getByRole('button', { name: /Ver video/ }));
    expect(screen.getByLabelText('Video del cliente')).toBeTruthy();
  });

  it('loads a voice note right away as a WhatsApp-style player, with a loading state first', () => {
    media.state.objectUrl = null;
    media.state.isLoading = true;
    const { rerender } = render(<MessageAttachment mediaId="3" kind="audio" mimeType="audio/ogg" filename={null} />);
    expect(media.calls[0]).toEqual({ mediaId: '3', enabled: true });
    expect(screen.getByText('Cargando audio...')).toBeTruthy();

    media.state = { objectUrl: 'blob:audio', isLoading: false, isError: false };
    rerender(<MessageAttachment mediaId="3" kind="audio" mimeType="audio/ogg" filename={null} />);
    expect(screen.getByLabelText('Audio del mensaje')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reproducir audio' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ver audio/ })).toBeNull();
  });

  it('toggles play and pause on a voice note', async () => {
    const user = userEvent.setup();
    media.state.objectUrl = 'blob:audio';
    render(<MessageAttachment mediaId="3" kind="audio" mimeType="audio/ogg" filename={null} />);

    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();

    await user.click(screen.getByRole('button', { name: 'Reproducir audio' }));
    expect(screen.getByRole('button', { name: 'Pausar audio' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pausar audio' }));
    expect(screen.getByRole('button', { name: 'Reproducir audio' })).toBeTruthy();
  });

  it('downloads other documents without opening a tab and uses a generic label', async () => {
    const user = userEvent.setup();
    media.state.objectUrl = 'blob:zip';
    render(<MessageAttachment mediaId="5" kind="unknown" mimeType="application/zip" filename={null} />);

    await user.click(screen.getByRole('button', { name: /Ver archivo/ }));
    expect(screen.getByRole('link', { name: /Archivo/ }).getAttribute('target')).toBeNull();
  });

  it('explains when the file cannot be loaded', () => {
    media.state.isError = true;
    render(<MessageAttachment mediaId="6" kind="image" mimeType="image/png" filename={null} />);

    expect(screen.getByText('No se pudo cargar el archivo.')).toBeTruthy();
  });
});

// jsdom no trae IntersectionObserver: los tests de arriba corren en su
// fallback (carga inmediata, la degradacion segura). Este bloque simula el
// observer real para probar el comportamiento perezoso que ve el navegador.
describe('MessageAttachment lazy loading', () => {
  beforeEach(() => {
    observed.callback = null;
    observed.observe.mockReset();
    observed.disconnect.mockReset();
    vi.stubGlobal('IntersectionObserver', vi.fn(function FakeIntersectionObserver(this: unknown, callback: IntersectionObserverCallback) {
      observed.callback = callback;
      return { observe: observed.observe, disconnect: observed.disconnect, unobserve: vi.fn() };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not request an auto-loading image until it enters the viewport', () => {
    render(<MessageAttachment mediaId="1" kind="image" mimeType="image/jpeg" filename={null} />);

    expect(media.calls[0]).toEqual({ mediaId: '1', enabled: false });
    expect(observed.observe).toHaveBeenCalledOnce();

    media.state.objectUrl = 'blob:image';
    act(() => observed.callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

    expect(media.calls.at(-1)).toEqual({ mediaId: '1', enabled: true });
  });

  it('still waits for a click on documents even though they are never auto-observed', () => {
    render(<MessageAttachment mediaId="2" kind="document" mimeType="application/pdf" filename="recibo.pdf" />);

    expect(observed.observe).not.toHaveBeenCalled();
    expect(media.calls[0]).toEqual({ mediaId: '2', enabled: false });
  });
});
