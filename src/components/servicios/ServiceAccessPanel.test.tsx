import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceAccessPanel } from './ServiceAccessPanel';

const state = vi.hoisted(() => ({ admin: true, mode: 'password' as 'password' | 'code', available: true, loading: false, failed: false, mutate: vi.fn(), retry: vi.fn(), saveError: false, saved: false }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (value: {user: {role: string}}) => unknown) => selector({ user: { role: state.admin ? 'admin' : 'vendedor' } }) }));
vi.mock('@/hooks/use-automation-control', () => ({ useAutomationControl: () => ({ data: { access: state.available ? [{serviceId:'s1', mode: state.mode, provider:'netflix', rotationConfirmedAt: null}] : [] }, isLoading: state.loading, isError: state.failed, refetch: state.retry }), useAutomationControlActions: () => ({ access: {mutate:state.mutate,isPending:false,isError:state.saveError,error:new Error('secret'),isSuccess:state.saved} }) }));
beforeEach(() => { vi.clearAllMocks(); state.admin=true; state.mode='password'; state.available=true; state.loading=false; state.failed=false; state.saveError=false; state.saved=false; });

describe('ServiceAccessPanel', () => {
  it('muestra el efecto y exige rotación antes de activar código', () => {
    render(<ServiceAccessPanel serviceId="s1" clients={4} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Entregar acceso por código' }));
    expect(screen.getByText(/Los 4 clientes vigentes/)).toBeTruthy();
    expect(screen.getByRole('button', {name:'Guardar modo de acceso'})).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name:'Guardar modo de acceso'}));
    expect(state.mutate).toHaveBeenCalledWith({serviceId:'s1',mode:'code',rotationConfirmed:true});
  });
  it('permite regresar a contraseña sin pedir rotación y maneja errores seguros', () => {
    state.mode='code'; state.saveError=true;
    const { rerender } = render(<ServiceAccessPanel serviceId="s1" clients={1} />);
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', {name:'Guardar modo de acceso'}));
    expect(state.mutate).toHaveBeenCalledWith({serviceId:'s1',mode:'password',rotationConfirmed:false});
    expect(screen.getByRole('alert').textContent).not.toContain('secret');
    state.saveError=false; state.saved=true;
    rerender(<ServiceAccessPanel serviceId="s1" clients={1} />);
    expect(screen.getByRole('status').textContent).toContain('actualizado');
  });
  it('omite cuentas no habilitadas y roles sin permiso; permite recuperar error', () => {
    state.loading=true;
    const { rerender, container } = render(<ServiceAccessPanel serviceId="s1" clients={1} />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    state.loading=false; state.failed=true;
    rerender(<ServiceAccessPanel serviceId="s1" clients={1} />);
    fireEvent.click(screen.getByRole('button', {name:'Reintentar'}));
    expect(state.retry).toHaveBeenCalled();
    state.failed=false; state.available=false;
    rerender(<ServiceAccessPanel serviceId="s1" clients={1} />);
    expect(container.textContent).toBe('');
    state.available=true; state.admin=false;
    rerender(<ServiceAccessPanel serviceId="s1" clients={1} />);
    expect(container.textContent).toBe('');
  });
});
