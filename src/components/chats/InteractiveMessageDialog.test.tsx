import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InteractiveMessageDialog } from './InteractiveMessageDialog';

function renderDialog(overrides: Partial<Parameters<typeof InteractiveMessageDialog>[0]> = {}) {
  const props = { open: true, isSending: false, onOpenChange: vi.fn(), onSend: vi.fn(), ...overrides };
  render(<InteractiveMessageDialog {...props} />);
  return props;
}

describe('InteractiveMessageDialog', () => {
  it('opens a saved list with its text and options ready for review', async () => {
    const user = userEvent.setup();
    const { onSend } = renderDialog({ initialDraft: {
      type: 'list', body: 'Elige un plan', buttonLabel: 'Ver planes',
      options: [{ title: 'Mensual', description: 'Un mes' }],
    } });

    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Texto del mensaje' }).value).toBe('Elige un plan');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Opción 1' }).value).toBe('Mensual');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'list', body: 'Elige un plan', buttonLabel: 'Ver planes',
      rows: [{ id: 'row-1', title: 'Mensual', description: 'Un mes' }],
    }));
  });

  it('keeps each draft when switching between buttons and list', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole('textbox', { name: 'Texto del mensaje' }), 'Elige una respuesta');
    await user.type(screen.getByRole('textbox', { name: 'Botón 1' }), 'Confirmar');
    await user.click(screen.getByText('Lista', { exact: true }));
    await user.type(screen.getByRole('textbox', { name: 'Texto del mensaje' }), 'Elige un plan');
    await user.type(screen.getByRole('textbox', { name: 'Opción 1' }), 'Netflix 1 mes');

    await user.click(screen.getByText('Botones', { exact: true }));
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Botón 1' }).value).toBe('Confirmar');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Texto del mensaje' }).value).toBe('Elige una respuesta');

    await user.click(screen.getByText('Lista', { exact: true }));
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Opción 1' }).value).toBe('Netflix 1 mes');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Texto del mensaje' }).value).toBe('Elige un plan');
  });

  it('previews the list, shows description limits, and sends the completed message', async () => {
    const user = userEvent.setup();
    const { onSend } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(screen.getByRole('alert').textContent).toContain('Escribe el texto del mensaje');

    await user.click(screen.getByText('Lista', { exact: true }));
    await user.type(screen.getByRole('textbox', { name: 'Texto del mensaje' }), 'Selecciona un plan');
    await user.type(screen.getByRole('textbox', { name: 'Opción 1' }), 'Netflix 1 mes');
    await user.type(screen.getByRole('textbox', { name: 'Descripción de la opción 1' }), 'Acceso por un mes');

    const previewToggle = screen.getByRole('button', { name: 'Vista previa' });
    expect(previewToggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(previewToggle);
    expect(previewToggle.getAttribute('aria-expanded')).toBe('true');
    const preview = screen.getByRole('complementary', { name: 'Vista previa' });
    expect(preview.textContent).toContain('Selecciona un plan');
    expect(preview.textContent).toContain('Ver opciones');
    expect(screen.getByText('17/72')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'list', body: 'Selecciona un plan', buttonLabel: 'Ver opciones',
      rows: [{ id: 'row-1', title: 'Netflix 1 mes', description: 'Acceso por un mes' }],
    }));
  });
});
