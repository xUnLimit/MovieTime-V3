import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  copy: { isLoading: false, isError: false, data: { overrides: {} as Record<string, string>, updatedAt: {} }, refetch: vi.fn() },
  mutate: vi.fn(), pending: false,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-commerce-copy', () => ({
  useCommerceCopy: () => state.copy,
  useSaveCommerceCopy: () => ({ mutate: state.mutate, isPending: state.pending }),
}));

import { CommerceFlowEditor } from './CommerceFlowEditor';

beforeEach(() => {
  vi.clearAllMocks(); state.pending = false;
  state.copy = { isLoading: false, isError: false, data: { overrides: {}, updatedAt: {} }, refetch: vi.fn() };
  Element.prototype.scrollIntoView = vi.fn();
});

describe('CommerceFlowEditor', () => {
  it('muestra el mapa completo y una invitación a elegir un mensaje', () => {
    render(<CommerceFlowEditor />);
    expect(screen.getByText('Edita un mensaje')).toBeTruthy();
    for (const title of ['Inicio', 'Plataformas', 'Planes', 'Carrito', 'Reserva', 'Pago y estado']) expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.getByText(/no se editan desde aquí/)).toBeTruthy();
  });

  it('abre el editor del mensaje elegido y lo lleva a la vista', async () => {
    const user = userEvent.setup(); render(<CommerceFlowEditor />);
    await user.click(screen.getByRole('button', { name: /Saludo y menú/ }));
    expect(screen.getByLabelText('Texto')).toBeTruthy();
    expect(screen.getByText(/Se usa cuando: El cliente escribe "hola"/)).toBeTruthy();
  });

  it('guarda con aviso de éxito y restaura con su propio aviso', async () => {
    state.mutate.mockImplementation((_input: unknown, options: { onSuccess: () => void }) => options.onSuccess());
    const user = userEvent.setup(); render(<CommerceFlowEditor />);
    await user.click(screen.getByRole('button', { name: /Saludo y menú/ }));
    const field = screen.getByLabelText('Texto'); await user.clear(field); await user.type(field, 'Buenas');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(state.mutate).toHaveBeenCalledWith({ key: 'greeting', text: 'Buenas' }, expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith('Mensaje guardado. El bot lo usa desde ya.');
  });

  it('restaurar un texto editado avisa que volvió el original', async () => {
    state.copy.data.overrides = { greeting: 'Buenas' };
    state.mutate.mockImplementation((_input: unknown, options: { onSuccess: () => void }) => options.onSuccess());
    const user = userEvent.setup(); render(<CommerceFlowEditor />);
    await user.click(screen.getByRole('button', { name: /Saludo y menú/ }));
    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    expect(state.mutate).toHaveBeenCalledWith({ key: 'greeting', text: null }, expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith('Texto original restaurado.');
  });

  it('muestra un aviso comprensible si guardar falla', async () => {
    state.mutate.mockImplementation((_input: unknown, options: { onError: (error: unknown) => void }) => options.onError(new Error('SQL secret')));
    const user = userEvent.setup(); render(<CommerceFlowEditor />);
    await user.click(screen.getByRole('button', { name: /Saludo y menú/ }));
    const field = screen.getByLabelText('Texto'); await user.type(field, ' !');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(String(toast.error.mock.calls[0][0])).not.toContain('SQL');
  });

  it('salta a otro paso del mapa', async () => {
    const user = userEvent.setup(); render(<CommerceFlowEditor />);
    const target = document.getElementById('paso-plataformas')!; target.scrollIntoView = vi.fn();
    await user.click(screen.getAllByRole('button', { name: /Plataformas/ })[0]);
    expect(target.scrollIntoView).toHaveBeenCalled();
  });

  it('muestra carga y permite reintentar si falla la lectura', async () => {
    state.copy = { ...state.copy, isLoading: true };
    const { rerender } = render(<CommerceFlowEditor />);
    expect(screen.queryByText('Inicio')).toBeNull();
    state.copy = { ...state.copy, isLoading: false, isError: true };
    rerender(<CommerceFlowEditor />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(state.copy.refetch).toHaveBeenCalled();
  });
});
