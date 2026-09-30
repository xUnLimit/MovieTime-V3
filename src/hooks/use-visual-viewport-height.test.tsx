import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_HEIGHT_VAR, useVisualViewportHeight } from './use-visual-viewport-height';

function stubViewport(height: number) {
  const viewport = new EventTarget() as EventTarget & { height: number };
  viewport.height = height;
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  return viewport;
}

describe('useVisualViewportHeight', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty(APP_HEIGHT_VAR);
  });

  it('publica la altura visible y la actualiza cuando el teclado cambia el viewport', () => {
    const viewport = stubViewport(852);
    renderHook(() => useVisualViewportHeight());
    expect(document.documentElement.style.getPropertyValue(APP_HEIGHT_VAR)).toBe('852px');

    viewport.height = 540.4;
    viewport.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue(APP_HEIGHT_VAR)).toBe('540px');
  });

  it('vuelve al origen si iOS desplazo la pagina al enfocar un campo', () => {
    const viewport = stubViewport(500);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
    renderHook(() => useVisualViewportHeight());
    viewport.dispatchEvent(new Event('scroll'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    scrollTo.mockRestore();
  });

  it('limpia la variable al desmontar', () => {
    stubViewport(700);
    const { unmount } = renderHook(() => useVisualViewportHeight());
    unmount();
    expect(document.documentElement.style.getPropertyValue(APP_HEIGHT_VAR)).toBe('');
  });
});
