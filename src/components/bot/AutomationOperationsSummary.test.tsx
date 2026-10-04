import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationControl } from '@/types/automation-control';
import { AutomationOperationsSummary } from './AutomationOperationsSummary';

const state = vi.hoisted(() => ({ operations: undefined as AutomationControl['operations'], loading: false, error: false, retry: vi.fn() }));
vi.mock('@/hooks/use-automation-control', () => ({ useAutomationControl: () => ({ data: { operations: state.operations }, isLoading: state.loading, isError: state.error, refetch: state.retry }) }));
beforeEach(() => { vi.clearAllMocks(); state.loading = false; state.error = false; state.operations = undefined; });
describe('resumen operativo', () => {
  it('muestra métricas reales y despliega detalle sin saturar el listado', () => {
    state.operations = { pendingMessages: 4, reviewMessages: 2, oldestPendingAt: '2026-10-03T12:00:00Z', retryAttempts: 3, averageResolutionSeconds: 42.5, pendingDeliveries: 5, reviewDeliveries: 1, ordersToday: 8, completedToday: 6, aiCallsToday: 7, aiReservedTokensToday: 1900 };
    const { rerender } = render(<AutomationOperationsSummary />);
    expect(screen.getByText('1900 tokens de presupuesto reservado')).toBeTruthy(); expect(screen.queryByText(/entregas pendientes/)).toBeNull();
    expect(screen.getByText('Pedidos de hoy completados')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle operativo' })); expect(screen.getByText(/5 entregas pendientes/)).toBeTruthy(); expect(screen.getByText(/Pendiente más antiguo/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Revisar casos en Chats' }).getAttribute('href')).toBe('/chats');
    expect(screen.queryByText(/Avisos de stock:/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Revisar avisos en Interesados' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalle operativo' })); expect(screen.queryByText(/entregas pendientes/)).toBeNull();
    state.operations = { ...state.operations, reviewMessages: 0, oldestPendingAt: null }; rerender(<AutomationOperationsSummary />); fireEvent.click(screen.getByRole('button', { name: 'Ver detalle operativo' })); expect(screen.queryByText(/Pendiente más antiguo/)).toBeNull();
    state.operations = { ...state.operations, pendingInterests: 3, reviewInterests: 2 }; rerender(<AutomationOperationsSummary />);
    expect(screen.getByText('Avisos de stock: 3 pendientes · 2 por revisar')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Revisar avisos en Interesados' }).getAttribute('href')).toBe('/automatizaciones/interesados');
    state.operations = { ...state.operations, pendingInterests: undefined, reviewInterests: 0 }; rerender(<AutomationOperationsSummary />);
    expect(screen.getByText('Avisos de stock: sin dato pendientes · 0 por revisar')).toBeTruthy();
    state.operations = { ...state.operations, pendingInterests: 0, reviewInterests: undefined }; rerender(<AutomationOperationsSummary />);
    expect(screen.getByText('Avisos de stock: 0 pendientes · sin dato por revisar')).toBeTruthy();
  });
  it('maneja operación ausente, carga y error sin representar ausencia como cero', () => {
    const { rerender, container } = render(<AutomationOperationsSummary />); expect(container.innerHTML).toBe('');
    state.loading = true; rerender(<AutomationOperationsSummary />); expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(3);
    state.loading = false; state.error = true; rerender(<AutomationOperationsSummary />); expect(screen.getByRole('alert')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Reintentar resumen' })); expect(state.retry).toHaveBeenCalled();
  });
});
