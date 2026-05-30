import { describe, expect, it } from 'vitest';

import { normalizePhoneSearch } from './text';

describe('normalizePhoneSearch', () => {
  it('removes common phone formatting characters', () => {
    expect(normalizePhoneSearch('+507 6689-4143')).toBe('50766894143');
    expect(normalizePhoneSearch('(507) 6689 4143')).toBe('50766894143');
    expect(normalizePhoneSearch('6689-4143')).toBe('66894143');
  });

  it('returns an empty string for nullish input', () => {
    expect(normalizePhoneSearch(undefined)).toBe('');
    expect(normalizePhoneSearch(null)).toBe('');
  });
});
