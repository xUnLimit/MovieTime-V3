import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NotifyVentaDialog } from './NotifyVentaDialog';
import type { NotificacionVentaConId } from './types';

const notification = {
  id: 'notif-1',
  entidad: 'venta',
  tipo: 'sistema',
  prioridad: 'alta',
  titulo: 'Venta vencida',
  leida: false,
  resaltada: false,
  diasRestantes: -4,
  createdAt: new Date('2026-08-20T00:00:00.000Z'),
  ventaId: 'venta-1',
  clienteId: 'cliente-1',
  servicioId: 'servicio-1',
  clienteNombre: 'Ana Pérez',
  servicioNombre: 'Netflix',
  categoriaNombre: 'Streaming',
  estado: 'activo',
  fechaFin: new Date(2026, 7, 19),
} satisfies NotificacionVentaConId;

describe('NotifyVentaDialog', () => {
  it('sends the selected cancellation message and closes', async () => {
    const onCancelMessage = vi.fn().mockReturnValue(true);
    const onNotify = vi.fn().mockReturnValue(true);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <NotifyVentaDialog
        notification={notification}
        open
        onOpenChange={onOpenChange}
        onNotify={onNotify}
        onCancelMessage={onCancelMessage}
      />,
    );

    expect(screen.getByText('Aviso de pago')).toBeTruthy();
    expect(screen.getByText('Cancelación')).toBeTruthy();

    await user.click(screen.getByLabelText('Cancelación'));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onCancelMessage).toHaveBeenCalledWith(notification);
    expect(onNotify).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open when the selected message cannot be generated', async () => {
    const onNotify = vi.fn().mockReturnValue(false);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <NotifyVentaDialog
        notification={notification}
        open
        onOpenChange={onOpenChange}
        onNotify={onNotify}
        onCancelMessage={vi.fn().mockReturnValue(true)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onNotify).toHaveBeenCalledWith(notification);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
