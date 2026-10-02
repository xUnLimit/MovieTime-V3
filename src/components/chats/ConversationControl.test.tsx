import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ value: 'bot' as string | null, allowed: true, loading: false, error: false, pending: false, writeError: false, mutate: vi.fn(), refetch: vi.fn() }));
vi.mock('@/hooks/use-conversation-control', () => ({ useConversationControl: () => ({ allowed: state.allowed,
  owner: { data: state.value, isLoading: state.loading, isError: state.error, refetch: state.refetch },
  change: { mutate: state.mutate, isPending: state.pending, isError: state.writeError },
}) }));
import { ConversationControl } from './ConversationControl';
beforeEach(() => { Object.assign(state, { value: 'bot', allowed: true, loading: false, error: false, pending: false, writeError: false }); vi.clearAllMocks(); });
it('takes and returns control only after a button click', () => {
  const view = render(<ConversationControl waId="50760000001" />);
  expect(screen.getByText('Bot atendiendo')).toBeTruthy(); expect(state.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tomar conversación' })); expect(state.mutate).toHaveBeenCalledWith('humano');
  state.value = 'humano'; view.rerender(<ConversationControl waId="50760000001" />);
  expect(screen.getByText('Tu')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Devolver al bot' })); expect(state.mutate).toHaveBeenCalledWith('bot');
  state.pending = true; view.rerender(<ConversationControl waId="50760000001" />);
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
});
it('handles loading, missing sessions, error/retry, mutation errors and permissions', () => {
  state.loading = true; const view = render(<ConversationControl waId="50760000001" />);
  expect(screen.getByLabelText('Cargando atención')).toBeTruthy();
  state.loading = false; state.value = null; view.rerender(<ConversationControl waId="50760000001" />);
  expect(screen.getByText('Bot atendiendo')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Tomar conversación' })).toBeTruthy();
  state.error = true; view.rerender(<ConversationControl waId="50760000001" />);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); expect(state.refetch).toHaveBeenCalled();
  state.error = false; state.writeError = true; view.rerender(<ConversationControl waId="50760000001" />); expect(screen.getByRole('alert')).toBeTruthy();
  state.allowed = false; view.rerender(<ConversationControl waId="50760000001" />); expect(view.container.textContent).toBe('');
});
