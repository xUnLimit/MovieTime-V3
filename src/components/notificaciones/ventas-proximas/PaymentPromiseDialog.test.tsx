import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificacionVentaConId } from './types';
import { PaymentPromiseDialog } from './PaymentPromiseDialog';

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

describe('PaymentPromiseDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-23T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults a new promise to tomorrow and saves it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <PaymentPromiseDialog
        notification={notification}
        open
        onOpenChange={vi.fn()}
        onRemove={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByText('Promesa de pago')).toBeTruthy();
    expect(screen.getByText('24 de agosto de 2026')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quitar promesa' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Guardar promesa' }));

    expect(onSave).toHaveBeenCalledWith(new Date(2026, 7, 24));
  });

  it('allows a past date to be selected and saved', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <PaymentPromiseDialog
        notification={notification}
        open
        onOpenChange={vi.fn()}
        onRemove={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: '24 de agosto de 2026' }));
    await user.click(
      screen.getByRole('button', { name: /20 de agosto de 2026/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar promesa' }));

    expect(onSave).toHaveBeenCalledWith(new Date(2026, 7, 20));
  });

  it('allows today to be selected and saved', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <PaymentPromiseDialog
        notification={notification}
        open
        onOpenChange={vi.fn()}
        onRemove={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: '24 de agosto de 2026' }));
    await user.click(
      screen.getByRole('button', { name: /23 de agosto de 2026/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar promesa' }));

    expect(onSave).toHaveBeenCalledWith(new Date(2026, 7, 23));
  });

  it('allows an existing promise to be removed', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <PaymentPromiseDialog
        notification={{ ...notification, fechaPrometidaPago: new Date(2026, 7, 27) }}
        open
        onOpenChange={vi.fn()}
        onRemove={onRemove}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Editar promesa')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Quitar promesa' }));

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
