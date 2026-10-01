import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { VentaDoc } from '@/types';
import { VentasTable } from './VentasTable';

const longName = 'Cliente con un nombre extenso '.repeat(6).trim();
const longEmail = `${'cuenta-extensa-'.repeat(12)}@example.com`;
const venta: VentaDoc = {
  id: 'venta-1', clienteNombre: longName, servicioId: 'servicio-1',
  servicioNombre: 'Servicio con un nombre extenso '.repeat(6), servicioCorreo: longEmail,
  categoriaId: 'categoria-1', precioFinal: 15, fechaInicio: new Date('2026-09-01T12:00:00Z'),
  fechaFin: new Date('2026-10-01T12:00:00Z'), cicloPago: 'mensual',
};

describe('VentasTable', () => {
  it('conserva los datos largos accesibles en columnas limitadas y ordena las ventas', async () => {
    const user = userEvent.setup();
    render(<VentasTable ventas={[venta, { ...venta, id: 'venta-2', clienteNombre: 'Ana' }]}
      isLoading={false} title="Ventas" searchQuery="" onSearchChange={vi.fn()}
      hasMore={false} hasPrevious={false} page={1} totalPages={1} onNext={vi.fn()} onPrevious={vi.fn()} />);

    expect(screen.getByRole('table').classList.contains('table-fixed')).toBe(true);
    expect(screen.getByTitle(longName).textContent?.trim()).toBe(longName.trim());
    expect(screen.getByTitle(longName).classList.contains('truncate')).toBe(true);
    expect(screen.getAllByTitle(longEmail)).toHaveLength(2);
    expect(screen.getAllByTitle(longEmail)[0].classList.contains('truncate')).toBe(true);
    expect(screen.getAllByTitle(longEmail)[0].parentElement?.className).toContain('min-w-0 leading-tight');
    await user.click(screen.getByRole('button', { name: 'Cliente' }));
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('Ana');
    await user.click(screen.getAllByRole('button', { name: 'Acciones de la venta' })[0]);
    expect(screen.getByRole('menuitem', { name: 'Ver detalles' }).getAttribute('href')).toBe('/ventas/venta-2');
  });
});
