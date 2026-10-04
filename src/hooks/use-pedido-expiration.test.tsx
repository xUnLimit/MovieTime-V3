import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePedidoExpiration } from './use-pedido-expiration';

afterEach(() => { vi.useRealTimers(); });
describe('vencimiento del pedido', () => {
  it('actualiza las acciones al vencer durante la revisión y limpia el reloj al salir', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    const hook = renderHook(({ date }) => usePedidoExpiration(date), { initialProps: { date: '2026-10-03T12:00:01Z' } });
    expect(hook.result.current).toBe(false); act(() => vi.advanceTimersByTime(1000)); expect(hook.result.current).toBe(true);
    hook.rerender({ date: '2026-10-03T12:00:20Z' }); expect(hook.result.current).toBe(false);
    hook.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
