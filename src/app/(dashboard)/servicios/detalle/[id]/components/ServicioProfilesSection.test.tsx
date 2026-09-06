import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServicioProfilesSection } from './ServicioProfilesSection';
import { useServicioProfiles } from './useServicioProfiles';
import type { ServicioDetalle } from './types';

const servicio = { id: 'service-1', activo: true, perfilesDisponibles: 2 } as ServicioDetalle;

describe('service profile renewal count', () => {
  it.each([0, 4, undefined])('shows the sale renewal count %s with its icon in the expanded profile', (renovaciones) => {
    const { result } = renderHook(() => useServicioProfiles(servicio, [{
      ventaId: 'sale-1', perfilNumero: 1, clienteNombre: 'Cliente', renovaciones,
    }]));
    render(<ServicioProfilesSection
      servicio={servicio} visiblePerfiles={result.current.visiblePerfiles} expandedProfileNumber={1}
      perfilesDisponibles={1} profilePage={0} profilePageCount={1} profileSearch="" showProfileControls={false}
      getCicloPagoLabel={value => value} onNextPage={vi.fn()} onPreviousPage={vi.fn()}
      onCutSale={vi.fn()} onProfileSearchChange={vi.fn()} onTransferSale={vi.fn()} onToggleProfile={vi.fn()}
    />);
    const detail = screen.getByTitle('Sin contar el pago inicial');
    expect(detail.textContent).toBe(`Renovaciones:${renovaciones ?? '—'}`);
    expect(detail.querySelector('svg')).not.toBeNull();
    const column = detail.parentElement!;
    const grid = column.parentElement!;
    expect(grid.children).toHaveLength(4);
    expect(grid.children[3]).toBe(column);
    expect(grid.classList.contains('lg:grid-cols-4')).toBe(true);
    expect(screen.getAllByText('Renovaciones:')).toHaveLength(1);
  });
});
