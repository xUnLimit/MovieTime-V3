import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Servicio } from '@/types';
import { ServiciosListTable } from './ServiciosListTable';

const longName = 'Servicio con un nombre extenso '.repeat(6).trim();
const longEmail = `${'cuenta-extensa-'.repeat(12)}@example.com`;
const servicio: Servicio = {
  id: 'servicio-1', categoriaId: 'categoria-1', categoriaNombre: 'Categoria extensa '.repeat(8),
  nombre: longName, tipo: 'plan-1', correo: longEmail, contrasena: '',
  perfilesDisponibles: 5, perfilesOcupados: 0, costoServicio: 15, gastosTotal: 15,
  activo: true, renovacionAutomatica: false, createdBy: 'usuario-1',
  createdAt: new Date('2026-09-01T12:00:00Z'), updatedAt: new Date('2026-09-01T12:00:00Z'),
};

describe('ServiciosListTable', () => {
  it('conserva nombres y correos largos accesibles y permite ordenar las filas', async () => {
    const user = userEvent.setup();
    render(<ServiciosListTable servicios={[servicio, { ...servicio, id: 'servicio-2', nombre: 'Alpha' }]}
      isLoading={false} title="Servicios" searchQuery="" onSearchChange={vi.fn()}
      hasMore={false} hasPrevious={false} page={1} totalPages={1} onNext={vi.fn()} onPrevious={vi.fn()} />);

    expect(screen.getByRole('table').classList.contains('table-fixed')).toBe(true);
    expect(screen.getByTitle(longName).classList.contains('truncate')).toBe(true);
    expect(screen.getAllByTitle(longEmail)).toHaveLength(2);
    expect(screen.getAllByTitle(longEmail)[0].classList.contains('truncate')).toBe(true);
    expect(screen.getAllByTitle(longEmail)[0].parentElement?.className).toContain('min-w-0 leading-tight');
    expect(screen.getAllByTitle(servicio.categoriaNombre.trim())[0].classList.contains('truncate')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Nombre' }));
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alpha');
  });
});
