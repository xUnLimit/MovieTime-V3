import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const forecast = vi.hoisted(() => ({
  state: { meses: [] as unknown[], isLoading: false, error: null as unknown, retry: vi.fn() },
}));

vi.mock('@/hooks/use-pronostico-financiero', () => ({ usePronosticoFinanciero: () => forecast.state }));

import { PronosticoFinanciero } from './PronosticoFinanciero';

const mes = (n: number, over: Record<string, unknown> = {}) => ({
  mesKey: `2026-${n}`, mes: `Mes ${n}`, ingresos: 440, gastos: 277, ganancias: 163, ...over,
});

describe('PronosticoFinanciero', () => {
  beforeEach(() => {
    forecast.state = { meses: [], isLoading: false, error: null, retry: vi.fn() };
  });

  it('shows income in blue and expenses in red next to the month result', () => {
    forecast.state.meses = [mes(1), mes(2, { ingresos: 107, gastos: 300, ganancias: -193 })];
    render(<PronosticoFinanciero />);

    const income = screen.getAllByText('~$440')[0]!;
    const expenses = screen.getAllByText('~$277')[0]!;
    expect(income.className).toContain('text-info');
    expect(expenses.className).toContain('text-danger');
    expect(screen.getByText(/Ganancia: \$163/)).toBeTruthy();
    expect(screen.getByText(/Pérdida: \$193/)).toBeTruthy();
  });

  it('pages through the months four at a time', () => {
    forecast.state.meses = Array.from({ length: 6 }, (_, index) => mes(index + 1));
    render(<PronosticoFinanciero />);

    expect(screen.getByText('Mes 1')).toBeTruthy();
    expect(screen.queryByText('Mes 5')).toBeNull();
    expect((screen.getByRole('button', { name: 'Ver bloque anterior' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Ver siguiente bloque' }));
  });

  it('explains the empty, loading and error states', () => {
    const view = render(<PronosticoFinanciero />);
    expect(screen.getByText('No hay datos suficientes para proyectar.')).toBeTruthy();
    view.unmount();

    forecast.state = { meses: [], isLoading: true, error: null, retry: vi.fn() };
    const loading = render(<PronosticoFinanciero />);
    expect(screen.queryByText('No hay datos suficientes para proyectar.')).toBeNull();
    loading.unmount();

    forecast.state = { meses: [], isLoading: false, error: new Error('sin tasa'), retry: forecast.state.retry };
    render(<PronosticoFinanciero />);
    expect(screen.getByRole('alert').textContent).toContain('tasa de cambio segura');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(forecast.state.retry).toHaveBeenCalledTimes(1);
  });
});
