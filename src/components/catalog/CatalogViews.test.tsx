import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, it, expect, vi } from 'vitest';
import { catalogSnapshot } from '@/test/catalog-admin-fixtures';
import type { CatalogAdminSnapshot } from '@/modules/catalog/admin-contracts';
const state = vi.hoisted(() => ({ data: undefined as CatalogAdminSnapshot | undefined, loading: false, error: false, writeError: false, mutate: vi.fn(), refetch: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/catalogo' }));
vi.mock('@/hooks/use-catalog-admin', () => ({ useCatalogAdmin: () => ({
  snapshot: { data: state.data, isLoading: state.loading, isError: state.error, refetch: state.refetch },
  settings: { mutate: state.mutate, isPending: false, isError: state.writeError },
  config: { mutate: state.mutate, isPending: false, isError: state.writeError },
  interest: { mutate: state.mutate, isPending: false, isError: state.writeError },
}) }));
import { CatalogView } from './CatalogView';
import { InterestView } from './InterestView';
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); state.data = catalogSnapshot(); state.loading = false; state.error = false; state.writeError = false; vi.clearAllMocks(); });
it('interest displays masked contacts, oldest demand and a shortage banner', () => {
  render(<InterestView />);
  expect(screen.getByText('•••• 0001')).toBeTruthy();
  expect(screen.queryByText('50760000001')).toBeNull();
  expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('no hay perfiles');
});
it('interest actions close the queue and open the exact chat', () => {
  render(<InterestView />);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Acciones del interesado' }), { button: 0, ctrlKey: false });
  expect(screen.getByText('Abrir chat').getAttribute('href')).toBe('/chats?wa=50760000001');
  fireEvent.click(screen.getByText('Marcar como atendido'));
  expect(state.mutate).toHaveBeenCalledWith({ id: catalogSnapshot().interests[0].id, state: 'convertido' });
});
it.each([CatalogView, InterestView])('shows loading, empty, read error/retry and write errors for %s', View => {
  state.data = undefined; state.loading = true;
  const view = render(<View />); expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  state.loading = false; view.rerender(<View />);
  expect(screen.getByText(View === CatalogView ? 'No hay plataformas configuradas' : 'No hay interesados registrados')).toBeTruthy();
  state.error = true; state.writeError = true; view.rerender(<View />);
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); expect(state.refetch).toHaveBeenCalled();
});
it('catalog edits platform and plan configs, with low-stock indication', () => {
  render(<CatalogView />);
  expect(screen.getAllByText('Agotado')).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]);
  fireEvent.change(screen.getByLabelText('Umbral de stock bajo'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ plan_id: catalogSnapshot().plans[0].id, umbral_stock_bajo: 4 }));
});
it('settings validate TTL and render a live preview with visible marker buttons', () => {
  render(<CatalogView />);
  expect(screen.getByText('Sin perfiles disponibles', { exact: false })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('TTL de reserva (minutos)'), { target: { value: '45' } });
  fireEvent.click(screen.getByRole('button', { name: '{{disponibles}}' }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
  expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ reserva_ttl_minutos: 45 }));
  fireEvent.change(screen.getByLabelText('TTL de reserva (minutos)'), { target: { value: '0' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar ajustes' }).closest('form') ?? screen.getByRole('button', { name: 'Guardar ajustes' }));
  expect(screen.getByRole('alert').textContent).toContain('TTL');
});

it('filters interests by customer search without changing overall metrics', () => {
  render(<InterestView />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'No coincide' } });
  expect(screen.queryByText('Ana')).toBeNull(); expect(screen.getByText('No hay interesados registrados')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '0001' } }); expect(screen.getByText('Ana')).toBeTruthy();
});

it('config editor validates its threshold and saves a paired alternative', () => {
  render(<CatalogView />); fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
  fireEvent.change(screen.getByLabelText('Umbral de stock bajo'), { target: { value: '-1' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar configuración' }).closest('form') ?? screen.getByRole('button', { name: 'Guardar configuración' }));
  expect(screen.getByRole('alert')).toBeTruthy(); expect(state.mutate).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Umbral de stock bajo'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Plataforma alternativa'), { target: { value: catalogSnapshot().categories[0].id } });
  fireEvent.change(screen.getByLabelText('Plan alternativo'), { target: { value: catalogSnapshot().plans[0].id } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ alternativa_categoria_id: catalogSnapshot().categories[0].id, alternativa_plan_id: catalogSnapshot().plans[0].id }));
});
