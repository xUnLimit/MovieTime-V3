import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const media = vi.hoisted(() => ({
  state: { objectUrl: null as string | null, isLoading: false, isError: false },
  calls: [] as Array<{ mediaId: string | null; enabled: boolean }>,
}));

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

  it('shows a placeholder while an image loads', () => {
    render(<MessageAttachment mediaId="1" kind="sticker" mimeType={null} filename={null} />);

    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('waits for a click before downloading documents, audio and video', async () => {
    const user = userEvent.setup();
    media.state.objectUrl = 'blob:doc';
    render(<MessageAttachment mediaId="2" kind="document" mimeType="application/pdf" filename="recibo.pdf" />);

    expect(media.calls[0]).toEqual({ mediaId: '2', enabled: false });
    await user.click(screen.getByRole('button', { name: /Ver recibo.pdf/ }));

    const link = screen.getByRole('link', { name: /recibo.pdf/ });
    expect(link.getAttribute('href')).toBe('blob:doc');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('plays audio and video once loaded', async () => {
    const user = userEvent.setup();
    media.state.objectUrl = 'blob:media';
    const { unmount } = render(<MessageAttachment mediaId="3" kind="audio" mimeType="audio/ogg" filename={null} />);
    await user.click(screen.getByRole('button', { name: /Ver audio/ }));
    expect(screen.getByLabelText('Audio del mensaje')).toBeTruthy();
    unmount();

    render(<MessageAttachment mediaId="4" kind="video" mimeType="video/mp4" filename={null} />);
    await user.click(screen.getByRole('button', { name: /Ver video/ }));
    expect(screen.getByLabelText('Video del cliente')).toBeTruthy();
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
