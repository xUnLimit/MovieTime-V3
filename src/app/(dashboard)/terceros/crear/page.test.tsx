import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  params: new Map<string, string>(),
  push: vi.fn(),
  formProps: null as null | Record<string, unknown>,
  loading: false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.push }),
  useSearchParams: () => ({ get: (key: string) => state.params.get(key) ?? null }),
}));
vi.mock('@/hooks/use-metodos-pago-terceros', () => ({
  useMetodosPagoTerceros: () => ({ data: [], isLoading: state.loading }),
}));
vi.mock('@/components/terceros/TerceroForm', () => ({
  TerceroForm: (props: Record<string, unknown> & { onSuccess: () => void }) => {
    state.formProps = props;
    return <button type="button" onClick={props.onSuccess}>Guardar</button>;
  },
}));

import CrearTerceroPage from './page';

beforeEach(() => {
  state.params = new Map();
  state.push.mockReset();
  state.formProps = null;
  state.loading = false;
});

describe('CrearTerceroPage', () => {
  it('pre-fills a client from a WhatsApp chat and returns to it after saving', async () => {
    const user = userEvent.setup();
    state.params = new Map([
      ['telefono', '+507 6000-0000<script>'],
      ['nombre', 'María José Pérez'],
      ['volver', '/chats?wa=50760000000'],
    ]);
    render(<CrearTerceroPage />);

    expect(state.formProps?.valoresIniciales).toEqual({ nombre: 'María', apellido: 'José Pérez', telefono: '+507 6000-0000' });
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/chats?wa=50760000000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(state.push).toHaveBeenCalledWith('/chats?wa=50760000000');
  });

  it('keeps the normal flow without chat data and rejects external return paths', async () => {
    const user = userEvent.setup();
    state.params = new Map([['volver', 'https://evil.example.com']]);
    render(<CrearTerceroPage />);

    expect(state.formProps?.valoresIniciales).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(state.push).toHaveBeenCalledWith('/terceros');
  });

  it('accepts the plain chats path, a phone without a name and shows loading', () => {
    state.params = new Map([['telefono', '60000000'], ['volver', '/chats']]);
    const { unmount } = render(<CrearTerceroPage />);
    expect(state.formProps?.valoresIniciales).toEqual({ nombre: '', apellido: '', telefono: '60000000' });
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/chats');
    unmount();

    state.params = new Map([['nombre', 'Juan'], ['volver', '/chats?wa=abc']]);
    state.loading = true;
    render(<CrearTerceroPage />);
    expect(screen.getByText('Cargando...')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/terceros');
  });
});
