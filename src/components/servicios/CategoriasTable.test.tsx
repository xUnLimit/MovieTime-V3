import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CategoriasTable } from './CategoriasTable';

vi.mock('@/hooks/use-ventas-por-categorias', () => ({
  useVentasPorCategorias: () => ({ stats: {}, isLoading: false }),
}));

describe('CategoriasTable', () => {
  it('usa layout fijo para no desbordar el contenedor con tantas columnas', () => {
    render(<CategoriasTable categorias={[]} />);

    expect(screen.getByRole('table').classList.contains('table-fixed')).toBe(true);
    expect(screen.getByText('No se encontraron categorías')).toBeTruthy();
  });
});
