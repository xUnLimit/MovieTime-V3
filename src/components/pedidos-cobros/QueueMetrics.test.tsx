import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationControl } from '@/types/automation-control';
import { InteresadosMetrics, PedidosMetrics } from './QueueMetrics';

type Operations = NonNullable<AutomationControl['operations']>;
const operations: Operations = { pendingMessages: 4, reviewMessages: 2, oldestPendingAt: '2026-10-03T12:00:00Z', retryAttempts: 3, averageResolutionSeconds: 42.5, pendingDeliveries: 5, reviewDeliveries: 1, ordersToday: 8, completedToday: 6 };
const state = vi.hoisted(() => ({ operations: undefined as AutomationControl['operations'], loading: false, error: false, retry: vi.fn() }));
vi.mock('@/hooks/use-automation-control', () => ({ useAutomationControl: () => ({ data: { operations: state.operations }, isLoading: state.loading, isError: state.error, refetch: state.retry }) }));
beforeEach(() => { vi.clearAllMocks(); state.loading = false; state.error = false; state.operations = undefined; });

function card(title: string) {
  const element = screen.getByTitle(title).closest<HTMLElement>('[data-slot="metric-card"]');
  if (!element) throw new Error(`No hay tarjeta para ${title}`);
  return element;
}

describe('indicadores de pedidos', () => {
  it('muestra los pedidos de hoy y el estado de sus entregas, sin métricas del buzón de mensajes', () => {
    state.operations = operations;
    render(<PedidosMetrics />);
    expect(within(card('Pedidos de hoy')).getByText('8')).toBeTruthy();
    expect(within(card('Completados hoy')).getByText('6')).toBeTruthy();
    expect(within(card('Entregas pendientes')).getByText('5')).toBeTruthy();
    expect(within(card('Entregas por revisar')).getByText('1').className).toContain('text-warning');
    expect(screen.queryByText(/Mensajes|Tiempo medio|reenvío/)).toBeNull();
  });
  it('no resalta las entregas por revisar cuando no hay ninguna', () => {
    state.operations = { ...operations, reviewDeliveries: 0 };
    render(<PedidosMetrics />);
    expect(within(card('Entregas por revisar')).getByText('0').className).not.toContain('text-warning');
  });
  it('carga con la forma final, se oculta sin resumen y permite reintentar un error', () => {
    state.loading = true;
    const { container, rerender } = render(<PedidosMetrics />);
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(4);
    state.loading = false;
    rerender(<PedidosMetrics />);
    expect(container.innerHTML).toBe('');
    state.error = true;
    rerender(<PedidosMetrics />);
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar el resumen de pedidos.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar resumen' }));
    expect(state.retry).toHaveBeenCalledOnce();
  });
});

describe('indicadores de interesados', () => {
  it('muestra los avisos de cupo pendientes y por revisar', () => {
    state.operations = { ...operations, pendingInterests: 3, reviewInterests: 2 };
    render(<InteresadosMetrics />);
    expect(within(card('Avisos pendientes')).getByText('3')).toBeTruthy();
    expect(within(card('Avisos por revisar')).getByText('2').className).toContain('text-warning');
    expect(screen.queryByText('Pedidos de hoy')).toBeNull();
  });
  it('muestra solo los contadores que el servidor informa', () => {
    state.operations = { ...operations, pendingInterests: 0 };
    const { container, rerender } = render(<InteresadosMetrics />);
    expect(within(card('Avisos pendientes')).getByText('0')).toBeTruthy();
    expect(screen.queryByText('Avisos por revisar')).toBeNull();
    state.operations = { ...operations, reviewInterests: 0 };
    rerender(<InteresadosMetrics />);
    expect(screen.queryByText('Avisos pendientes')).toBeNull();
    expect(within(card('Avisos por revisar')).getByText('0').className).not.toContain('text-warning');
    state.operations = operations;
    rerender(<InteresadosMetrics />);
    expect(container.innerHTML).toBe('');
    state.operations = undefined;
    rerender(<InteresadosMetrics />);
    expect(container.innerHTML).toBe('');
  });
  it('carga con dos indicadores y deja el error a la tabla, que comparte la consulta', () => {
    state.loading = true;
    const { container, rerender } = render(<InteresadosMetrics />);
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(2);
    state.loading = false;
    state.error = true;
    rerender(<InteresadosMetrics />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
