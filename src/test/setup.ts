/**
 * Test Setup
 *
 * Global setup for test environment.
 * Imported in vitest.config.mts
 */

import { afterEach, beforeEach, vi } from 'vitest';
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

beforeEach(() => {
  // Suites may restore their globals after a test; install this fixture for each test.
  vi.stubGlobal('localStorage', localStorageMock);
});

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
