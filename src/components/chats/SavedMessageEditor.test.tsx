import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SavedMessageEditor } from './SavedMessageEditor';

describe('SavedMessageEditor', () => {
  it('creates a reusable message with text and buttons', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SavedMessageEditor onSave={onSave} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Nombre para encontrarlo'), 'Confirmar pago');
    await user.click(screen.getByRole('button', { name: 'Guardar mensaje' }));
    expect(screen.getByRole('alert').textContent).toContain('Escribe el texto');
    await user.click(screen.getByRole('radio', { name: 'Con botones' }));
    await user.type(screen.getByLabelText('Texto del mensaje'), '¿Confirmas el pago?');
    await user.type(screen.getByRole('textbox', { name: 'Botón 1' }), 'Sí');
    await user.click(screen.getByRole('button', { name: 'Agregar botón' }));
    await user.type(screen.getByRole('textbox', { name: 'Botón 2' }), 'No');
    await user.click(screen.getByRole('button', { name: 'Guardar mensaje' }));

    expect(onSave).toHaveBeenCalledWith({
      title: 'Confirmar pago', kind: 'buttons', body: '¿Confirmas el pago?', buttonLabel: '',
      options: [{ title: 'Sí', description: '' }, { title: 'No', description: '' }],
    });
  });

  it('creates a list with its opening label and description', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SavedMessageEditor onSave={onSave} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Nombre para encontrarlo'), 'Planes');
    await user.click(screen.getByRole('radio', { name: 'Con lista' }));
    await user.type(screen.getByLabelText('Texto del mensaje'), 'Elige un plan');
    await user.clear(screen.getByLabelText('Botón que abre la lista'));
    await user.type(screen.getByLabelText('Botón que abre la lista'), 'Ver planes');
    await user.type(screen.getByRole('textbox', { name: 'Opción 1' }), 'Mensual');
    await user.type(screen.getByRole('textbox', { name: 'Descripción de la opción 1' }), 'Un mes');
    await user.click(screen.getByRole('button', { name: 'Guardar mensaje' }));

    expect(onSave).toHaveBeenCalledWith({
      title: 'Planes', kind: 'list', body: 'Elige un plan', buttonLabel: 'Ver planes',
      options: [{ title: 'Mensual', description: 'Un mes' }],
    });
  });
});
