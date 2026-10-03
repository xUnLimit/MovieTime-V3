import { fireEvent, render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { CodeAccessNoticeDialog, CodeAccessNoticeContext } from './CodeAccessNoticeDialog';
import { ServicioCodeAccessCheckbox } from './ServicioCodeAccessCheckbox';
function notice() { return { pending: { enabled: true, apply: vi.fn() }, request: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), send: { current: false }, count: 3, loading: false, error: false, retry: vi.fn(), allowed: true }; }
it('requires explicit selection and reminds the administrator to change the password', () => {
  const api = notice(); render(<CodeAccessNoticeDialog notice={api} />);
  expect(screen.getByText(/Recuerda cambiar la contraseña/)).toBeTruthy(); expect(api.confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar y avisar al guardar' })); expect(api.confirm).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar sin avisar' })); expect(api.confirm).toHaveBeenCalledWith(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(api.cancel).toHaveBeenCalled();
});
it('disabling offers current credentials and checkbox routes to confirmation', () => {
  const api = notice(); api.pending.enabled = false;
  const view = render(<CodeAccessNoticeContext.Provider value={api}><ServicioCodeAccessCheckbox checked providerKey="netflix" onChange={vi.fn()} /><CodeAccessNoticeDialog notice={api} /></CodeAccessNoticeContext.Provider>);
  expect(screen.getByText(/incluirá las credenciales/)).toBeTruthy();
  view.rerender(<CodeAccessNoticeContext.Provider value={api}><ServicioCodeAccessCheckbox checked providerKey="netflix" onChange={vi.fn()} /></CodeAccessNoticeContext.Provider>);
  fireEvent.click(screen.getByRole('checkbox')); expect(api.request).toHaveBeenCalledWith(false, expect.any(Function));
});
it('checkbox handles loading, lookup errors and permissions', () => {
  const api = notice(); api.loading = true;
  const view = render(<CodeAccessNoticeContext.Provider value={api}><ServicioCodeAccessCheckbox checked={false} providerKey="netflix" /></CodeAccessNoticeContext.Provider>);
  expect(screen.getByRole('status')).toBeTruthy(); expect(screen.getByRole('checkbox').hasAttribute('disabled')).toBe(true);
  api.loading = false; api.error = true; view.rerender(<CodeAccessNoticeContext.Provider value={api}><ServicioCodeAccessCheckbox checked={false} providerKey="netflix" /></CodeAccessNoticeContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); expect(api.retry).toHaveBeenCalled();
  api.error = false; api.allowed = false; view.rerender(<CodeAccessNoticeContext.Provider value={api}><ServicioCodeAccessCheckbox checked={false} providerKey="netflix" /></CodeAccessNoticeContext.Provider>);
  expect(screen.getByRole('checkbox').hasAttribute('disabled')).toBe(true);
});
