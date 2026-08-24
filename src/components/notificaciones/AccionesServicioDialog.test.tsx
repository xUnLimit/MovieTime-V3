import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AccionesServicioDialog } from './AccionesServicioDialog';
import type { NotificacionServicio } from '@/types/notificaciones';

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
} satisfies NotificacionServicio & { id: string };

describe('AccionesServicioDialog', () => {
  it('presenta una confirmación dedicada únicamente a inactivar', async () => {
    const onInactivar = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AccionesServicioDialog
        notificacion={notification}
        isOpen
        onOpenChange={onOpenChange}
        onInactivar={onInactivar}
      />,
    );

    expect(screen.queryByText('Resaltar para seguimiento')).toBeNull();
    expect(screen.queryByText('Descartar resaltado')).toBeNull();
    expect(
      screen.getByText(
        'El servicio se marcará como inactivo y esta notificación se eliminará.',
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Inactivar' }));

    expect(onInactivar).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('permanece abierto y rehabilita la acción cuando inactivar falla', async () => {
    const onInactivar = vi.fn().mockRejectedValue(new Error('Falló la operación'));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AccionesServicioDialog
        notificacion={notification}
        isOpen
        onOpenChange={onOpenChange}
        onInactivar={onInactivar}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Inactivar' }));

    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Inactivar' }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

