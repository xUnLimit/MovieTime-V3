import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ refetch: vi.fn(), mutate: vi.fn(), use: vi.fn() }));
vi.mock('@/hooks/use-customer-reports', () => ({ useCustomerReports: mocks.use }));
import { ReportsView } from './ReportsView';
const row = { id: '00000000-0000-4000-8000-000000000001', wa_id: '50760000001', description: 'El servicio no abre.\n\nDesde ayer.', status: 'open' as const, version: 2, created_at: '2026-10-06T15:00:00Z' };
let state: { query: { data?: { reports: typeof row[]; total: number }; isLoading: boolean; isError: boolean; refetch: typeof mocks.refetch }; change: { isError: boolean; isPending: boolean; mutate: typeof mocks.mutate } };
beforeEach(() => { vi.clearAllMocks(); state = { query: { data: { reports: [row], total: 14 }, isLoading: false, isError: false, refetch: mocks.refetch }, change: { isError: false, isPending: false, mutate: mocks.mutate } }; mocks.use.mockImplementation(() => state); });
it('reads the whole report, links its chat and updates with the current version', async () => {
  const user = userEvent.setup(); render(<ReportsView />);
  await user.click(screen.getByRole('button', { name: 'Ver reporte de +50760000001' }));
  const dialog = screen.getByRole('dialog'); expect(within(dialog).getByRole('link', { name: 'Abrir chat' }).getAttribute('href')).toBe('/chats?wa=50760000001');
  expect(within(dialog).getByText('El servicio no abre. Desde ayer.')).toBeTruthy();
  fireEvent.change(within(dialog).getByLabelText('Estado del reporte'), { target: { value: 'resolved' } });
  expect(mocks.mutate).toHaveBeenCalledWith({ id: row.id, status: 'resolved', version: 2 }, expect.anything());
  mocks.mutate.mock.calls[0][1].onSuccess();
});
it('resets pagination on tab change and forwards server filters', async () => {
  const user = userEvent.setup(); render(<ReportsView />);
  await user.click(screen.getByRole('button', { name: 'Siguiente' })); expect(mocks.use).toHaveBeenLastCalledWith({ status: 'open', page: 2 }, true);
  await user.click(screen.getByRole('tab', { name: 'En atención' })); expect(mocks.use).toHaveBeenLastCalledWith({ status: 'in_progress', page: 1 }, true);
  await user.click(screen.getByRole('tab', { name: 'Resueltos' })); expect(mocks.use).toHaveBeenLastCalledWith({ status: 'resolved', page: 1 }, true);
});
it('shows controlled errors and retry, empty and loading states, and denies unauthorized UI', async () => {
  state.query.isError = true; state.change.isError = true; state.query.data = undefined;
  const user = userEvent.setup(); const { rerender } = render(<ReportsView />); expect(screen.getAllByRole('alert')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Reintentar' })); expect(mocks.refetch).toHaveBeenCalled();
  expect(screen.getByText('No hay reportes en este estado.')).toBeTruthy();
  state.query.isLoading = true; rerender(<ReportsView />); expect(screen.queryByText('No hay reportes en este estado.')).toBeNull();
  rerender(<ReportsView enabled={false} />); expect(screen.getByText('Esta sección está disponible solo para administradores.')).toBeTruthy();
});
