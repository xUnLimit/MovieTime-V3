import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ tipo: null as string | null }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/editor-mensajes',
  useSearchParams: () => ({ get: (key: string) => (key === 'tipo' ? state.tipo : null) }),
}));
vi.mock('@/hooks/use-templates', () => ({
  useTemplates: () => ({ data: [], refetch: vi.fn() }),
}));
vi.mock('@/components/editor-mensajes/SyncMetaButton', () => ({ SyncMetaButton: () => null }));
vi.mock('@/components/editor-mensajes/TemplateEditor', () => ({
  TemplateEditor: ({ initialTipo }: { initialTipo?: string }) => <p data-testid="editor">{initialTipo ?? 'sin-tipo'}</p>,
}));

import EditorMensajesPage from './page';

beforeEach(() => { state.tipo = null; });

describe('/editor-mensajes', () => {
  it('opens the requested message from ?tipo=', () => {
    state.tipo = 'despedida';
    render(<EditorMensajesPage />);
    expect(screen.getByTestId('editor').textContent).toBe('despedida');
  });

  it('ignores an unknown or retired tipo', () => {
    state.tipo = 'inventado';
    const { rerender } = render(<EditorMensajesPage />);
    expect(screen.getByTestId('editor').textContent).toBe('sin-tipo');
    state.tipo = 'notificacion_regular';
    rerender(<EditorMensajesPage />);
    expect(screen.getByTestId('editor').textContent).toBe('sin-tipo');
  });

  it('keeps the default behaviour without the parameter', () => {
    render(<EditorMensajesPage />);
    expect(screen.getByTestId('editor').textContent).toBe('sin-tipo');
  });
});
