import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ServicioSummaryCards } from './ServicioSummaryCards';

describe('ServicioSummaryCards', () => {
  it('shows a plural remaining-days badge for dates beyond one week', () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { container } = render(<ServicioSummaryCards
      categoria={{ id: 'categoria-1', nombre: 'Streaming' } as never}
      currencySymbol="$"
      getCicloPagoLabel={vi.fn(() => 'Mensual')}
      metodoPago={{ alias: 'Principal', nombre: 'Visa', numeroTarjeta: '4111111111111234' } as never}
      servicio={{
        activo: true,
        cicloPago: 'mensual',
        contrasena: 'secret',
        correo: 'cuenta@example.com',
        costoServicio: 10,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        fechaInicio: new Date('2026-01-01T00:00:00Z'),
        fechaVencimiento: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        id: 'servicio-1',
        notas: 'Cuenta principal',
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      } as never}
    />);

    expect(screen.getByText(/días restantes$/)).not.toBeNull();
    fireEvent.click(container.querySelector('button')!);
    expect(writeText).toHaveBeenCalledWith('cuenta@example.com');
  });
});
