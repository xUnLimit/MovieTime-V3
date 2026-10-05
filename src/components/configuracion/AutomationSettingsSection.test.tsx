import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationControl } from '@/types/automation-control';
import { AutomationSettingsSection } from './AutomationSettingsSection';

const state = vi.hoisted(() => ({ admin: true, loading: false, failed: false, data: undefined as AutomationControl | undefined, refetch: vi.fn() }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (value: { user: { role: string } }) => unknown) => selector({ user: { role: state.admin ? 'admin' : 'vendedor' } }) }));
vi.mock('@/hooks/use-automation-control', () => ({
  useAutomationControl: () => ({ data: state.data, isLoading: state.loading, isError: state.failed, refetch: state.refetch }),
  useAutomationControlActions: () => ({ save: { mutate: vi.fn(), isPending: false, isError: false, error: null, isSuccess: false } }),
}));

const control: AutomationControl = { settings: { reservationMinutes: 15, maxReservations: 1, integrationsEnabled: false }, health: { integrationConfigured: false }, providers: [{ id: 'netflix', name: 'Netflix', loginCode: true, travelCode: true, verified: true }], interests: [], access: [] };

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.clearAllMocks();
  state.admin = true; state.loading = false; state.failed = false; state.data = control;
});

describe('AutomationSettingsSection', () => {
  it('shows purchases, integrations and access providers inside Configuración', () => {
    render(<AutomationSettingsSection />);
    expect(screen.getByRole('switch', { name: 'Permitir nuevas compras por WhatsApp' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Permitir integraciones' })).toBeTruthy();
    expect(screen.getByText('Proveedores de acceso')).toBeTruthy();
  });

  it('renders nothing for non-admins', () => {
    state.admin = false;
    const { container } = render(<AutomationSettingsSection />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a skeleton while loading and nothing without data', () => {
    state.loading = true;
    const { container, rerender } = render(<AutomationSettingsSection />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    state.loading = false; state.data = undefined;
    rerender(<AutomationSettingsSection />);
    expect(container.firstChild).toBeNull();
  });

  it('offers a retry when the settings cannot be loaded', async () => {
    state.failed = true; state.data = undefined;
    render(<AutomationSettingsSection />);
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar la configuración');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });
});
