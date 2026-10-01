/**
 * Test Setup
 *
 * Global setup for test environment.
 * Imported in vitest.config.mts
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { webcrypto } from 'node:crypto';

// jsdom does not implement SubtleCrypto; use Node's real Web Crypto implementation.
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

global.localStorage = localStorageMock as unknown as Storage;

// Mock matchMedia
if (typeof window !== 'undefined') Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
