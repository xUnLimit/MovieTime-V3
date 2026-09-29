import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useFinePointer, useMediaQuery } from './use-media-query';

function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  }));
  return (next: boolean) => {
    matches = next;
    listeners.forEach((cb) => cb());
  };
}

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve el estado actual y reacciona a cambios', () => {
    const change = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => change(true));
    expect(result.current).toBe(true);
  });
});

describe('useFinePointer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('consulta pointer: fine', () => {
    const queries: string[] = [];
    vi.stubGlobal('matchMedia', (query: string) => {
      queries.push(query);
      return { matches: true, addEventListener: () => undefined, removeEventListener: () => undefined };
    });
    const { result } = renderHook(() => useFinePointer());
    expect(result.current).toBe(true);
    expect(queries).toContain('(pointer: fine)');
  });
});
