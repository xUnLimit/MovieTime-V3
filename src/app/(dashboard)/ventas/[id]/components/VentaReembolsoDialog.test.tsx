import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('starts again from the first step when the dialog is closed and reopened', () => {
    const props = { onOpenChange: vi.fn(), venta, metodosPago: [], montoSugerido: 30, onConfirm: vi.fn() };
    const view = render(<VentaReembolsoDialog open {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(screen.getByLabelText('Cuenta destino del cliente'), { target: { value: 'Yappy 6000-0000' } });

    view.rerender(<VentaReembolsoDialog open={false} {...props} />);
    view.rerender(<VentaReembolsoDialog open {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((screen.getByLabelText('Cuenta destino del cliente') as HTMLInputElement).value).toBe('');
  });

  it('keeps the confirm button disabled until the destination is filled and then submits the refund once', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <VentaReembolsoDialog
        open
        onOpenChange={vi.fn()}
        venta={{ ...venta, metodoPagoId: 'metodo-1' } as VentaDoc}
        metodosPago={[]}
        montoSugerido={30}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const confirm = screen.getByRole('button', { name: 'Reembolsar' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Cuenta destino del cliente'), { target: { value: 'Yappy 6000-0000' } });
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ destinoReembolso: 'Yappy 6000-0000', metodoPagoId: 'metodo-1', cortarServicio: false })
    );
  });

  it('keeps the edited refund details when navigating back and closes on cancel', () => {
    const onOpenChange = vi.fn();
    render(
      <VentaReembolsoDialog
        open
        onOpenChange={onOpenChange}
        venta={venta}
        metodosPago={[{ id: 'metodo-1', nombre: 'Banco', moneda: 'USD', activo: true, asociadoA: 'tercero' } as never]}
        montoSugerido={30}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(screen.getByLabelText('Monto a reembolsar'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Cuenta destino del cliente'), { target: { value: 'Banco 123' } });
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'Detalle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atras' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((screen.getByLabelText('Monto a reembolsar') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('Cuenta destino del cliente') as HTMLInputElement).value).toBe('Banco 123');
    fireEvent.click(screen.getByRole('button', { name: 'Atras' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
