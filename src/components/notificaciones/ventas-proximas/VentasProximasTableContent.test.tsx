import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NotificacionVentaConId } from './types';
const counts = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-venta-renewal-counts', () => ({ useVentaRenewalCounts: counts }));
import { VentasProximasTableContent } from './VentasProximasTableContent';

function renderTable(data: Record<string, number> | undefined, isError = false) {
  counts.mockReturnValue({ data, isError });
  render(<VentasProximasTableContent
    notificaciones={['sale-1', 'sale-2'].map((ventaId, i) => ({
      id: `notification-${i}`, ventaId, clienteNombre: 'Cliente', entidad: 'venta',
      fechaFin: new Date('2026-10-01'), diasRestantes: 3, moneda: 'USD', precioFinal: 10,
    } as NotificacionVentaConId))}
    visiblePasswords={new Set()} onToggleLeida={vi.fn()} onCopyToClipboard={vi.fn()}
    onTogglePasswordVisibility={vi.fn()} onNotificar={vi.fn()} onAcciones={vi.fn()}
    onRenovar={vi.fn()} onPaymentPromise={vi.fn()} onSeguimiento={vi.fn()}
  />);
}

describe('ventas proximas renewal column', () => {
  it('places renewal counts after Monto and keeps counts separate per sale of the same client', () => {
    renderTable({ 'sale-1': 4, 'sale-2': 0 });
    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    const column = headers.indexOf('Renovaciones');
    expect(headers[column - 1]).toBe('Monto');
    expect(headers[column + 1]).toBe('Estado');
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getAllByRole('cell')[column].textContent).toBe('4');
    expect(within(rows[1]).getAllByRole('cell')[column].textContent).toBe('0');
    expect(counts).toHaveBeenCalledWith(['sale-1', 'sale-2']);
  });
  it('does not display zero when the count is unavailable', () => {
    renderTable(undefined, true);
    expect(screen.getAllByTitle('No se pudieron cargar las renovaciones').map(cell => cell.textContent)).toEqual(['—', '—']);
  });
});
