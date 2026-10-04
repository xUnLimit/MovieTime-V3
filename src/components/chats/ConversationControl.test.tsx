import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhatsAppConversationControl } from '@/types/whatsapp-conversation';
import { ConversationControl } from './ConversationControl';

const state = vi.hoisted(() => ({ data: null as WhatsAppConversationControl | null, loading: false, failed: false, mutate: vi.fn(), retry: vi.fn(), pending: false, changeError: false, orderError: false, orders: [] as unknown[] }));
vi.mock('@/hooks/use-conversation-control', () => ({ useConversationControl: () => ({ query: { data: state.data, isLoading: state.loading, isError: state.failed, refetch: state.retry }, change: { mutate: state.mutate, isPending: state.pending, isError: state.changeError, error: new Error('private stack') }, resolve: { mutate: state.mutate, isPending: false, isError: false } }) }));
vi.mock('@/hooks/use-pedidos', () => ({ usePedidos: () => ({ data: state.orders, isLoading: state.loading, isError: state.orderError, refetch: state.retry }) }));
vi.mock('@/components/ventas/PedidoReview', () => ({ PedidoReview: () => <p>Revisión contextual del pedido</p> }));
beforeEach(() => { vi.clearAllMocks(); state.data = { waId: '50760000001', mode: 'bot', version: 7, operatorId: null, activeProcess: 'renewal', orderId: null, handoffReason: null }; state.loading = false; state.failed = false; state.pending = false; state.changeError = false; state.orderError = false; state.orders = []; });

describe('ConversationControl', () => {
  it('toma atención usando la versión del servidor', () => {
    render(<ConversationControl waId="50760000001" />);
    expect(screen.getByText('Atención automática')).toBeTruthy();
    expect(screen.getByText('Renovación')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tomar atención' }));
    expect(state.mutate).toHaveBeenCalledWith({ mode: 'human', version: 7 });
  });
  it('informa al devolver, permite seguir atendiendo y confirma explícitamente', () => {
    state.data = { ...state.data!, mode: 'human', handoffReason: 'payment_review', activeProcess: 'unfamiliar' };
    render(<ConversationControl waId="50760000001" />);
    expect(screen.getByText('Proceso en curso')).toBeTruthy();
    expect(screen.getByText(/El pago necesita revisión/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Devolver a atención automática' }));
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir atendiendo' }));
    expect(screen.queryByRole('button', { name: 'Devolver conversación' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Devolver a atención automática' }));
    fireEvent.click(screen.getByRole('button', { name: 'Devolver conversación' }));
    expect(state.mutate).toHaveBeenCalledWith({ mode: 'bot', version: 7 }, expect.any(Object));
    act(() => state.mutate.mock.calls[0][1].onSuccess());
    expect(screen.queryByRole('button', { name: 'Devolver conversación' })).toBeNull();
  });
  it('maneja carga, error, falta de datos y error seguro de cambio', () => {
    state.loading = true;
    const { rerender } = render(<ConversationControl waId="50760000001" />);
    expect(screen.getByText('Cargando atención')).toBeTruthy();
    state.loading = false; state.failed = true;
    rerender(<ConversationControl waId="50760000001" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(state.retry).toHaveBeenCalled();
    state.failed = false; state.changeError = true; state.pending = true;
    rerender(<ConversationControl waId="50760000001" />);
    expect(screen.getByRole('button', { name: 'Actualizando…' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('alert').textContent).not.toContain('private');
    state.data = null;
    rerender(<ConversationControl waId="50760000001" />);
    expect(screen.queryByText('Atención automática')).toBeNull();
  });
  it('abre el pedido en el chat con recuperación y sin navegación', () => {
    state.data = { ...state.data!, orderId: 'order-1' };
    const { rerender } = render(<ConversationControl waId="50760000001" />);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido y pago' }));
    expect(screen.getByText(/No se encontró el pedido relacionado/)).toBeTruthy();
    state.orderError = true;
    rerender(<ConversationControl waId="50760000001" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    state.orderError = false; state.orders = [{ id: 'order-1' }];
    rerender(<ConversationControl waId="50760000001" />);
    expect(screen.getByText('Revisión contextual del pedido')).toBeTruthy();
  });
  it('exige revisión manual antes de marcar un envío incierto atendido', () => {
    state.data = { ...state.data!, mode: 'human', handoffReason: 'delivery_uncertain' };
    render(<ConversationControl waId="50760000001" />);
    expect(screen.getByText(/Revisa el envío y responde manualmente/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar caso atendido' }));
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir revisando' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar caso atendido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar caso atendido' }));
    expect(state.mutate).toHaveBeenCalledWith(7, expect.any(Object));
    act(() => state.mutate.mock.calls[0][1].onSuccess());
    expect(screen.queryByRole('button', { name: 'Confirmar caso atendido' })).toBeNull();
  });
});

