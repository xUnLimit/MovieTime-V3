import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedMessage } from '@/modules/whatsapp/saved-messages';

const state = vi.hoisted(() => ({ messages: [] as SavedMessage[], save: vi.fn(), remove: vi.fn() }));
vi.mock('@/hooks/use-chat-saved-messages', () => ({
  useChatSavedMessages: () => ({ data: state.messages, isLoading: false, isError: false, refetch: vi.fn() }),
  useSaveChatMessage: () => ({ mutateAsync: state.save, isPending: false }),
  useDeleteChatMessage: () => ({ mutateAsync: state.remove, isPending: false }),
}));

import { SavedMessagesDialog } from './SavedMessagesDialog';

const message: SavedMessage = {
  id: '11111111-1111-4111-8111-111111111111', title: 'Bienvenida', kind: 'text', body: 'Hola equipo', buttonLabel: '', options: [],
  createdBy: '22222222-2222-4222-8222-222222222222', createdAt: '2026-09-27', updatedAt: '2026-09-27',
};

beforeEach(() => { state.messages = []; state.save.mockReset(); state.remove.mockReset(); });

describe('SavedMessagesDialog', () => {
  it('creates messages for the team from an empty library', async () => {
    const user = userEvent.setup();
    state.save.mockResolvedValue(message);
    render(<SavedMessagesDialog open onOpenChange={vi.fn()} onUse={vi.fn()} />);

    expect(screen.getByText('Aún no hay mensajes guardados')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Nuevo mensaje' }));
    await user.type(screen.getByLabelText('Nombre para encontrarlo'), 'Bienvenida');
    await user.type(screen.getByLabelText('Texto del mensaje'), 'Hola equipo');
    await user.click(screen.getByRole('button', { name: 'Guardar mensaje' }));
    expect(state.save).toHaveBeenCalledWith({ draft: { title: 'Bienvenida', kind: 'text', body: 'Hola equipo', buttonLabel: '', options: [] }, id: undefined });
  });

  it('searches and uses a saved message without sale data', async () => {
    const user = userEvent.setup();
    state.messages = [message, { ...message, id: '33333333-3333-4333-8333-333333333333', title: 'Despedida', body: 'Hasta pronto' }];
    const onUse = vi.fn();
    render(<SavedMessagesDialog open onOpenChange={vi.fn()} onUse={onUse} />);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar mensajes guardados' }), 'bien');
    const library = screen.getByRole('region', { name: 'Biblioteca de mensajes' });
    expect(within(library).getByRole('button', { name: /Bienvenida/ })).toBeTruthy();
    expect(within(library).queryByRole('button', { name: /Despedida/ })).toBeNull();
    await user.click(within(library).getByRole('button', { name: /Bienvenida/ }));
    await user.click(screen.getByRole('button', { name: 'Usar en chat' }));
    expect(onUse).toHaveBeenCalledWith(message);
  });

  it('allows managing messages while the 24 hour window is closed', async () => {
    const user = userEvent.setup();
    state.messages = [message];
    render(<SavedMessagesDialog open canUse={false} onOpenChange={vi.fn()} onUse={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Usar en chat' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('heading', { name: 'Editar mensaje' })).toBeTruthy();
  });

  it('confirms before removing a team message', async () => {
    const user = userEvent.setup();
    state.messages = [message];
    state.remove.mockResolvedValue(undefined);
    render(<SavedMessagesDialog open onOpenChange={vi.fn()} onUse={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(state.remove).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
    expect(state.remove).toHaveBeenCalledWith(message.id);
  });
});
