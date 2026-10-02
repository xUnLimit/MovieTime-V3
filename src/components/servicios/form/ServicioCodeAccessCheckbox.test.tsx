import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServicioCodeAccessCheckbox } from './ServicioCodeAccessCheckbox';
const label = 'Entregar acceso por código (no compartir la contraseña)';
describe('ServicioCodeAccessCheckbox', () => {
  it('allows a configured provider account to toggle', () => {
    const onChange = vi.fn();
    render(<ServicioCodeAccessCheckbox checked={false} providerKey="netflix" onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: label }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it.each([null, undefined, 'fake'])('disables accounts without a registered provider (%s)', (providerKey) => {
    const onChange = vi.fn();
    render(<ServicioCodeAccessCheckbox checked={false} providerKey={providerKey} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox', { name: label });
    expect(checkbox.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById(checkbox.getAttribute('aria-describedby') ?? '')?.textContent?.trim())
      .toBe('La categoría no tiene un proveedor de códigos configurado.');
    fireEvent.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('shows the persisted flag in detail without allowing mutation', () => {
    render(<ServicioCodeAccessCheckbox checked providerKey="netflix" readOnly />);
    expect(screen.getByRole('checkbox', { name: label }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: label }).hasAttribute('disabled')).toBe(true);
  });
});
