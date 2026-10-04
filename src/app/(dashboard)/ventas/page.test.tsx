import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { VentasTable } from '@/components/ventas/VentasTable';
import type { ConfirmDeleteVentaDialog } from '@/components/shared/ConfirmDeleteVentaDialog';
import VentasPage from './page';

const state = vi.hoisted(() => ({ pagination: vi.fn(), refresh: vi.fn(), remove: vi.fn(), success: vi.fn(), error: vi.fn(), subscribe: vi.fn() }));
vi.mock('@/hooks/use-categorias-full', () => ({ useCategoriasFull: () => ({ data: [] }) }));
vi.mock('@/hooks/use-server-pagination', () => ({ useServerPagination: (input: unknown) => { state.pagination(input); return { data: [], isLoading: false, refresh: state.refresh }; } }));
vi.mock('@/application/client-domain-mutations', () => ({ deleteVentaMutation: state.remove }));
vi.mock('@/platform/events/cache-reactions', () => ({ subscribeToVentaListReactions: state.subscribe }));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
vi.mock('@/components/ventas/VentasMetrics', () => ({ VentasMetrics: () => <p>Métricas de ventas</p> }));
vi.mock('@/components/ventas/VentasNavigation', () => ({ VentasNavigation: () => <nav aria-label="Vistas de ventas">Suscripciones Pedidos Cobros</nav> }));
vi.mock('@/components/ventas/VentasTable', () => ({ VentasTable: (props: ComponentProps<typeof VentasTable>) => <div>
  <p>{props.title}</p><button onClick={() => props.onEstadoChange?.('activas')}>Activas</button><button onClick={() => props.onEstadoChange?.('inactivas')}>Inactivas</button>
  <button onClick={() => props.onSearchChange?.('Ana')}>Buscar Ana</button><button onClick={() => props.onCategoriaChange?.('category-1')}>Netflix</button>
  <button onClick={() => props.onOrderByChange?.('updatedAt')}>Ordenar</button><button onClick={() => props.onPageSizeChange?.(5)}>Cinco filas</button>
  <button onClick={() => props.onDelete?.('sale-1', 'service-1', 2)}>Eliminar venta</button><button onClick={() => props.onDelete?.('sale-2')}>Eliminar sin perfil</button>
</div> }));
vi.mock('@/components/shared/ConfirmDeleteVentaDialog', () => ({ ConfirmDeleteVentaDialog: (props: ComponentProps<typeof ConfirmDeleteVentaDialog>) => props.open ? <div><button onClick={() => props.onConfirm(false)}>Conservar pagos</button><button onClick={() => props.onConfirm(true)}>Eliminar pagos</button><button onClick={() => props.onOpenChange(false)}>Volver</button></div> : null }));
beforeEach(() => { vi.clearAllMocks(); state.remove.mockResolvedValue(undefined); state.subscribe.mockReturnValue(vi.fn()); });
function renderPage() { return render(<QueryClientProvider client={new QueryClient()}><VentasPage /></QueryClientProvider>); }
describe('Ventas con vistas hermanas', () => {
  it('aplica estado, categoría, búsqueda y orden en la paginación sin pestañas anidadas', () => {
    renderPage(); expect(screen.getByRole('navigation', { name: 'Vistas de ventas' })).toBeTruthy(); expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Activas' })); expect(screen.getByText('Ventas Activas')).toBeTruthy();
    expect(state.pagination.mock.lastCall?.[0].filters).toContainEqual({ field: 'estado', operator: '==', value: 'activo' });
    fireEvent.click(screen.getByRole('button', { name: 'Inactivas' })); fireEvent.click(screen.getByRole('button', { name: 'Netflix' })); fireEvent.click(screen.getByRole('button', { name: 'Buscar Ana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar' })); fireEvent.click(screen.getByRole('button', { name: 'Cinco filas' }));
    expect(state.pagination.mock.lastCall?.[0]).toMatchObject({ pageSize: 5, orderByField: 'updatedAt', filters: [{ field: 'estado', value: 'inactivo' }, { field: 'categoriaId', value: 'category-1' }, { field: '__search__', value: { value: 'Ana' } }] });
  });
  it('conserva confirmación, refresco y manejo de error al eliminar desde la vista', async () => {
    renderPage(); fireEvent.click(screen.getByRole('button', { name: 'Eliminar venta' })); fireEvent.click(screen.getByRole('button', { name: 'Volver' })); expect(state.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar venta' })); fireEvent.click(screen.getByRole('button', { name: 'Conservar pagos' }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Venta eliminada', expect.any(Object))); expect(state.remove).toHaveBeenCalledWith('sale-1', 'service-1', 2, false); expect(state.refresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar sin perfil' })); fireEvent.click(screen.getByRole('button', { name: 'Eliminar pagos' }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Venta y pagos eliminados', expect.any(Object))); expect(state.remove).toHaveBeenCalledWith('sale-2', undefined, null, true);
    state.remove.mockRejectedValueOnce(new Error('SQL privado')); fireEvent.click(screen.getByRole('button', { name: 'Eliminar venta' })); fireEvent.click(screen.getByRole('button', { name: 'Conservar pagos' }));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Error eliminando venta', { description: 'No se pudo eliminar la venta.' }));
  });
});
