import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ServiciosProximosTableRow } from './ServiciosProximosTableRow';
import type { NotificacionServicioConId, ServicioNotificationAction } from './types';

const notification = {
  id: 'notif-servicio-1',
  entidad: 'servicio',
  tipo: 'sistema',
  prioridad: 'alta',
  titulo: 'Servicio próximo a vencer',
  leida: false,
  resaltada: false,
  diasRestantes: 3,
  createdAt: new Date('2026-08-20T00:00:00.000Z'),
  servicioId: 'servicio-1',
  categoriaId: 'categoria-1',
  servicioNombre: 'Netflix',
  categoriaNombre: 'Streaming',
  tipoServicio: 'cuenta-completa',
  correo: 'cuenta@example.com',
  contrasena: 'secreto',
  metodoPagoNombre: 'Visa',
  moneda: 'USD',
  costoServicio: 15,
  cicloPago: 'mensual',
  fechaVencimiento: new Date(2026, 7, 27),
  renovacionAutomatica: false,
} satisfies NotificacionServicioConId;

function renderRow({
  notif = notification,
  onSeguimiento = vi.fn(),
}: {
  notif?: NotificacionServicioConId;
  onSeguimiento?: ServicioNotificationAction;
} = {}) {
  render(
    <table>
      <tbody>
        <ServiciosProximosTableRow
          notif={notif}
          visiblePasswords={new Set()}
          onToggleLeida={vi.fn()}
          onCopyToClipboard={vi.fn()}
          onTogglePasswordVisibility={vi.fn()}
          onRenovar={vi.fn()}
          onSeguimiento={onSeguimiento}
          onAcciones={vi.fn()}
        />
      </tbody>
    </table>,
  );
}

describe('ServiciosProximosTableRow', () => {
  it('muestra las acciones en el orden aprobado', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(
      screen.getByRole('button', { name: 'Abrir acciones de Netflix' }),
    );

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Renovar',
      'Seguimiento',
      'Inactivar',
      'Ver Servicio',
    ]);
    expect(
      screen.getByRole('menuitem', { name: 'Seguimiento' }).querySelector('span')
        ?.className,
    ).toContain('text-warning');
    expect(
      screen.getByRole('menuitem', { name: 'Inactivar' }).querySelector('span')
        ?.className,
    ).toContain('text-danger');
  });

  it('permite quitar el seguimiento directamente desde el menú', async () => {
    const onSeguimiento = vi.fn();
    const highlighted = { ...notification, resaltada: true };
    const user = userEvent.setup();
    renderRow({ notif: highlighted, onSeguimiento });

    await user.click(
      screen.getByRole('button', { name: 'Abrir acciones de Netflix' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Quitar seguimiento' }),
    );

    expect(onSeguimiento).toHaveBeenCalledWith(highlighted);
  });
});

