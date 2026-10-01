import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/platform/query-keys';
import type { WhatsAppRealtimeListener } from '@/application/use-cases/whatsapp-chat-use-cases';
import { getWhatsAppRealtimeStatus, setWhatsAppRealtimeStatus } from './whatsapp-realtime-status';

const mocks = vi.hoisted(() => ({ subscribe: vi.fn() }));
vi.mock('@/application/use-cases/whatsapp-chat-use-cases', () => ({
  subscribeToWhatsAppChatChangesUseCase: mocks.subscribe,
}));

import { useWhatsAppRealtime } from './use-whatsapp-realtime';

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

function listener(): WhatsAppRealtimeListener {
  const call = mocks.subscribe.mock.lastCall;
  if (!call) throw new Error('Falta la suscripcion Realtime');
  return call[0] as WhatsAppRealtimeListener;
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.subscribe.mockReset();
  mocks.subscribe.mockReturnValue(vi.fn());
  setWhatsAppRealtimeStatus('offline');
});

afterEach(() => {
  vi.useRealTimers();
  setWhatsAppRealtimeStatus('offline');
});

describe('useWhatsAppRealtime', () => {
  it('se suscribe segun enabled y cancela al desactivar', () => {
    const { wrapper } = createWrapper();
    const { rerender, unmount } = renderHook(({ enabled }) => useWhatsAppRealtime(enabled), {
      wrapper, initialProps: { enabled: false },
    });
    expect(mocks.subscribe).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(mocks.subscribe).toHaveBeenCalledOnce();
    const cancel = mocks.subscribe.mock.results[0]?.value;
    rerender({ enabled: false });
    expect(cancel).toHaveBeenCalledOnce();
    unmount();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('comparte el estado y reconecta una vez con dos montajes en el mismo cliente', async () => {
    const { wrapper, invalidate } = createWrapper();
    const first = renderHook(() => useWhatsAppRealtime(), { wrapper });
    const second = renderHook(() => useWhatsAppRealtime(), { wrapper });
    const listeners = mocks.subscribe.mock.calls.map(([value]) => value as WhatsAppRealtimeListener);
    act(() => {
      listeners.forEach((item) => item.onStatus('connecting'));
      listeners.forEach((item) => item.onStatus('live'));
      listeners.forEach((item) => item.onStatus('offline'));
      listeners.forEach((item) => item.onStatus('connecting'));
      listeners.forEach((item) => item.onStatus('live'));
    });
    await act(async () => { await Promise.resolve(); });
    expect(invalidate).toHaveBeenCalledOnce();
    first.unmount();
    expect(getWhatsAppRealtimeStatus()).toBe('live');
    second.unmount();
    expect(getWhatsAppRealtimeStatus()).toBe('offline');
  });

  it('cancela el lote pendiente al desmontar', () => {
    const { wrapper, invalidate } = createWrapper();
    const { unmount } = renderHook(() => useWhatsAppRealtime(), { wrapper });
    act(() => listener().onEvent({ table: 'whatsapp_inbound_messages', waId: '507' }));
    unmount();
    act(() => vi.advanceTimersByTime(250));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('agrupa una rafaga e invalida conversaciones y cada hilo una sola vez', async () => {
    const { wrapper, invalidate } = createWrapper();
    renderHook(() => useWhatsAppRealtime(), { wrapper });
    act(() => {
      listener().onEvent({ table: 'whatsapp_inbound_messages', waId: '507' });
      listener().onEvent({ table: 'whatsapp_outbound_messages', waId: '507' });
      listener().onEvent({ table: 'whatsapp_conversation_reads', waId: '508' });
      vi.advanceTimersByTime(249);
    });
    expect(invalidate).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.whatsapp.conversations() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.whatsapp.messages('507') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.whatsapp.messages('508') });
  });

  it('los estados invalidan todos los hilos y las insignias de avisos', async () => {
    const { wrapper, invalidate } = createWrapper();
    renderHook(() => useWhatsAppRealtime(), { wrapper });
    act(() => {
      listener().onEvent({ table: 'whatsapp_message_statuses', waId: '507' });
      listener().onEvent({ table: 'whatsapp_inbound_messages', waId: '508' });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'messages'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.whatsapp.noticeStatus() });
  });

  it('sin waId en mensajes invalida todos los hilos', async () => {
    const { wrapper, invalidate } = createWrapper();
    renderHook(() => useWhatsAppRealtime(), { wrapper });
    act(() => {
      listener().onEvent({ table: 'whatsapp_outbound_messages', waId: null });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'messages'] });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('al reconectar invalida todo WhatsApp una vez y cambia el estado', async () => {
    const { wrapper, invalidate } = createWrapper();
    renderHook(() => useWhatsAppRealtime(), { wrapper });
    act(() => {
      listener().onStatus('connecting');
      listener().onStatus('live');
    });
    expect(getWhatsAppRealtimeStatus()).toBe('live');
    expect(invalidate).not.toHaveBeenCalled();
    act(() => {
      listener().onStatus('offline');
      listener().onEvent({ table: 'whatsapp_inbound_messages', waId: '507' });
      listener().onStatus('connecting');
      listener().onStatus('live');
      listener().onStatus('live');
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.whatsapp.all });
  });

  it('un fallo de invalidacion no corta los eventos posteriores', async () => {
    const { wrapper, invalidate } = createWrapper();
    invalidate.mockRejectedValueOnce(new Error('fallo temporal'));
    renderHook(() => useWhatsAppRealtime(), { wrapper });
    act(() => {
      listener().onEvent({ table: 'whatsapp_conversation_flags', waId: null });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    act(() => {
      listener().onEvent({ table: 'whatsapp_conversation_flags', waId: null });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
