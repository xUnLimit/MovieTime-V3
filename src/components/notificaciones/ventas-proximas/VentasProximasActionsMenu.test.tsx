import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VentasProximasActionsMenu } from './VentasProximasActionsMenu';
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

const actions = {
  onNotificar: vi.fn(),
  onRenovar: vi.fn(),
  onSeguimiento: vi.fn(),
  onPaymentPromise: vi.fn(),
  onCortar: vi.fn(),
};

describe('VentasProximasActionsMenu', () => {
  it('shows the approved actions in the exact order', async () => {
    const user = userEvent.setup();

    render(<VentasProximasActionsMenu notification={notification} {...actions} />);
    await user.click(screen.getByRole('button', { name: 'Abrir acciones de Ana Pérez' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Notificar',
      'Renovar',
      'Seguimiento',
      'Promesa de pago',
      'Cortar',
      'Ver Cliente',
      'Ver Venta',
      'Ver Servicio',
    ]);
    const cutItem = screen.getByRole('menuitem', { name: 'Cortar' });
    expect(cutItem.querySelector('span')?.className).toContain('text-red-600');
  });

  it('offers to remove an existing follow-up and keeps promise editing in place', async () => {
    const onSeguimiento = vi.fn();
    const user = userEvent.setup();
    const highlighted = {
      ...notification,
      resaltada: true,
      fechaPrometidaPago: new Date(2026, 7, 27),
    };

    render(
      <VentasProximasActionsMenu
        notification={highlighted}
        {...actions}
        onSeguimiento={onSeguimiento}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Abrir acciones de Ana Pérez' }));

    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Notificar',
      'Renovar',
      'Quitar seguimiento',
      'Editar promesa',
      'Cortar',
      'Ver Cliente',
      'Ver Venta',
      'Ver Servicio',
    ]);

    await user.click(screen.getByRole('menuitem', { name: 'Quitar seguimiento' }));
    expect(onSeguimiento).toHaveBeenCalledWith(highlighted);
  });
});
