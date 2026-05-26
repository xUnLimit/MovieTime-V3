import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TemplateEditor } from './TemplateEditor';
import type { TemplateMensaje } from '@/types';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/client-domain-mutations', () => ({
  createTemplateMutation: vi.fn(),
  updateTemplateMutation: vi.fn(),
}));

function renderTemplateEditor(templates: TemplateMensaje[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TemplateEditor templates={templates} />
    </QueryClientProvider>,
  );
}

function makeTemplate(overrides: Partial<TemplateMensaje> = {}): TemplateMensaje {
  return {
    id: 'template-1',
    nombre: 'Notificacion Regular',
    tipo: 'notificacion_regular',
    contenido: 'Hola {nombre_cliente}, tu servicio vence pronto.',
    placeholders: ['{nombre_cliente}'],
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TemplateEditor', () => {
  it('fills the selected template content after templates load asynchronously', async () => {
    const { rerender } = renderTemplateEditor([]);
    const textarea = screen.getByRole('textbox');

    expect((textarea as HTMLTextAreaElement).value).toBe('');

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <TemplateEditor templates={[makeTemplate()]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Hola {nombre_cliente}, tu servicio vence pronto.',
      );
    });
  });
});
