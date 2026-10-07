import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { COPY_CATALOG } from '@/modules/commerce-copy/catalog';
import { CopyEditor } from './CopyEditor';

const setup = (props: Partial<Parameters<typeof CopyEditor>[0]> = {}) => {
  const onSave = vi.fn();
  render(<CopyEditor copyKey="reservation" saved={undefined} onSave={onSave} {...props} />);
  return onSave;
};

describe('CopyEditor', () => {
  it('muestra el texto original con vista previa con datos de ejemplo y sin permitir guardar sin cambios', () => {
    setup();
    expect(screen.getByLabelText('Texto')).toHaveProperty('value', COPY_CATALOG.reservation.defaultText);
    expect(screen.getByText(`Se usa cuando: ${COPY_CATALOG.reservation.when}.`)).toBeTruthy();
    expect(screen.getByTestId('copy-preview').textContent).toContain('Reservé Netflix Mensual por $10.00');
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Restaurar original' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('note')).toBeNull();
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

  it('guardar un texto igual al original lo quita del bloque en vez de crear un duplicado', async () => {
    const user = userEvent.setup(); const onSave = setup({ copyKey: 'cancelled', saved: 'Listo.' });
    const field = screen.getByLabelText('Texto');
    await user.clear(field); await user.type(field, COPY_CATALOG.cancelled.defaultText);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('restaura el original guardado en el bloque y usa un campo de una línea para botones', async () => {
    const user = userEvent.setup(); const onSave = setup({ copyKey: 'btnPay', saved: 'Pagar' });
    expect(screen.getByLabelText('Texto').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Texto')).toHaveProperty('value', 'Pagar');
    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('sin texto propio, restaurar descarta lo escrito sin guardar nada', async () => {
    const user = userEvent.setup(); const onSave = setup({ copyKey: 'cancelled' });
    const field = screen.getByLabelText('Texto');
    await user.type(field, ' extra');
    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    expect(field).toHaveProperty('value', COPY_CATALOG.cancelled.defaultText);
    expect(onSave).not.toHaveBeenCalled();
  });

  describe('con un texto guardado fuera del recorrido', () => {
    it('muestra el texto que el bot usa de verdad y explica de dónde viene', () => {
      setup({ copyKey: 'btnPay', inherited: 'Pagar ahora' });
      expect(screen.getByLabelText('Texto')).toHaveProperty('value', 'Pagar ahora');
      expect(screen.getByRole('note').textContent).toContain('antigua pestaña Compras');
      expect(screen.getByRole('button', { name: 'Restaurar original' })).toHaveProperty('disabled', false);
    });

    it('restaurar original guarda el original de forma explícita para que no vuelva el texto anterior', async () => {
      const user = userEvent.setup(); const onSave = setup({ copyKey: 'btnPay', inherited: 'Pagar ahora' });
      await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
      expect(onSave).toHaveBeenCalledWith(COPY_CATALOG.btnPay.defaultText);
    });

    it('un texto propio del bloque manda sobre el guardado fuera, y volver a ese texto quita el propio', async () => {
      const user = userEvent.setup(); const onSave = setup({ copyKey: 'btnPay', saved: 'Pagar ya', inherited: 'Pagar ahora' });
      expect(screen.getByLabelText('Texto')).toHaveProperty('value', 'Pagar ya');
      expect(screen.queryByRole('note')).toBeNull();
      const field = screen.getByLabelText('Texto');
      await user.clear(field); await user.type(field, 'Pagar ahora');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));
      expect(onSave).toHaveBeenCalledWith(null);
    });

    it('si el bloque ya guarda el original, no hay nada que restaurar', () => {
      setup({ copyKey: 'btnPay', saved: COPY_CATALOG.btnPay.defaultText, inherited: 'Pagar ahora' });
      expect(screen.getByRole('button', { name: 'Restaurar original' })).toHaveProperty('disabled', true);
    });
  });
});
