import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { YappyCandidateVenta, YappyPayment } from '@/application/use-cases/yappy-use-cases';

const resolve = vi.hoisted(() => vi.fn());
const dismiss = vi.hoisted(() => vi.fn());
const sync = vi.hoisted(() => vi.fn());
const queryData = vi.hoisted<{ payments: YappyPayment[]; ventas: YappyCandidateVenta[] }>(() => ({
  payments: [{ id: '123e4567-e89b-12d3-a456-426614174002', confirmationCode: 'GZCSS-20613095', amount: 2,
    payerNameShort: 'Emmanuel S.', payerPhoneLast4: '0268', paidAt: '2026-09-27T18:07:00.000Z',
    matchStatus: 'match_unico', candidateVentaIds: ['123e4567-e89b-12d3-a456-426614174004'], matchedVentaId: null }],
  ventas: [{ id: '123e4567-e89b-12d3-a456-426614174004', cliente: 'Ana P.', servicio: 'Netflix',
    perfil: 'Perfil 1', fechaFin: '2026-10-01', precio: 2 }],
}));
const initialPayment = structuredClone(queryData.payments[0]);
const queryStatus = vi.hoisted(() => ({ loading: false, error: false, connectionError: false, connectionLoading: false,
  ventaError: false, connected: false, actionError: false }));
const syncState = vi.hoisted<{ isSuccess: boolean; isError: boolean; data: { errorCode: string | null } | undefined }>(() => ({
  isSuccess: false, isError: false, data: undefined }));
const connectedAccount = vi.hoisted<{ mailbox: string; status: string; lastSyncedAt: string | null; lastErrorCode: string | null }>(() => ({ mailbox: 'owner@gmail.com', status: 'configurado',
  lastSyncedAt: '2026-09-27T18:07:00.000Z', lastErrorCode: null }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => selector({ user: { role: 'admin' } }) }));
vi.mock('@/hooks/use-yappy-payments', () => ({
  useYappyPayments: () => ({ data: queryData.payments, isLoading: queryStatus.loading, isError: queryStatus.error }),
  useYappyConnections: () => ({ data: queryStatus.connected ? [connectedAccount] : [], isLoading: queryStatus.connectionLoading, isError: queryStatus.connectionError }),
  useYappyCandidateVentas: () => ({ data: queryData.ventas, isError: queryStatus.ventaError }),
  useYappyVentaSearch: (term: string) => ({ data: term.trim().length >= 2 ? queryData.ventas.filter((venta) =>
    `${venta.cliente} ${venta.servicio} ${venta.id}`.toLowerCase().includes(term.toLowerCase())) : [], isFetching: false, isError: false }),
  useYappyActions: () => ({
    sync: { mutate: sync, isPending: false, isError: syncState.isError, isSuccess: syncState.isSuccess, data: syncState.data },
    resolve: { mutate: resolve, isPending: false, isError: queryStatus.actionError },
    dismiss: { mutate: dismiss, isPending: false, isError: false },
  }),
}));

import YappyPage from './page';

const review = () => fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));

beforeEach(() => {
  vi.clearAllMocks();
  queryStatus.loading = false;
  queryStatus.error = false;
  queryStatus.connectionError = false;
  queryStatus.connectionLoading = false;
  queryStatus.ventaError = false;
  queryStatus.connected = false;
  queryStatus.actionError = false;
  syncState.isSuccess = false;
  syncState.isError = false;
  syncState.data = undefined;
  connectedAccount.status = 'configurado';
  connectedAccount.lastSyncedAt = '2026-09-27T18:07:00.000Z';
  connectedAccount.lastErrorCode = null;
  queryData.payments = [structuredClone(initialPayment)];
});

describe('Yappy review queue', () => {
  it('shows detected payment, candidate and existing renewal destination', () => {
    render(<YappyPage />);
    expect(screen.getByText('Pagos Yappy detectados')).toBeTruthy();
    expect(screen.getAllByText(/Emmanuel S./).length).toBeGreaterThan(0);
    review();
    expect(screen.getAllByText(/GZCSS-20613095/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Renovar en la venta' }).getAttribute('href')).toBe('/ventas/123e4567-e89b-12d3-a456-426614174004');
  });
  it('records only the selected sale and requires a reason to dismiss', () => {
    render(<YappyPage />);
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como registrado' }));
    expect(resolve).toHaveBeenCalledWith({ paymentId: queryData.payments[0].id, ventaId: queryData.ventas[0].id });
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    const confirm = screen.getByRole('button', { name: 'Confirmar descarte' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Motivo para descartar'), { target: { value: 'Aviso repetido' } });
    fireEvent.click(confirm);
    expect(dismiss).toHaveBeenCalledWith({ paymentId: queryData.payments[0].id, note: 'Aviso repetido' });
  });
  it('lets an admin find a sale manually when no match was found', () => {
    queryData.payments[0].matchStatus = 'sin_match';
    queryData.payments[0].candidateVentaIds = [];
    render(<YappyPage />);
    review();
    expect(screen.getByRole('button', { name: 'Marcar como registrado' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Buscar venta para conciliación manual'), { target: { value: 'Netflix' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como registrado' }));
    expect(resolve).toHaveBeenCalledWith({ paymentId: queryData.payments[0].id, ventaId: queryData.ventas[0].id });
  });
  it('filters by status and shows a useful empty state', async () => {
    render(<YappyPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Estado' }));
    await userEvent.click(await screen.findByText('Descartado (0)'));
    expect(screen.getByText('No hay pagos en este estado.')).toBeTruthy();
  });
  it('shows connected account, last sync and a registered sale', () => {
    queryStatus.connected = true;
    queryData.payments[0].matchStatus = 'registrado';
    queryData.payments[0].matchedVentaId = queryData.ventas[0].id;
    render(<YappyPage />);
    expect(screen.getByText(/ow\*\*\*@gmail.com/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    expect(sync).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Ver venta registrada' })).toBeTruthy();
  });
  it('explains a Gmail authentication failure without exposing credentials', () => {
    queryStatus.connected = true;
    connectedAccount.lastErrorCode = 'auth_failed';
    render(<YappyPage />);
    expect(screen.getByText('Revisa la contraseña de aplicación de Gmail en Vercel.')).toBeTruthy();
    connectedAccount.lastErrorCode = null;
  });
  it('explains that there is no mailbox status yet', () => {
    render(<YappyPage />);
    expect(screen.getByText('Aún no hay estado del buzón.')).toBeTruthy();
    expect(screen.queryByText('Configurado')).toBeNull();
  });
  it('flags a mailbox that needs attention and a pending first sync', () => {
    queryStatus.connected = true;
    connectedAccount.status = 'error';
    connectedAccount.lastSyncedAt = null;
    render(<YappyPage />);
    expect(screen.getByText('Requiere atención')).toBeTruthy();
    expect(screen.getByText(/Pendiente/)).toBeTruthy();
  });
  it('confirms a finished sync and reports an interrupted one', () => {
    queryStatus.connected = true;
    syncState.isSuccess = true;
    syncState.data = { errorCode: null };
    const { unmount } = render(<YappyPage />);
    expect(screen.getByText('Sincronización finalizada.')).toBeTruthy();
    expect(screen.getByText('Configurado')).toBeTruthy();
    unmount();

    syncState.data = { errorCode: 'sync_error' };
    render(<YappyPage />);
    expect(screen.getByText('La sincronización se interrumpió. Inténtalo de nuevo.')).toBeTruthy();
    expect(screen.queryByText('Sincronización finalizada.')).toBeNull();
  });
  it('shows loading and errors without exposing internal details', () => {
    queryStatus.loading = true;
    queryStatus.connectionLoading = true;
    render(<YappyPage />);
    expect(screen.getByText('Cargando pagos…')).toBeTruthy();
    expect(screen.getByText('Cargando buzón…')).toBeTruthy();
  });
  it('shows payment and connection failures', () => {
    queryStatus.error = true;
    queryStatus.connectionError = true;
    queryStatus.actionError = true;
    render(<YappyPage />);
    review();
    expect(screen.getByText('No se pudo cargar la cola. Actualiza la página.')).toBeTruthy();
    expect(screen.getByText('No se pudo cargar o sincronizar el buzón.')).toBeTruthy();
    expect(screen.getByText('No se pudo actualizar el pago. Inténtalo de nuevo.')).toBeTruthy();
  });
  it('shows a no-result hint for a manual sale search', () => {
    queryData.payments[0].matchStatus = 'sin_match';
    render(<YappyPage />);
    review();
    fireEvent.change(screen.getByLabelText('Buscar venta para conciliación manual'), { target: { value: 'Sin servicio' } });
    expect(screen.getByText('No hay ventas con ese criterio.')).toBeTruthy();
  });
});
