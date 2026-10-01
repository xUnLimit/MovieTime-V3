import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClientesTable } from './ClientesTable';
import { RevendedoresTable } from './RevendedoresTable';
import { TodosTercerosTable } from './TodosTercerosTable';

vi.mock('@/hooks/use-ventas-por-terceros', () => ({
  useVentasPorTerceros: () => ({ stats: {} }),
}));

const common = {
  isLoading: false,
  searchQuery: '',
  onSearchChange: vi.fn(),
  onRefresh: vi.fn(),
  onEdit: vi.fn(),
  metodoPagoFilter: 'todos',
  onMetodoPagoFilterChange: vi.fn(),
  metodoPagoOptions: [],
};

describe('tablas de terceros', () => {
  it.each([
    ['Clientes', <ClientesTable key="c" {...common} clientes={[]} />],
    ['Revendedores', <RevendedoresTable key="r" {...common} revendedores={[]} />],
    ['Todos', <TodosTercerosTable key="t" {...common} terceros={[]} />],
  ])('%s usa layout fijo para que los nombres largos no desborden', (_name, element) => {
    render(element);

    expect(screen.getByRole('table').classList.contains('table-fixed')).toBe(true);
  });
});
