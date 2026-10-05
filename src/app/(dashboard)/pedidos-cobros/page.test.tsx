import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationControl } from '@/types/automation-control';
import PedidosCobrosPage from './page';

const state = vi.hoisted(() => ({
  admin: true, search: '', replace: vi.fn(), failingTab: null as string | null,
  operations: undefined as AutomationControl['operations'], controlError: false, retry: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => new URLSearchParams(state.search),
  usePathname: () => '/pedidos-cobros',
}));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (value: { user: { role: string } }) => unknown) => selector({ user: { role: state.admin ? 'admin' : 'vendedor' } }) }));
vi.mock('@/hooks/use-automation-control', () => ({ useAutomationControl: () => ({ data: { operations: state.operations }, isLoading: false, isError: state.controlError, refetch: state.retry }) }));
vi.mock('@/hooks/use-yappy-payments', () => ({ useYappyPayments: () => ({ data: [{ matchStatus: 'match_unico' }, { matchStatus: 'registrado' }], isLoading: false }) }));
function table(name: string, tab: string) {
  return function Table() {
    if (state.failingTab === tab) throw new Error('fallo interno');
    return <p>{name}</p>;
  };
}
vi.mock('@/components/ventas/PedidosView', () => ({ PedidosView: table('Tabla de pedidos', 'pedidos') }));
vi.mock('@/components/yappy/YappyPaymentsView', () => ({ YappyPaymentsView: table('Cola de cobros Yappy', 'cobros') }));
vi.mock('@/components/terceros/InterestsView', () => ({ InterestsView: table('Tabla de interesados', 'interesados') }));

const operations = { pendingMessages: 4, reviewMessages: 2, oldestPendingAt: null, retryAttempts: 0, averageResolutionSeconds: 0, pendingDeliveries: 5, reviewDeliveries: 1, ordersToday: 8, completedToday: 6, pendingInterests: 3, reviewInterests: 2 };
const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent;

beforeEach(() => {
  vi.clearAllMocks();
  state.admin = true;
  state.search = '';
  state.failingTab = null;
  state.operations = operations;
  state.controlError = false;
});
afterEach(() => vi.restoreAllMocks());

describe('/pedidos-cobros', () => {
  it('reúne las tres colas bajo un encabezado sin acción principal y abre Pedidos por defecto', () => {
    render(<PedidosCobrosPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Pedidos y cobros' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Pedidos y cobros');
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(screen.getByRole('tablist', { name: 'Secciones de pedidos y cobros' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Pedidos', 'Cobros', 'Interesados']);
    expect(selectedTab()).toBe('Pedidos');
    expect(screen.getByTitle('Pedidos de hoy')).toBeTruthy();
    expect(screen.getByText('Tabla de pedidos')).toBeTruthy();
    expect(screen.queryByText('Cola de cobros Yappy')).toBeNull();
    expect(screen.queryByText('Tabla de interesados')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('abre la pestaña pedida en ?tab= y vuelve a Pedidos con un valor desconocido', () => {
    state.search = 'tab=cobros';
    const { unmount } = render(<PedidosCobrosPage />);
    expect(selectedTab()).toBe('Cobros');
    expect(screen.getByText('Cola de cobros Yappy')).toBeTruthy();
    expect(screen.getByTitle('Detectados')).toBeTruthy();
    expect(screen.queryByTitle('Pedidos de hoy')).toBeNull();
    expect(screen.queryByText('Tabla de pedidos')).toBeNull();
    unmount();
    state.search = 'tab=interesados';
    const second = render(<PedidosCobrosPage />);
    expect(selectedTab()).toBe('Interesados');
    expect(screen.getByTitle('Avisos pendientes')).toBeTruthy();
    expect(screen.getByText('Tabla de interesados')).toBeTruthy();
    expect(screen.queryByTitle('Pedidos de hoy')).toBeNull();
    second.unmount();
    state.search = 'tab=compras';
    render(<PedidosCobrosPage />);
    expect(selectedTab()).toBe('Pedidos');
    expect(screen.getByText('Tabla de pedidos')).toBeTruthy();
  });

  it('cambia de pestaña, la escribe en la URL y solo monta la visible', async () => {
    const user = userEvent.setup();
    render(<PedidosCobrosPage />);
    await user.click(screen.getByRole('tab', { name: 'Cobros' }));
    expect(state.replace).toHaveBeenLastCalledWith('/pedidos-cobros?tab=cobros', { scroll: false });
    expect(selectedTab()).toBe('Cobros');
    expect(screen.getByText('Cola de cobros Yappy')).toBeTruthy();
    expect(screen.queryByText('Tabla de pedidos')).toBeNull();
    expect(screen.queryByTitle('Pedidos de hoy')).toBeNull();
    await user.keyboard('{ArrowRight}');
    expect(state.replace).toHaveBeenLastCalledWith('/pedidos-cobros?tab=interesados', { scroll: false });
    expect(screen.getByText('Tabla de interesados')).toBeTruthy();
    expect(screen.queryByText('Cola de cobros Yappy')).toBeNull();
  });

  it('mantiene la tabla de pedidos visible cuando falla el resumen operativo', () => {
    state.operations = undefined;
    state.controlError = true;
    render(<PedidosCobrosPage />);
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar el resumen de pedidos.');
    expect(screen.getByText('Tabla de pedidos')).toBeTruthy();
  });

  it('aísla el fallo de una cola sin perder las pestañas', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.failingTab = 'cobros';
    const user = userEvent.setup();
    render(<PedidosCobrosPage />);
    await user.click(screen.getByRole('tab', { name: 'Cobros' }));
    expect(screen.getByRole('heading', { name: 'Error en Cobros' })).toBeTruthy();
    expect(screen.queryByText('fallo interno')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Pedidos' }));
    expect(screen.getByText('Tabla de pedidos')).toBeTruthy();
  });

  it('muestra solo el aviso de permisos a quien no es administrador', () => {
    state.admin = false;
    state.search = 'tab=cobros';
    render(<PedidosCobrosPage />);
    expect(screen.getByText('Esta sección está disponible solo para administradores.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByText('Cola de cobros Yappy')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pedidos y cobros' })).toBeNull();
  });
});
