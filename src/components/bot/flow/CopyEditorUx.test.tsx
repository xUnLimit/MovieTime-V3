import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CopyEditor } from './CopyEditor';

describe('claridad de edición de textos de compra', () => {
  it('distingue un cambio local de su aplicación al borrador y de la publicación', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CopyEditor copyKey="btnPay" saved={undefined} onSave={onSave} />);
    expect(screen.getByRole('status').textContent).toBe('Este texto coincide con el borrador.');
    await user.clear(screen.getByRole('textbox', { name: 'Texto' }));
    await user.type(screen.getByRole('textbox', { name: 'Texto' }), 'Ver formas de pago');
    expect(screen.getByRole('status').textContent).toBe('Cambios sin guardar en el borrador.');
    expect(screen.getByText(/Los clientes lo verán cuando publiques el recorrido/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('copy-preview').textContent).toBe('Ver formas de pago');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith('Ver formas de pago');
  });

  it('muestra los detalles de lista con datos de ejemplo', () => {
    render(<CopyEditor copyKey="rowRenewDesc" saved={undefined} onSave={vi.fn()} />);
    expect(screen.getByTestId('copy-preview').textContent).toContain('$10.00');
    expect(screen.getByTestId('copy-preview').textContent).toContain('Mensual');
    expect(screen.getByText('Los datos se muestran con valores de ejemplo.')).toBeTruthy();
  });
});
