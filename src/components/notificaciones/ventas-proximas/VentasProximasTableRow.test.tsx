import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VentasProximasTableRow } from './VentasProximasTableRow';
import type { NotificacionVentaConId } from './types';

const notification = {
  id: 'notif-1',
  entidad: 'venta',
  tipo: 'sistema',
  prioridad: 'alta',
  titulo: 'Venta vencida',
  leida: false,
  resaltada: true,
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
  fechaPrometidaPago: new Date(2026, 7, 27),
} satisfies NotificacionVentaConId;

function renderRow(overrides: Partial<NotificacionVentaConId> = {}) {
  render(
    <table>
      <tbody>
        <VentasProximasTableRow
          notif={{ ...notification, ...overrides }}
          visiblePasswords={new Set()}
          onToggleLeida={vi.fn()}
          onCopyToClipboard={vi.fn()}
          onTogglePasswordVisibility={vi.fn()}
          onNotificar={vi.fn()}
          onAcciones={vi.fn()}
          onRenovar={vi.fn()}
          onPaymentPromise={vi.fn()}
          onSeguimiento={vi.fn()}
        />
      </tbody>
    </table>,
  );
}

describe('VentasProximasTableRow', () => {
  it('keeps the orange follow-up background when a payment promise exists', () => {
    renderRow();
    expect(screen.getByRole('row').className).toContain('bg-warning-subtle');
  });

  it('describes a highlighted notification as being in follow-up', () => {
    renderRow({ fechaPrometidaPago: undefined });
    expect(screen.getByTitle('Notificación en seguimiento')).toBeTruthy();
  });
});
