import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  retryAuth: vi.fn(),
  state: {
    authRecoveryError: null as string | null,
    isAuthenticated: false,
    isHydrated: true,
    isLoading: false,
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/application/use-cases/auth-use-cases', () => ({ AUTH_REMEMBER_KEY: 'remember-me' }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ ...mocks.state, login: mocks.login, logout: mocks.logout, retryAuth: mocks.retryAuth }),
}));

import { LOGIN_ENTER_MS, LoginScreen } from './LoginScreen';

function reducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }));
}

function fill(email = 'admin@movietime.test', password = 'clave-segura') {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // El checkbox de Radix mide su tamaño con ResizeObserver, que jsdom no incluye.
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    mocks.state = { authRecoveryError: null, isAuthenticated: false, isHydrated: true, isLoading: false };
    mocks.login.mockResolvedValue(undefined);
    reducedMotion(false);
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the access form with the page heading', () => {
    render(<LoginScreen />);
    expect(screen.getByRole('heading', { name: 'Bienvenido' })).toBeTruthy();
    expect(screen.getByLabelText('Correo electrónico')).toBeTruthy();
    expect(screen.getByText('© MovieTime PTY')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('.login-shell')?.getAttribute('data-phase')).toBe('idle');
  });

  it('asks for the missing field, focuses it and does not call login', () => {
    render(<LoginScreen />);
    submit();
    expect(screen.getByRole('alert').textContent).toContain('Ingresa tu correo y tu contraseña');
    expect(document.activeElement).toBe(screen.getByLabelText('Correo electrónico'));

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'admin@movietime.test' } });
    submit();
    expect(document.activeElement).toBe(screen.getByLabelText('Contraseña'));
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows the error inline, shakes the card and lets the user retry when login fails', async () => {
    // El reintento entra con exito: con reloj real su espera de animacion seguiria viva y
    // llamaria a push durante el test siguiente.
    vi.useFakeTimers();
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate;
    mocks.login.mockRejectedValueOnce(new Error('bad credentials'));
    render(<LoginScreen />);
    fill();
    await act(async () => { submit(); });

    expect(screen.getByRole('alert').textContent).toBeTruthy();
    expect(screen.getByLabelText('Contraseña').getAttribute('aria-invalid')).toBe('true');
    expect(animate).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(document.querySelector('.login-shell')?.getAttribute('data-phase')).toBe('idle');

    await act(async () => { submit(); });
    expect(mocks.login).toHaveBeenCalledTimes(2);
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  it('plays the entry sequence and navigates to the dashboard after the animation', async () => {
    vi.useFakeTimers();
    render(<LoginScreen />);
    fill();
    await act(async () => { submit(); });

    expect(mocks.login).toHaveBeenCalledWith('admin@movietime.test', 'clave-segura', false);
    expect(document.querySelector('.login-shell')?.getAttribute('data-phase')).toBe('entering');
    expect(screen.getByRole('button', { name: 'Bienvenido' })).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(LOGIN_ENTER_MS - 1); });
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/dashboard');
  });

  it('does not wait for the animation when the user prefers reduced motion', async () => {
    reducedMotion(true);
    render(<LoginScreen />);
    fill();
    await act(async () => { submit(); });
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/dashboard');
  });

  it('does not redirect early while the entry animation is playing', async () => {
    vi.useFakeTimers();
    const view = render(<LoginScreen />);
    fill();
    await act(async () => { submit(); });
    // El store ya esta autenticado antes de que termine la animacion.
    mocks.state = { ...mocks.state, isAuthenticated: true };
    view.rerender(<LoginScreen />);
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(LOGIN_ENTER_MS); });
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it('redirects right away when the visitor already has a session', () => {
    mocks.state = { ...mocks.state, isAuthenticated: true };
    render(<LoginScreen />);
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/dashboard');
  });

  it('ignores a second submit while entering', async () => {
    vi.useFakeTimers();
    render(<LoginScreen />);
    fill();
    await act(async () => { submit(); });
    fireEvent.click(screen.getByRole('button', { name: 'Bienvenido' }));
    expect(mocks.login).toHaveBeenCalledTimes(1);
  });

  it('warns about caps lock while typing the password and hides it on blur', () => {
    render(<LoginScreen />);
    const password = screen.getByLabelText('Contraseña');
    fireEvent.keyDown(password, { key: 'A', modifierCapsLock: true });
    expect(screen.getByText('Bloq Mayús está activado')).toBeTruthy();
    fireEvent.blur(password);
    expect(screen.queryByText('Bloq Mayús está activado')).toBeNull();
  });

  it('toggles password visibility and remembers the stored preference', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) => (key === 'remember-me' ? 'true' : null));
    render(<LoginScreen />);
    const password = screen.getByLabelText('Contraseña') as HTMLInputElement;
    expect(password.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(password.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Recordarme' }).getAttribute('aria-checked')).toBe('true');
  });

  it('shows the recovery state instead of the form when the session cannot be restored', () => {
    mocks.state = { ...mocks.state, authRecoveryError: 'No se pudo restaurar la sesión.' };
    render(<LoginScreen />);
    expect(screen.queryByLabelText('Correo electrónico')).toBeNull();
    expect(screen.getByText('No se pudo restaurar la sesión.')).toBeTruthy();
  });
});
