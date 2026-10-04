import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { COPY_CATALOG } from '@/modules/commerce-copy/catalog';
import { CopyEditor } from './CopyEditor';

const setup = (props: Partial<Parameters<typeof CopyEditor>[0]> = {}) => {
  const onSave = vi.fn();
  render(<CopyEditor copyKey="reservation" saved={undefined} saving={false} onSave={onSave} {...props} />);
  return onSave;
};

describe('CopyEditor', () => {
  it('muestra el texto original con vista previa con datos de ejemplo y sin permitir guardar sin cambios', () => {
    setup();
    expect(screen.getByText('Texto original')).toBeTruthy();
    expect(screen.getByLabelText('Texto')).toHaveProperty('value', COPY_CATALOG.reservation.defaultText);
    expect(screen.getByTestId('copy-preview').textContent).toContain('Reservé Netflix Mensual por USD 10.00');
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Restaurar original' })).toHaveProperty('disabled', true);
  });

  it('guarda el texto editado sin espacios sobrantes', async () => {
    const user = userEvent.setup(); const onSave = setup();
    const field = screen.getByLabelText('Texto');
    await user.clear(field); await user.type(field, '  Apartado: {{{{servicio}} por {{{{monto}}.  ');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith('Apartado: {{servicio}} por {{monto}}.');
  });

  it('explica el problema y bloquea el guardado si falta un dato obligatorio o sobra uno no permitido', async () => {
    const user = userEvent.setup(); const onSave = setup();
    const field = screen.getByLabelText('Texto');
    await user.clear(field); await user.type(field, 'Reservado');
    expect(screen.getByRole('alert').textContent).toContain('{{servicio}}');
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveProperty('disabled', true);
    await user.clear(field); await user.type(field, 'Listo {{{{servicio}} {{{{monto}} {{{{exceso}}');
    expect(screen.getByRole('alert').textContent).toContain('{{exceso}}');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('inserta un dato en la posición del cursor y marca los obligatorios', async () => {
    const user = userEvent.setup(); setup({ copyKey: 'plansPrompt' });
    const field = screen.getByLabelText('Texto') as HTMLTextAreaElement;
    await user.clear(field); await user.type(field, 'Planes de ');
    await user.click(screen.getByRole('button', { name: 'Plataforma' }));
    expect(field.value).toBe('Planes de {{plataforma}}');
    expect(screen.getByRole('group', { name: 'Datos que puedes insertar' })).toBeTruthy();
    expect(screen.queryByText(/obligatorio/)).toBeNull();
  });

  it('avisa qué datos son obligatorios cuando el mensaje los exige', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Servicio elegido *' })).toBeTruthy();
    expect(screen.getByText(/obligatorio en este mensaje/)).toBeTruthy();
  });

  it('guardar un texto igual al original lo restaura en vez de crear un duplicado', async () => {
    const user = userEvent.setup(); const onSave = setup({ copyKey: 'greeting', saved: 'Buenas' });
    const field = screen.getByLabelText('Texto');
    await user.clear(field); await user.type(field, COPY_CATALOG.greeting.defaultText);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('restaura el original guardado y usa un campo de una línea para botones', async () => {
    const user = userEvent.setup(); const onSave = setup({ copyKey: 'btnBuy', saved: 'Comprar' });
    expect(screen.getByText('Editado')).toBeTruthy();
    expect(screen.getByLabelText('Texto').tagName).toBe('INPUT');
    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('sin texto guardado, restaurar descarta lo escrito sin llamar al servidor y bloquea mientras guarda', async () => {
    const user = userEvent.setup(); const onSave = setup({ copyKey: 'greeting' });
    const field = screen.getByLabelText('Texto');
    await user.type(field, ' extra');
    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    expect(field).toHaveProperty('value', COPY_CATALOG.greeting.defaultText);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('deshabilita los botones mientras guarda', () => {
    setup({ saving: true, saved: 'Hola' });
    expect(screen.getByRole('button', { name: 'Guardando…' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Restaurar original' })).toHaveProperty('disabled', true);
  });
});
