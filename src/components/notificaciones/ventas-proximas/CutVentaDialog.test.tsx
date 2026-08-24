import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CutVentaDialog } from './CutVentaDialog';
import type { NotificacionVentaConId } from './types';

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

describe('CutVentaDialog', () => {
  it('uses red destructive accents throughout the cut interface', () => {
    render(
      <CutVentaDialog
        notification={notification}
        open
        onOpenChange={vi.fn()}
        onCut={vi.fn()}
      />,
    );

    const heading = screen.getByRole('heading', { name: 'Cortar venta' });
    expect(heading.querySelector('span')?.className).toContain('bg-red-100');
    expect(heading.querySelector('svg')?.getAttribute('class')).toContain('text-red-600');
    expect(screen.getByRole('button', { name: 'Cortar venta' }).className)
      .toContain('bg-red-600');
  });
});
