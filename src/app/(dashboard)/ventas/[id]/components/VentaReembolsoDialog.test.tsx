import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { VentaDoc } from '@/types';
import { VentaReembolsoDialog } from './VentaReembolsoDialog';

const venta = {
  id: 'venta-1',
  estado: 'activo',
  clienteNombre: 'Cliente prueba',
  servicioNombre: 'Servicio prueba',
  servicioId: 'servicio-1',
  moneda: 'USD',
  fechaInicio: new Date('2026-09-01T00:00:00'),
  fechaFin: new Date('2026-10-01T00:00:00'),
  precioFinal: 30,
} as VentaDoc;

describe('VentaReembolsoDialog', () => {
  it('updates the suggested and editable amounts when the date changes', () => {
    render(
      <VentaReembolsoDialog
        open
        onOpenChange={vi.fn()}
        venta={venta}
        metodosPago={[]}
        montoSugerido={30}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(screen.getByLabelText('Fecha efectiva del reembolso'), {
      target: { value: '2026-09-16' },
    });

    expect(screen.getByTestId('refund-suggested-amount').textContent).toContain('$ 15.00');
    expect((screen.getByLabelText('Monto a reembolsar') as HTMLInputElement).value).toBe('15.00');
  });

  it('allows choosing whether to cut only the sale or also inactivate the service', () => {
    render(
      <VentaReembolsoDialog
        open
        onOpenChange={vi.fn()}
        venta={venta}
        metodosPago={[]}
        montoSugerido={30}
        onConfirm={vi.fn()}
      />
    );

    const option = screen.getByRole('radio', { name: /^Reembolsar y cortar/i });
    fireEvent.click(option);
    expect(option.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByLabelText('Motivo de corte')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Cortar solo la venta/i }).getAttribute('aria-checked')).toBe('true');

    const inactivateService = screen.getByRole('radio', { name: /Cortar venta e inactivar servicio/i });
    fireEvent.click(inactivateService);
    expect(inactivateService.getAttribute('aria-checked')).toBe('true');
  });
});
