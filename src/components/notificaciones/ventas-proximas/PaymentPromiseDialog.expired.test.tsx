import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificacionVentaConId } from './types';
import { PaymentPromiseDialog } from './PaymentPromiseDialog';

describe('PaymentPromiseDialog expired promise', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T15:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('requires a new future date before saving an expired promise', () => {
    const notification = {
      id: 'notif-expired',
      entidad: 'venta',
      tipo: 'sistema',
      prioridad: 'alta',
      titulo: 'Venta vencida',
      leida: true,
      resaltada: false,
      diasRestantes: -5,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      ventaId: 'venta-1',
      clienteId: 'cliente-1',
      servicioId: 'servicio-1',
      clienteNombre: 'Cliente',
      servicioNombre: 'Netflix',
      categoriaNombre: 'Streaming',
      estado: 'activo',
      fechaFin: new Date(2026, 7, 18),
      fechaPrometidaPago: new Date(2026, 7, 22),
    } satisfies NotificacionVentaConId;

    render(
      <PaymentPromiseDialog
        notification={notification}
        open
        onOpenChange={vi.fn()}
        onRemove={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Guardar cambios' }).hasAttribute('disabled')).toBe(true);
  });
});
