import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { estimateInitialPageSize, settleFitRows, useFitPageSize } from './use-fit-page-size';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function viewport(mobile = false) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: mobile })));
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('ResizeObserver', undefined);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  return () => act(() => window.dispatchEvent(new Event('resize')));
}

describe('useFitPageSize', () => {
  it('measures the window and recalculates after resize', () => {
    const resize = viewport();
    const { result } = renderHook(() => useFitPageSize());
    const table = document.createElement('div');
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: 450 }));
    result.current.ref.current = table;
    resize();
    expect(result.current.rows).toBe(7);
    resize();
    expect(result.current.rows).toBe(7);
    vi.stubGlobal('innerHeight', 1200);
    resize();
    expect(result.current.rows).toBe(10);
  });

  it('accounts for the scroll position inside the main region', () => {
    const resize = viewport();
    const { result } = renderHook(() => useFitPageSize());
    const main = document.createElement('main');
    const table = document.createElement('div');
    main.append(table);
    Object.defineProperty(main, 'clientHeight', { value: 700 });
    main.scrollTop = 100;
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: 50 }));
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: 100 }));
    result.current.ref.current = table;
    resize();
    expect(result.current.rows).toBe(9);
  });

  it('leaves mobile pages to natural scrolling', () => {
    const resize = viewport(true);
    const { result } = renderHook(() => useFitPageSize());
    result.current.ref.current = document.createElement('div');
    resize();
    expect(result.current.rows).toBeNull();
  });

  it('does not measure an unattached or disabled table', () => {
    const resize = viewport();
    const { result, rerender } = renderHook(({ enabled }) => useFitPageSize({ enabled }), {
      initialProps: { enabled: true },
    });
    resize();
    expect(result.current.rows).toBeNull();
    rerender({ enabled: false });
    result.current.ref.current = document.createElement('div');
    resize();
    expect(result.current.rows).toBeNull();
  });
});

describe('initial and settled page sizes', () => {
  it('estimates desktop rows and bounds them to the supported range', () => {
    viewport();
    expect(estimateInitialPageSize()).toBe(10);
    vi.stubGlobal('innerHeight', 600);
    expect(estimateInitialPageSize()).toBe(5);
    expect(estimateInitialPageSize(25)).toBe(7);
  });

  it('uses the supplied fallback on mobile', () => {
    viewport(true);
    expect(estimateInitialPageSize(49, 8)).toBe(8);
  });

  it('keeps an equal size and adopts the next measured size', () => {
    expect(settleFitRows(7, 7)).toBe(7);
    expect(settleFitRows(undefined, 9)).toBe(9);
    expect(settleFitRows(7, 8)).toBe(8);
  });
});
