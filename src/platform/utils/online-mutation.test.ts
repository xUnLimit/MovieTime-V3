import { afterEach, expect, it, vi } from 'vitest';
import { assertOnlineMutation } from './online-mutation';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('rejects offline browser writes without creating a queued financial intent', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(assertOnlineMutation).toThrow('internet');
});
it('allows online browsers and server execution', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  expect(assertOnlineMutation).not.toThrow();
  vi.stubGlobal('navigator', undefined);
  expect(assertOnlineMutation).not.toThrow();
});
