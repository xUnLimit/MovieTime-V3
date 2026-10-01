import { fireEvent, render, screen } from '@testing-library/react';
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

  it('muestra credenciales y permite copiarlas o alternar la contraseña', () => {
    const copy = vi.fn();
    const toggle = vi.fn();
    render(<table><tbody><VentasProximasTableRow
      notif={{ ...notification, servicioCorreo: 'ana@example.test', servicioContrasena: 'secreto', codigo: '1234' }}
      visiblePasswords={new Set(['notif-1'])} onToggleLeida={vi.fn()}
      onCopyToClipboard={copy} onTogglePasswordVisibility={toggle}
      onNotificar={vi.fn()} onAcciones={vi.fn()} onRenovar={vi.fn()}
      onPaymentPromise={vi.fn()} onSeguimiento={vi.fn()}
    /></tbody></table>);
    expect(screen.getByText('secreto')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Copiar email'));
    fireEvent.click(screen.getByTitle('Copiar contraseña'));
    fireEvent.click(screen.getByTitle('Copiar código'));
    fireEvent.click(screen.getByTitle('Ocultar contraseña'));
    expect(copy).toHaveBeenCalledTimes(3);
    expect(toggle).toHaveBeenCalledWith('notif-1');
  });

  it('marca como leida y selecciona una venta sin promesa', () => {
    const toggle = vi.fn();
    const select = vi.fn();
    render(<table><tbody><VentasProximasTableRow
      notif={{ ...notification, fechaPrometidaPago: undefined, resaltada: false }}
      selected={false} onSelectedChange={select} visiblePasswords={new Set()}
      onToggleLeida={toggle} onCopyToClipboard={vi.fn()}
      onTogglePasswordVisibility={vi.fn()} onNotificar={vi.fn()}
      onAcciones={vi.fn()} onRenovar={vi.fn()} onPaymentPromise={vi.fn()}
      onSeguimiento={vi.fn()}
    /></tbody></table>);
    fireEvent.click(screen.getByTitle('Marcar como leída'));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(toggle).toHaveBeenCalledWith('notif-1', true);
    expect(select).toHaveBeenCalledWith('notif-1', true);
  });

  it('permite marcar como no leida una venta leida', () => {
    const toggle = vi.fn();
    render(<table><tbody><VentasProximasTableRow
      notif={{ ...notification, fechaPrometidaPago: undefined, resaltada: false, leida: true }}
      visiblePasswords={new Set()} onToggleLeida={toggle} onCopyToClipboard={vi.fn()}
      onTogglePasswordVisibility={vi.fn()} onNotificar={vi.fn()}
      onAcciones={vi.fn()} onRenovar={vi.fn()} onPaymentPromise={vi.fn()}
      onSeguimiento={vi.fn()}
    /></tbody></table>);
    fireEvent.click(screen.getByTitle('Marcar como sin leer'));
    expect(toggle).toHaveBeenCalledWith('notif-1', false);
  });
});
