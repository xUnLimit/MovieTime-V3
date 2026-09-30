import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  home: { data: undefined as unknown, isLoading: false, error: null as unknown },
  forecast: { meses: [] as unknown[], isLoading: false, error: null as unknown, retry: vi.fn() },
}));

vi.mock('@/hooks/use-dashboard-home', () => ({ useDashboardHome: () => mocks.home }));
vi.mock('@/hooks/use-pronostico-financiero', () => ({ usePronosticoFinanciero: () => mocks.forecast }));
vi.mock('@/store/dashboardFilterStore', () => ({ useDashboardFilterStore: () => ({ selectedYear: 2026 }) }));

import { DashboardMetrics } from './DashboardMetrics';

const stats = { ingresosPorMes: [{ mes: '2026-01', ingresos: 5455.89, gastos: 2708.67 }] };
const valueOf = (text: string) => screen.getByText(text);

describe('DashboardMetrics colors', () => {
  beforeEach(() => {
    mocks.home = { data: { stats }, isLoading: false, error: null };
    mocks.forecast = { meses: [{ ingresos: 107, gastos: 16.84 }], isLoading: false, error: null, retry: vi.fn() };
  });

  it('keeps the values neutral and gives each card icon its own tone', () => {
    render(<DashboardMetrics />);

    const expected: Record<string, string> = {
      '$2,708.67': 'danger',
      '$5,455.89': 'info',
      '$2,747.22': 'success',
      '$16.84': 'warning',
      '$107.00': 'brand',
    };
    for (const [value, tone] of Object.entries(expected)) {
      const element = valueOf(value);
      expect(element.className).not.toMatch(/text-(danger|info|success|warning|primary)/);
      expect(element.closest('[data-slot="metric-card"]')?.getAttribute('data-tone')).toBe(tone);
    }
  });

  it('shows a negative profit without coloring the value', () => {
    mocks.home = { data: { stats: { ingresosPorMes: [{ mes: '2026-01', ingresos: 100, gastos: 250 }] } }, isLoading: false, error: null };
    render(<DashboardMetrics />);
    expect(valueOf('$-150.00').className).not.toContain('text-danger');
  });

  it('keeps the colors off placeholder values while loading or when the forecast is unavailable', () => {
    mocks.forecast = { meses: [], isLoading: false, error: new Error('sin tasa'), retry: vi.fn() };
    render(<DashboardMetrics />);

    const unavailable = screen.getAllByText('No disponible');
    expect(unavailable).toHaveLength(2);
    for (const item of unavailable) {
      expect(item.className).not.toContain('text-danger');
      expect(item.className).not.toContain('text-info');
    }
    expect(screen.getByRole('alert').textContent).toContain('Las métricas esperadas no están disponibles');
  });

  it('shows the load error instead of the cards', () => {
    mocks.home = { data: undefined, isLoading: false, error: new Error('fallo') };
    render(<DashboardMetrics />);
    expect(screen.getByRole('alert').textContent).toContain('Error al cargar métricas del dashboard');
  });
});
