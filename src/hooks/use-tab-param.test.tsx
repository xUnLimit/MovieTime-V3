import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabParam } from './use-tab-param';

const state = vi.hoisted(() => ({ search: '', replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => new URLSearchParams(state.search),
  usePathname: () => '/pedidos-cobros',
}));

const TABS = ['pedidos', 'cobros', 'interesados'] as const;

describe('useTabParam', () => {
  beforeEach(() => {
    state.search = '';
    state.replace.mockReset();
  });

  it('abre la pestaña de la URL cuando es conocida', () => {
    state.search = 'tab=cobros';
    const { result } = renderHook(() => useTabParam(TABS, 'pedidos'));
    expect(result.current[0]).toBe('cobros');
  });

  it('ignora un valor desconocido o ausente y abre la pestaña por defecto', () => {
    state.search = 'tab=<script>';
    expect(renderHook(() => useTabParam(TABS, 'pedidos')).result.current[0]).toBe('pedidos');
    state.search = '';
    expect(renderHook(() => useTabParam(TABS, 'pedidos')).result.current[0]).toBe('pedidos');
  });

  it('cambia de pestaña al instante y la escribe en la URL conservando los demás parámetros', () => {
    state.search = 'tipo=renovacion';
    const { result } = renderHook(() => useTabParam(TABS, 'pedidos'));
    act(() => result.current[1]('interesados'));
    expect(result.current[0]).toBe('interesados');
    expect(state.replace).toHaveBeenCalledWith('/pedidos-cobros?tipo=renovacion&tab=interesados', { scroll: false });
  });

  it('no acepta una pestaña que no está en la lista', () => {
    const { result } = renderHook(() => useTabParam(TABS, 'pedidos'));
    act(() => result.current[1]('otra'));
    expect(result.current[0]).toBe('pedidos');
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('obedece a la URL cuando cambia por fuera después de una elección', () => {
    const { result, rerender } = renderHook(() => useTabParam(TABS, 'pedidos'));
    act(() => result.current[1]('cobros'));
    state.search = 'tab=interesados';
    rerender();
    expect(result.current[0]).toBe('interesados');
  });
});
