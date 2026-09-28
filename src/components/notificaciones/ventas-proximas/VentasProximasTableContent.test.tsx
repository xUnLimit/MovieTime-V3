import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NotificacionVentaConId } from './types';
const counts = vi.hoisted(() => vi.fn());
const notices = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-venta-renewal-counts', () => ({ useVentaRenewalCounts: counts }));
vi.mock('@/hooks/use-whatsapp-notices', () => ({ useVentaNoticeStatus: notices }));
import { VentasProximasTableContent } from './VentasProximasTableContent';

const items = ['sale-1', 'sale-2'].map((ventaId, i) => ({
  id: `notification-${i}`, ventaId, clienteNombre: 'Cliente', entidad: 'venta',
  fechaFin: new Date('2026-10-01'), diasRestantes: 3, moneda: 'USD', precioFinal: 10,
} as NotificacionVentaConId));

const baseProps = {
  visiblePasswords: new Set<string>(), onToggleLeida: vi.fn(), onCopyToClipboard: vi.fn(),
  onTogglePasswordVisibility: vi.fn(), onNotificar: vi.fn(), onAcciones: vi.fn(),
  onRenovar: vi.fn(), onPaymentPromise: vi.fn(), onSeguimiento: vi.fn(),
};

function renderTable(data: Record<string, number> | undefined, isError = false) {
  counts.mockReturnValue({ data, isError });
  notices.mockReturnValue({ data: undefined });
  render(<VentasProximasTableContent notificaciones={items} {...baseProps} />);
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

describe('ventas proximas notice status and selection', () => {
  it('shows the notice badge and the no-continue badge per sale without marking anything read', () => {
    counts.mockReturnValue({ data: {}, isError: false });
    notices.mockReturnValue({ data: {
      'sale-1': { noticeId: 'n', tipo: 'dia_pago', badge: 'read', createdAt: '2026-09-28T15:00:00Z', noContinuar: true, noContinuarAt: null },
    } });
    const onToggleLeida = vi.fn();
    render(<VentasProximasTableContent notificaciones={items} {...baseProps} onToggleLeida={onToggleLeida} />);
    expect(notices).toHaveBeenCalledWith(['sale-1', 'sale-2']);
    expect(screen.getByText(/Leído/)).toBeTruthy();
    expect(screen.getByText('No desea continuar')).toBeTruthy();
    expect(onToggleLeida).not.toHaveBeenCalled();
  });

  it('toggles single rows and the whole page through the checkboxes', async () => {
    counts.mockReturnValue({ data: {}, isError: false });
    notices.mockReturnValue({ data: undefined });
    const onToggleSelected = vi.fn();
    const onToggleAllSelected = vi.fn();
    const user = userEvent.setup();
    render(
      <VentasProximasTableContent
        notificaciones={items}
        {...baseProps}
        selectedIds={new Set(['notification-0'])}
        onToggleSelected={onToggleSelected}
        onToggleAllSelected={onToggleAllSelected}
      />,
    );
    const rowBoxes = screen.getAllByRole('checkbox', { name: 'Seleccionar Cliente' });
    expect(rowBoxes[0]?.getAttribute('data-state')).toBe('checked');
    expect(rowBoxes[1]?.getAttribute('data-state')).toBe('unchecked');
    await user.click(rowBoxes[1]!);
    expect(onToggleSelected).toHaveBeenCalledWith('notification-1', true);
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los de esta página' }));
    expect(onToggleAllSelected).toHaveBeenCalledWith(true);
  });
});
